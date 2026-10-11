import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHost } from './index.ts';

const wasmPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../test/fixtures/roundtrip/roundtrip.wasm',
);

const bytes = readFileSync(wasmPath) as unknown as Uint8Array;

test('roundtrip: getAttr/toStr/freeStr + setAttr/fromStr + callMethod + retain/release', async () => {
  const host = createHost();
  const mod = new WebAssembly.Module(bytes);
  const instance = await WebAssembly.instantiate(mod, host.imports as unknown as WebAssembly.Imports);
  host.attach(instance);

  const appended: unknown[] = [];
  const el = {
    textContent: 'hello',
    appendChild(c: unknown) { appended.push(c); return c; },
  };
  const child = {};

  const elH = host.intern(el);
  const childH = host.intern(child);

  const exports = instance.exports as unknown as { run(elH: number, childH: number): number };
  const ret = exports.run(elH, childH);

  assert.equal(ret, 5);
  assert.equal((el as Record<string, unknown>).textContent, 'changed');
  assert.strictEqual(appended[0], child);
});

/// Count the handles that `run` made and did not release. Host ids only go up,
/// so a probe handle before and after the call brackets every id it made.
function leakedBy(host: ReturnType<typeof createHost>, run: () => void): number {
  const release = host.imports.env.__webidl_release;
  const first = host.intern(true);
  release(first);
  run();
  const last = host.intern(true);
  release(last);
  let live = 0;
  for (let h = first + 1; h < last; h++) {
    if (host.retainCount(h) > 0) live++;
  }
  return live;
}

test('roundtrip: wrappers release the handles they make', async () => {
  const host = createHost();
  const mod = new WebAssembly.Module(bytes);
  const instance = await WebAssembly.instantiate(mod, host.imports as unknown as WebAssembly.Imports);
  host.attach(instance);

  const attrs = new Map<string, string>();
  const scrolls: unknown[] = [];
  const el = {
    textContent: 'hello',
    scrollTop: 30,
    isConnected: true,
    appendChild(c: unknown) { return c; },
    setAttribute(n: string, v: string) { attrs.set(n, v); },
    getAttribute(n: string) { return attrs.get(n) ?? null; },
    toggleAttribute(_n: string, force: boolean) { return force; },
    scrollTo(x: unknown, y: unknown) { scrolls.push([x, y]); },
    // A void IDL operation whose JS still returns a value, as TypedArray.fill does.
    fill(data: Uint8Array) { data[0] = 9; return data; },
  };
  const g = globalThis as unknown as Record<string, unknown>;
  g.Counter = class {
    label: string;
    start: number;
    static total = 0;
    static scale(v: number) { return v * 2; }
    constructor(label: string, start: number) { this.label = label; this.start = start; }
  };

  const elH = host.intern(el);
  const childH = host.intern({});
  const ex = instance.exports as unknown as Record<string, (...a: number[]) => number>;

  assert.equal(leakedBy(host, () => ex.setAttribute(elH)), 0, 'setAttribute');
  assert.equal(attrs.get('id'), 'main');
  assert.equal(leakedBy(host, () => assert.equal(ex.getScrollTop(elH), 30)), 0, 'get scrollTop');
  assert.equal(leakedBy(host, () => ex.setScrollTop(elH)), 0, 'set scrollTop');
  assert.equal(el.scrollTop, 12);
  assert.equal(leakedBy(host, () => assert.equal(ex.getIsConnected(elH), 1)), 0, 'get isConnected');
  assert.equal(leakedBy(host, () => assert.equal(ex.getTextContent(elH), 5)), 0, 'get textContent');
  assert.equal(leakedBy(host, () => ex.setTextContent(elH)), 0, 'set textContent');
  assert.equal(el.textContent, 'changed');
  assert.equal(leakedBy(host, () => assert.equal(ex.getAttribute(elH, 1), 4)), 0, 'getAttribute');
  assert.equal(leakedBy(host, () => assert.equal(ex.getAttribute(elH, 0) >>> 0, 0xffffffff)), 0, 'getAttribute null');
  assert.equal(leakedBy(host, () => assert.equal(ex.toggleAttribute(elH), 1)), 0, 'toggleAttribute');
  assert.equal(leakedBy(host, () => ex.scrollTo(elH, 1)), 0, 'scrollTo');
  assert.equal(leakedBy(host, () => ex.scrollTo(elH, 0)), 0, 'scrollTo null');
  assert.deepEqual(scrolls, [[4, 8], [null, 8]]);
  assert.equal(leakedBy(host, () => assert.equal(ex.fill(elH), 9)), 0, 'fill');
  assert.equal(leakedBy(host, () => assert.equal(ex.scale(), 4)), 0, 'static scale');
  assert.equal(leakedBy(host, () => assert.equal(ex.staticTotal(), 7)), 0, 'static total');

  // An object result belongs to the caller, and the caller keeps its own argument.
  let appended = 0;
  assert.equal(leakedBy(host, () => { appended = ex.appendChild(elH, childH); }), 1, 'appendChild');
  host.imports.env.__webidl_release(appended);
  assert.equal(host.retainCount(childH), 1);
  assert.equal(host.retainCount(elH), 1);

  let counter = 0;
  assert.equal(leakedBy(host, () => { counter = ex.construct(); }), 1, 'construct');
  assert.equal((host.value(counter) as { label: string }).label, 'clicks');
  host.imports.env.__webidl_release(counter);
});
