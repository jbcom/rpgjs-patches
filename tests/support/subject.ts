import { vi } from 'vitest'
import type { CanvasEnginePatchHost } from '../../src/index.js'

type Point = { set: (...args: number[]) => void } | null

/** The members of CanvasEngine's `CanvasSprite` that the scenarios drive. They are private upstream. */
export type SpriteHandle = {
  destroyed: boolean
  anchor: Point
  spritesheet: unknown
  animations: Map<string, unknown>
  globalLoader: AssetLoaderDouble | null
  trackedAssetIds: Set<string>
  subscriptionTick: { unsubscribe: () => void } | undefined
  play: (name: string, params?: unknown[]) => void
  update: (tick: { deltaRatio: number }) => void
  onMount: (element: unknown) => Promise<void>
  onDestroy: (parent: unknown, afterDestroy: () => void) => Promise<void>
  createTextures: (options: Record<string, unknown>) => Promise<unknown>
}

/** The members of CanvasEngine's `CanvasViewport` that the scenarios drive. */
export type ViewportHandle = {
  viewport: {
    screenWidth: number
    screenHeight: number
    center: { x: number; y: number }
    moveCenter: (x: number, y: number) => void
    update: (elapsed: number) => void
  }
  updateViewportSettings: (props: Record<string, unknown>) => void
  onDestroy: (parent: unknown, afterDestroy: () => void) => Promise<void>
}

/**
 * Stands in for CanvasEngine's `GlobalAssetLoader`, which the package does not export. It keeps the
 * two behaviors the patches care about: `removeAsset` forgets an id, and reporting progress for an
 * id the loader no longer knows logs "not found in tracker" through `console.warn`.
 */
export class AssetLoaderDouble {
  readonly assets = new Map<string, boolean>()
  private counter = 0

  registerAsset(path: string): string {
    const id = `asset_${this.counter++}_${path}`
    this.assets.set(id, false)
    return id
  }

  updateProgress(id: string, _progress: number): void {
    if (!this.assets.has(id)) console.warn(`Asset ${id} not found in tracker`)
  }

  completeAsset(id: string): void {
    if (!this.assets.has(id)) console.warn(`Asset ${id} not found in tracker`)
    else this.assets.set(id, true)
  }

  removeAsset(id: string): void {
    this.assets.delete(id)
  }

  get incomplete(): number {
    return [...this.assets.values()].filter((completed) => !completed).length
  }
}

type PixiModule = typeof import('pixi.js')
type SpriteConstructor = new () => SpriteHandle
type ViewportConstructor = new () => ViewportHandle

export type Subject = {
  version: string
  /** Fresh subclasses, so one scenario's patches never leak into the next. */
  SpriteClass: SpriteConstructor
  ViewportClass: ViewportConstructor
  /** The factories shape `installCanvasEnginePatches` takes, resolving to the fresh subclasses. */
  host: CanvasEnginePatchHost
  pixi: PixiModule
}

/** Loads one CanvasEngine release and returns pristine copies of its Sprite and Viewport classes. */
export async function createSubject(version: string): Promise<Subject> {
  const quiet = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  const canvasEngine = (await import(`canvasengine-${version}`)) as {
    Sprite: (props: object) => { componentInstance: { constructor: SpriteConstructor } }
    Viewport: (props: object) => { componentInstance: { constructor: ViewportConstructor } }
  }
  quiet.mockRestore()
  const pixi = await import('pixi.js')

  class SpriteClass extends canvasEngine.Sprite({}).componentInstance.constructor {}
  class ViewportClass extends canvasEngine.Viewport({}).componentInstance.constructor {}

  return {
    version,
    SpriteClass,
    ViewportClass,
    host: {
      Sprite: () => ({ componentInstance: new SpriteClass() }),
      Viewport: () => ({ componentInstance: new ViewportClass() }),
    },
    pixi,
  }
}

/**
 * Runs `run` and reports whether it failed, either by rejecting or by leaving an unhandled
 * rejection behind. CanvasEngine's teardown wraps its cleanup in a promise nobody awaits, so the
 * defect surfaces as an unhandled rejection that the test runner would otherwise treat as its own
 * failure. The runner's listeners are lifted for the duration and restored afterwards.
 */
export async function observeFailure(run: () => Promise<unknown>): Promise<string> {
  const runnerListeners = process.listeners('unhandledRejection')
  process.removeAllListeners('unhandledRejection')
  const unhandled: unknown[] = []
  process.on('unhandledRejection', (reason) => unhandled.push(reason))
  try {
    await run()
    await new Promise((resolve) => setTimeout(resolve, 20))
    return unhandled.length > 0 ? `unhandled: ${String(unhandled[0])}` : 'clean'
  } catch (error) {
    return `threw: ${String(error)}`
  } finally {
    process.removeAllListeners('unhandledRejection')
    for (const listener of runnerListeners) process.on('unhandledRejection', listener)
  }
}

/** Makes Pixi's `Assets.load` answer with `result`, so a test decides when a texture load settles. */
export function stubAssetLoad(subject: Subject, result: Promise<unknown>): void {
  // Assets.load is generic over the asset type; the stand-in resolves with whatever the test chose.
  vi.spyOn(subject.pixi.Assets, 'load').mockReturnValue(result as never)
}

export function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
