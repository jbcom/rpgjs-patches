// Runs inside a scratch consumer project that has installed rpgjs-patches (from a packed tarball or
// from npmjs) and one CanvasEngine release from npmjs. It imports the package through both entry
// points, installs it against the real CanvasEngine classes, and checks the repair, so what ships
// is proven against what a game would actually install. scripts/consumer-smoke.mjs copies this file
// into each consumer.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

// CanvasEngine and Pixi read browser globals while they load; nothing here draws.
globalThis.window = globalThis
globalThis.addEventListener = () => {}
globalThis.removeEventListener = () => {}
globalThis.document = {
  createElement: () => ({
    style: {},
    addEventListener() {},
    removeEventListener() {},
    getContext: () => null,
  }),
  addEventListener() {},
  removeEventListener() {},
  body: { appendChild() {}, removeChild() {} },
}
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: { userAgent: 'node' },
})
globalThis.Image = class {}
globalThis.HTMLElement = class {}
globalThis.HTMLCanvasElement = class {}

const require = createRequire(import.meta.url)
const esm = await import('rpgjs-patches')
const cjs = require('rpgjs-patches')
const manifest = require('rpgjs-patches/package.json')

const originalWarn = console.warn
console.warn = () => {}
const canvasEngine = await import('canvasengine')
console.warn = originalWarn
const canvasEngineVersion = require('canvasengine/package.json').version
const [major, minor] = canvasEngineVersion.split('.').map(Number)
const upstreamGuardsSprite = major > 2 || (major === 2 && minor >= 4)

for (const entry of [esm, cjs]) {
  for (const name of [
    'installCanvasEnginePatches',
    'normalizeViewportClamp',
    'hasUpstreamSpriteLifecycleGuard',
    'patchViewportClampConstructor',
    'patchViewportSafeTeardownConstructor',
    'patchSpriteSafeTeardownConstructor',
    'patchSpriteAnimationLifecycleConstructor',
    'patchSpriteDeferredAssetCleanupConstructor',
  ]) {
    assert.equal(typeof entry[name], 'function', `${name} is missing from an entry point`)
  }
}

const spriteClass = canvasEngine.Sprite({}).componentInstance.constructor
const viewportClass = canvasEngine.Viewport({}).componentInstance.constructor
assert.equal(esm.hasUpstreamSpriteLifecycleGuard(spriteClass), upstreamGuardsSprite)

async function destroyOutcome(instance) {
  const unhandled = []
  const listener = (reason) => unhandled.push(reason)
  process.on('unhandledRejection', listener)
  try {
    await instance.onDestroy(null, () => {})
    await new Promise((resolve) => setTimeout(resolve, 20))
  } finally {
    process.removeListener('unhandledRejection', listener)
  }
  return unhandled.length === 0 ? 'clean' : String(unhandled[0])
}

function clampedCenter() {
  const instance = new viewportClass()
  instance.viewport.screenWidth = 640
  instance.viewport.screenHeight = 360
  instance.updateViewportSettings({ worldWidth: 1152, worldHeight: 800, clamp: true })
  instance.viewport.moveCenter(576, 400)
  instance.viewport.update(1)
  return { x: instance.viewport.center.x, y: instance.viewport.center.y }
}

// Before installation the defects are real in the installed release.
assert.ok(clampedCenter().x < 0, 'expected the unpatched clamp: true defect')
assert.match(await destroyOutcome(new viewportClass()), /unsubscribe/)
assert.match(await destroyOutcome(new spriteClass()), /unsubscribe/)

const report = esm.installCanvasEnginePatches(canvasEngine)
assert.deepEqual(report, {
  viewportClamp: 'applied',
  viewportSafeTeardown: 'applied',
  spriteAnimationLifecycle: upstreamGuardsSprite ? 'not-needed' : 'applied',
  spriteSafeTeardown: 'applied',
  spriteDeferredAssetCleanup: upstreamGuardsSprite ? 'not-needed' : 'applied',
})

// The CommonJS copy sees the ESM copy's work and wraps nothing a second time.
const wrapped = [
  spriteClass.prototype.onDestroy,
  spriteClass.prototype.play,
  viewportClass.prototype.onDestroy,
  viewportClass.prototype.updateViewportSettings,
]
const second = cjs.installCanvasEnginePatches(canvasEngine)
assert.deepEqual(
  second,
  Object.fromEntries(
    Object.entries(report).map(([name, outcome]) => [
      name,
      outcome === 'applied' ? 'already-applied' : outcome,
    ]),
  ),
)
assert.deepEqual(wrapped, [
  spriteClass.prototype.onDestroy,
  spriteClass.prototype.play,
  viewportClass.prototype.onDestroy,
  viewportClass.prototype.updateViewportSettings,
])

assert.deepEqual(clampedCenter(), { x: 576, y: 400 })
assert.equal(await destroyOutcome(new viewportClass()), 'clean')
assert.equal(await destroyOutcome(new spriteClass()), 'clean')

console.log(
  `rpgjs-patches ${manifest.version} against canvasengine ${canvasEngineVersion}: ` +
    `${Object.values(report).filter((outcome) => outcome === 'applied').length} patches applied, ` +
    `${Object.values(report).filter((outcome) => outcome === 'not-needed').length} not needed`,
)
