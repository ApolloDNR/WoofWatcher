class MiniNode {
  readonly nodeType: number;
  readonly nodeName: string;
  ownerDocument: MiniDocument;
  parentNode: MiniNode | null = null;
  childNodes: MiniNode[] = [];
  private readonly listeners = new Map<string, Set<(event: MiniEvent) => void>>();

  constructor(nodeType: number, nodeName: string, ownerDocument: MiniDocument) {
    this.nodeType = nodeType;
    this.nodeName = nodeName;
    this.ownerDocument = ownerDocument;
  }

  get firstChild(): MiniNode | null {
    return this.childNodes[0] ?? null;
  }

  get lastChild(): MiniNode | null {
    return this.childNodes[this.childNodes.length - 1] ?? null;
  }

  get nextSibling(): MiniNode | null {
    if (!this.parentNode) return null;
    const index = this.parentNode.childNodes.indexOf(this);
    return this.parentNode.childNodes[index + 1] ?? null;
  }

  appendChild(child: MiniNode): MiniNode {
    child.parentNode?.removeChild(child);
    child.parentNode = this;
    this.childNodes.push(child);
    return child;
  }

  insertBefore(child: MiniNode, before: MiniNode | null): MiniNode {
    if (before === null) return this.appendChild(child);
    const index = this.childNodes.indexOf(before);
    if (index < 0) throw new Error("insertBefore target is not a child");
    child.parentNode?.removeChild(child);
    child.parentNode = this;
    this.childNodes.splice(index, 0, child);
    return child;
  }

  removeChild(child: MiniNode): MiniNode {
    const index = this.childNodes.indexOf(child);
    if (index < 0) throw new Error("removeChild target is not a child");
    this.childNodes.splice(index, 1);
    child.parentNode = null;
    return child;
  }

  addEventListener(type: string, listener: (event: MiniEvent) => void): void {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: (event: MiniEvent) => void): void {
    this.listeners.get(type)?.delete(listener);
  }

  dispatchEvent(event: MiniEvent): boolean {
    event.target ??= this;
    for (const listener of this.listeners.get(event.type) ?? []) {
      listener.call(this, event);
    }
    if (event.bubbles !== false) this.parentNode?.dispatchEvent(event);
    return true;
  }

  get textContent(): string {
    return this.childNodes.map((child) => child.textContent).join("");
  }

  set textContent(value: string) {
    for (const child of this.childNodes) child.parentNode = null;
    this.childNodes = [];
    if (value !== "") this.appendChild(this.ownerDocument.createTextNode(value));
  }
}

class MiniText extends MiniNode {
  data: string;
  nodeValue: string;

  constructor(data: string, ownerDocument: MiniDocument) {
    super(3, "#text", ownerDocument);
    this.data = data;
    this.nodeValue = data;
  }

  override get textContent(): string {
    return this.data;
  }

  override set textContent(value: string) {
    this.data = String(value);
    this.nodeValue = this.data;
  }
}

export class MiniElement extends MiniNode {
  readonly tagName: string;
  readonly localName: string;
  readonly namespaceURI: string;
  readonly attributes = new Map<string, string>();
  readonly style: Record<string, unknown> = {};

  constructor(
    tagName: string,
    ownerDocument: MiniDocument,
    namespaceURI = "http://www.w3.org/1999/xhtml",
  ) {
    super(1, tagName.toUpperCase(), ownerDocument);
    this.tagName = this.nodeName;
    this.localName = tagName.toLowerCase();
    this.namespaceURI = namespaceURI;
  }

  setAttribute(name: string, value: unknown): void {
    this.attributes.set(name, String(value));
  }

  removeAttribute(name: string): void {
    this.attributes.delete(name);
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  hasAttribute(name: string): boolean {
    return this.attributes.has(name);
  }

  focus(): void {
    this.ownerDocument.activeElement = this;
  }

  click(): void {
    this.dispatchEvent(new MiniMouseEvent("click", { bubbles: true, button: 0 }));
  }

  querySelectorAll(selector: string): MiniElement[] {
    const results: MiniElement[] = [];
    const attribute = /^\[([^=]+)="([^"]*)"\]$/.exec(selector);
    const matches = (node: MiniNode) =>
      node instanceof MiniElement &&
      (attribute
        ? node.getAttribute(attribute[1]!) === attribute[2]
        : node.localName === selector.toLowerCase());
    const visit = (node: MiniNode) => {
      for (const child of node.childNodes) {
        if (matches(child)) results.push(child as MiniElement);
        visit(child);
      }
    };
    visit(this);
    return results;
  }

  querySelector(selector: string): MiniElement | null {
    return this.querySelectorAll(selector)[0] ?? null;
  }
}

class MiniDocument extends MiniNode {
  readonly documentElement: MiniElement;
  readonly body: MiniElement;
  defaultView: typeof miniWindow | null = null;
  activeElement: MiniElement | null = null;

  constructor() {
    super(9, "#document", null as unknown as MiniDocument);
    this.ownerDocument = this;
    this.documentElement = new MiniElement("html", this);
    this.body = new MiniElement("body", this);
    this.documentElement.appendChild(this.body);
    this.appendChild(this.documentElement);
  }

  createElement(tagName: string): MiniElement {
    return new MiniElement(tagName, this);
  }

  createElementNS(namespaceURI: string, tagName: string): MiniElement {
    return new MiniElement(tagName, this, namespaceURI);
  }

  createTextNode(data: string): MiniText {
    return new MiniText(String(data), this);
  }
}

class MiniHTMLElement extends MiniElement {}
class MiniHTMLIFrameElement extends MiniHTMLElement {}
class MiniEvent {
  readonly type: string;
  target: MiniNode | null = null;
  defaultPrevented = false;
  bubbles?: boolean;
  button?: number;

  constructor(type: string, options: Record<string, unknown> = {}) {
    this.type = type;
    Object.assign(this, options);
  }

  preventDefault(): void {
    this.defaultPrevented = true;
  }

  stopPropagation(): void {}
}
class MiniMouseEvent extends MiniEvent {}

class MiniMessagePort {
  onmessage: ((event: { data: unknown }) => void) | null = null;
  peer: MiniMessagePort | null = null;
  private closed = false;

  postMessage(data: unknown): void {
    if (this.closed) return;
    queueMicrotask(() => {
      if (!this.closed) this.peer?.onmessage?.({ data });
    });
  }

  start(): void {}

  close(): void {
    this.closed = true;
  }
}

class MiniMessageChannel {
  readonly port1 = new MiniMessagePort();
  readonly port2 = new MiniMessagePort();

  constructor() {
    this.port1.peer = this.port2;
    this.port2.peer = this.port1;
  }
}

export const document = new MiniDocument();
const miniWindow = {
  document,
  event: undefined,
  HTMLElement: MiniHTMLElement,
  HTMLIFrameElement: MiniHTMLIFrameElement,
  Event: MiniEvent,
  MouseEvent: MiniMouseEvent,
  getComputedStyle: () => ({}),
};
document.defaultView = miniWindow;

Object.assign(globalThis, {
  window: miniWindow,
  document,
  HTMLElement: MiniHTMLElement,
  HTMLIFrameElement: MiniHTMLIFrameElement,
  Event: MiniEvent,
  MouseEvent: MiniMouseEvent,
  MessageChannel: MiniMessageChannel,
  IS_REACT_ACT_ENVIRONMENT: true,
});
