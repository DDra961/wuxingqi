const ctx2d = {
  fillStyle: '#000', font: '', textAlign: 'left', textBaseline: 'alphabetic',
  clearRect() {}, fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, arcTo() {}, arc() {},
  closePath() {}, fill() {}, stroke() {}, fillText() {}, measureText() { return { width: 10 }; },
};

class El {
  constructor(tag = 'div') {
    this.tagName = String(tag).toUpperCase();
    this.children = [];
    this.attrs = {};
    this.dataset = {};
    this.value = '';
    this.files = [];
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
    this.disabled = false;
    this.clientWidth = 1280;
    this.clientHeight = 720;
  }
  set innerHTML(v) { this._innerHTML = String(v); this.children = []; }
  get innerHTML() { return this._innerHTML; }
  addEventListener() {}
  removeEventListener() {}
  appendChild(c) { this.children.push(c); return c; }
  append(...c) { this.children.push(...c); }
  querySelector() { return new El(); }
  querySelectorAll() { return []; }
  closest() { return null; }
  getBoundingClientRect() { return { left: 0, top: 0, width: 1280, height: 720 }; }
  getContext() { return ctx2d; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return this.attrs[k]; }
  removeAttribute(k) { delete this.attrs[k]; }
  click() {}
  remove() {}
  focus() {}
  blur() {}
  scrollIntoView() {}
  createSVGPoint() {
    return {
      x: 0, y: 0,
      matrixTransform() { return { x: this.x, y: this.y }; },
    };
  }
  getScreenCTM() { return { inverse: () => ({}) }; }
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
globalThis.location = { protocol: 'http:', href: 'http://127.0.0.1:8765/程序/level_editor.html' };
globalThis.devicePixelRatio = 1;
globalThis.addEventListener = () => {};
globalThis.removeEventListener = () => {};
globalThis.requestAnimationFrame = () => 0;
globalThis.cancelAnimationFrame = () => {};
globalThis.setInterval = () => 0;
globalThis.clearInterval = () => {};
globalThis.fetch = () => Promise.reject(new Error('offline'));
globalThis.confirm = () => true;
try { globalThis.navigator.sendBeacon = () => true; } catch (e) {}
try {
  globalThis.URL.createObjectURL = () => 'blob:test';
  globalThis.URL.revokeObjectURL = () => {};
} catch (e) {}
const store = new Map();
globalThis.localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k),
  clear: () => store.clear(),
};
