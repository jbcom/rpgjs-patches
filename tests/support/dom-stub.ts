// CanvasEngine and Pixi read browser globals while they are imported. Node has none of them, and
// these tests never draw a pixel: they only construct component classes and call their lifecycle
// methods. Minimal inert stand-ins are enough for that.
const inertElement = () => ({
  style: {},
  addEventListener() {},
  removeEventListener() {},
  getContext() {
    return null
  },
})

const target = globalThis as Record<string, unknown>

target.window = globalThis
target.addEventListener = () => {}
target.removeEventListener = () => {}
target.document = {
  createElement: inertElement,
  addEventListener() {},
  removeEventListener() {},
  body: { appendChild() {}, removeChild() {} },
}
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: { userAgent: 'node' },
})
target.Image = class {}
target.HTMLElement = class {}
target.HTMLCanvasElement = class {}
