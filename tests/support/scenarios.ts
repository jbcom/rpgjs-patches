import { vi } from 'vitest'
import {
  AssetLoaderDouble,
  deferred,
  observeFailure,
  type Subject,
  stubAssetLoad,
} from './subject.js'

/**
 * Each scenario drives one real CanvasEngine class through the sequence that triggers one defect
 * and returns what it observed. The matrix test runs every scenario twice per release, on pristine
 * classes and on patched ones, so a patch is only kept where the pristine run shows the defect.
 */

/** Where a `clamp: true` viewport leaves the camera when it is asked to look at the world's middle. */
export function viewportClampCenter(subject: Subject): { x: number; y: number } {
  const instance = new subject.ViewportClass()
  instance.viewport.screenWidth = 640
  instance.viewport.screenHeight = 360
  instance.updateViewportSettings({ worldWidth: 1152, worldHeight: 800, clamp: true })
  instance.viewport.moveCenter(576, 400)
  instance.viewport.update(1)
  const { x, y } = instance.viewport.center
  return { x, y }
}

/** A viewport retired before its asynchronous mount ever assigned the ticker subscription. */
export function viewportDestroyedBeforeMount(subject: Subject): Promise<string> {
  const instance = new subject.ViewportClass()
  return observeFailure(() => instance.onDestroy(null, () => undefined))
}

/** A sprite retired before its asynchronous mount ever assigned the tick subscription. */
export function spriteDestroyedBeforeMount(subject: Subject): Promise<string> {
  const instance = new subject.SpriteClass()
  return observeFailure(() => instance.onDestroy(null, () => undefined))
}

function playableSprite(subject: Subject) {
  const instance = new subject.SpriteClass()
  instance.spritesheet = {}
  instance.animations.set('stand', {
    frames: [[subject.pixi.Texture.EMPTY]],
    name: 'stand',
    animations: [[{ frameX: 0, frameY: 0, anchor: [0.5, 0.5], time: 0 }]],
    params: [],
    data: { spriteWidth: 32, spriteHeight: 32 },
    sprites: [],
  })
  instance.subscriptionTick = { unsubscribe: () => undefined }
  return instance
}

/** A destroyed sprite is asked to start an animation, as a late spritesheet callback would. */
export async function spritePlayAfterDestroy(subject: Subject): Promise<string> {
  const instance = playableSprite(subject)
  await instance.onDestroy(null, () => undefined)
  try {
    instance.play('stand')
    return 'clean'
  } catch (error) {
    return `threw: ${String(error)}`
  }
}

/**
 * The whole late-spritesheet sequence: a sprite begins mounting with a spritesheet definition that
 * is still pending, is destroyed, and then the definition resolves.
 */
export async function spriteMountResolvesAfterDestroy(subject: Subject): Promise<string> {
  stubAssetLoad(subject, Promise.resolve(subject.pixi.Texture.EMPTY))
  const definition = deferred<object>()
  const instance = new subject.SpriteClass()

  const mounting = observeFailure(() =>
    instance.onMount({
      props: {
        context: {
          tick: { observable: { subscribe: () => ({ unsubscribe: () => undefined }) } },
          app: () => ({ renderer: {} }),
          globalLoader: null,
        },
        sheet: { definition: definition.promise, playing: 'stand' },
      },
      propObservables: {},
    }),
  )
  await instance.onDestroy(null, () => undefined)
  definition.resolve({
    textures: {
      stand: { animations: [[{ frameX: 0, frameY: 0, anchor: [0.5, 0.5], time: 0 }]] },
    },
    width: 64,
    height: 32,
    framesWidth: 2,
    framesHeight: 1,
    image: 'sheet.png',
  })
  return mounting
}

export type AssetCleanupObservation = {
  /** Every `console.warn` the loader double and CanvasEngine produced. */
  warnings: string[]
  /** Assets still registered immediately after the sprite finished destroying. */
  registeredAfterDestroy: number
  /** Assets registered but never completed once the late load has resolved and the delay passed. */
  incompleteAfterSettling: number
}

/**
 * A sprite is destroyed while a texture load is in flight, and the load resolves afterwards.
 * Uses fake timers so the package's deferral can be waited out without a real delay.
 */
export async function spriteAssetLoadResolvesAfterDestroy(
  subject: Subject,
  settleMs: number,
): Promise<AssetCleanupObservation> {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  const load = deferred<typeof subject.pixi.Texture.EMPTY>()
  stubAssetLoad(subject, load.promise)

  const loader = new AssetLoaderDouble()
  const instance = new subject.SpriteClass()
  instance.globalLoader = loader
  instance.subscriptionTick = { unsubscribe: () => undefined }

  const textures = instance.createTextures({
    image: 'sheet.png',
    width: 64,
    height: 64,
    framesWidth: 2,
    framesHeight: 2,
    spriteWidth: 32,
    spriteHeight: 32,
  })
  await instance.onDestroy(null, () => undefined)
  const registeredAfterDestroy = loader.assets.size

  load.resolve(subject.pixi.Texture.EMPTY)
  await textures.catch(() => undefined)
  await vi.advanceTimersByTimeAsync(settleMs)

  const warnings = warn.mock.calls.map((call) => String(call[0]))
  warn.mockRestore()
  return { warnings, registeredAfterDestroy, incompleteAfterSettling: loader.incomplete }
}
