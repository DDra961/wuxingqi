const ctx2d = {
  canvas: null,
  fillStyle: '#000', strokeStyle: '#000', font: '', textAlign: 'left', textBaseline: 'alphabetic',
  globalAlpha: 1, lineWidth: 1,
  clearRect() {}, fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, arcTo() {}, arc() {},
  closePath() {}, fill() {}, stroke() {}, fillText() {}, strokeText() {}, save() {}, restore() {},
  translate() {}, scale() {}, rotate() {},
  measureText() { return { width: 10 }; },
};

class El {
  constructor(tag = 'div') {
    this.tagName = String(tag).toUpperCase();
    this.children = [];
    this.dataset = {};
    this.style = { setProperty() {}, removeProperty() {} };
    const set = new Set();
    this.classList = {
      add: (...a) => a.forEach(x => set.add(x)),
      remove: (...a) => a.forEach(x => set.delete(x)),
      toggle: (c, f) => {
        if (f === undefined) { set.has(c) ? set.delete(c) : set.add(c); return set.has(c); }
        f ? set.add(c) : set.delete(c);
        return f;
      },
      contains: c => set.has(c),
    };
    this._innerHTML = '';
    this.textContent = '';
    this.width = 256;
    this.height = 80;
    this.clientWidth = 1280;
    this.clientHeight = 720;
    this.disabled = false;
    this.value = '';
    this.scrollTop = 0;
  }
  set innerHTML(v) { this._innerHTML = String(v); this.children = []; }
  get innerHTML() { return this._innerHTML; }
  addEventListener() {}
  removeEventListener() {}
  appendChild(c) { this.children.push(c); return c; }
  append(...c) { this.children.push(...c); }
  querySelector() { return new El(); }
  querySelectorAll() { return []; }
  getBoundingClientRect() { return { left: 0, top: 0, width: 1280, height: 720 }; }
  getContext() { return ctx2d; }
  load() {}
  play() { return Promise.resolve(); }
  pause() {}
  setAttribute() {}
  getAttribute() { return null; }
  focus() {}
  blur() {}
}

const byId = new Map();
const document = {
  getElementById(id) {
    if (!byId.has(id)) byId.set(id, new El('div'));
    return byId.get(id);
  },
  createElement(tag) { return new El(tag); },
  createElementNS(ns, tag) { return new El(tag); },
  querySelector() { return new El(); },
  querySelectorAll() { return []; },
  addEventListener() {},
  body: new El('body'),
};

globalThis.window = globalThis;
globalThis.self = globalThis;
globalThis.document = document;
globalThis.devicePixelRatio = 1;
globalThis.addEventListener = () => {};
globalThis.removeEventListener = () => {};
globalThis.requestAnimationFrame = () => 0;
globalThis.cancelAnimationFrame = () => {};
globalThis.setInterval = () => 0;
globalThis.clearInterval = () => {};
globalThis.fetch = () => Promise.reject(new Error('offline'));
try { globalThis.navigator.sendBeacon = () => true; } catch (e) {}
const store = new Map();
globalThis.localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k),
  clear: () => store.clear(),
};
