//! Round-trip test entry: drives the generated client bindings so the JS host
//! observes getAttr/toStr/setAttr/callMethod/retain/release across the boundary.
const bindings = @import("bindings.zig");
const webidl = @import("webidl");

/// Read textContent (owned string via the allocator string-out path), free it,
/// set textContent to "changed", append `child` to `el`, and retain/release the
/// returned handle. Returns the original textContent byte length.
export fn run(el_h: u32, child_h: u32) u32 {
    const el = bindings.Element{ .handle = el_h };
    const child = bindings.Element{ .handle = child_h };

    const s = el.get_textContent();
    const len: u32 = @intCast(s.len);
    webidl.rt.freeStr(s);

    el.set_textContent("changed");

    const appended = el.appendChild(child);
    appended.ref();
    appended.unref();

    return len;
}

// One export per wrapper shape, so the host can count the handles each one
// leaves behind.

export fn setAttribute(el_h: u32) void {
    const el = bindings.Element{ .handle = el_h };
    el.setAttribute("id", "main");
}

export fn getScrollTop(el_h: u32) u32 {
    const el = bindings.Element{ .handle = el_h };
    return @intFromFloat(el.get_scrollTop());
}

export fn setScrollTop(el_h: u32) void {
    const el = bindings.Element{ .handle = el_h };
    el.set_scrollTop(12);
}

export fn getIsConnected(el_h: u32) u32 {
    const el = bindings.Element{ .handle = el_h };
    return @intFromBool(el.get_isConnected());
}

export fn getTextContent(el_h: u32) u32 {
    const el = bindings.Element{ .handle = el_h };
    const s = el.get_textContent();
    defer webidl.rt.freeStr(s);
    return @intCast(s.len);
}

export fn setTextContent(el_h: u32) void {
    const el = bindings.Element{ .handle = el_h };
    el.set_textContent("changed");
}

/// Returns the attribute length, or 0xFFFF_FFFF when the attribute is null.
export fn getAttribute(el_h: u32, present: u32) u32 {
    const el = bindings.Element{ .handle = el_h };
    const s = el.getAttribute(if (present != 0) "id" else "missing") orelse return 0xFFFF_FFFF;
    defer webidl.rt.freeStr(s);
    return @intCast(s.len);
}

export fn toggleAttribute(el_h: u32) u32 {
    const el = bindings.Element{ .handle = el_h };
    return @intFromBool(el.toggleAttribute("hidden", true));
}

export fn scrollTo(el_h: u32, with_x: u32) void {
    const el = bindings.Element{ .handle = el_h };
    el.scrollTo(if (with_x != 0) 4 else null, 8);
}

export fn fill(el_h: u32) u32 {
    const el = bindings.Element{ .handle = el_h };
    var buf: [4]u8 = .{ 0, 0, 0, 0 };
    el.fill(&buf);
    return buf[0];
}

export fn appendChild(el_h: u32, child_h: u32) u32 {
    const el = bindings.Element{ .handle = el_h };
    const child = bindings.Element{ .handle = child_h };
    return el.appendChild(child).handle;
}

export fn construct() u32 {
    return bindings.Counter.init("clicks", 3).handle;
}

export fn scale() u32 {
    return @intFromFloat(bindings.Counter.scale(2));
}

export fn staticTotal() u32 {
    bindings.Counter.set_total(7);
    return @intCast(bindings.Counter.get_total());
}
