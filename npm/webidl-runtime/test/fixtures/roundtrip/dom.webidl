interface Element {
  attribute DOMString textContent;
  attribute double scrollTop;
  readonly attribute boolean isConnected;
  Element appendChild(Element child);
  undefined setAttribute(DOMString name, DOMString value);
  DOMString? getAttribute(DOMString name);
  boolean toggleAttribute(DOMString name, optional boolean force);
  undefined scrollTo(double? x, double y);
  undefined fill(Uint8Array data);
};

interface Counter {
  constructor(DOMString label, long start);
  static double scale(double v);
  static attribute long total;
};
