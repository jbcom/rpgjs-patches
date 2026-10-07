// Fast, release-independent tests of the patch mechanics against hand-written stand-in classes.
// What the patches do to the real CanvasEngine classes is proven in canvasengine-matrix.test.ts.
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  hasUpstreamSpriteLifecycleGuard,
  installCanvasEnginePatches,
  normalizeViewportClamp,
  patchSpriteAnimationLifecycleConstructor,
  patchSpriteDeferredAssetCleanupConstructor,
  patchSpriteSafeTeardownConstructor,
  patchViewportClampConstructor,
  patchViewportSafeTeardownConstructor,
  type SpriteComponentConstructor,
  type ViewportComponentConstructor,
} from '../src/index.js'

type Point = { set?: (...args: number[]) => void } | null

class StandInSprite {
  anchor: Point = { set: () => undefined }
  scale: Point = { set: () => undefined }
  skew: Point = { set: () => undefined }
  pivot: Point = { set: () => undefined }
  destroyed = false
  globalLoader?: { removeAsset?: (assetId: string) => void } | null
  trackedAssetIds = new Set<string>()
  subscriptionTick?: { unsubscribe: () => void }

  play(_animation: string, _params?: unknown[]): void {
    this.update({ deltaRatio: 1 })
  }

  update(_tick: { deltaRatio?: number }): void {
    this.anchor?.set?.(0.5, 0.5)
    this.scale?.set?.(1, 1)
  }

  async onDestroy(_parent: unknown, afterDestroy: () => void): Promise<void> {
    for (const assetId of this.trackedAssetIds) this.globalLoader?.removeAsset?.(assetId)
    this.trackedAssetIds.clear()
    if (!this.subscriptionTick) throw new TypeError('subscriptionTick is undefined')
    this.subscriptionTick.unsubscribe()
    afterDestroy()
  }
}

class StandInViewport {
  tickSubscription?: { unsubscribe: () => void }
  seen: unknown[] = []

  updateViewportSettings(props: unknown): void {
    this.seen.push(props)
  }

  async onDestroy(_parent: unknown, afterDestroy: () => void): Promise<void> {
    if (!this.tickSubscription) throw new TypeError('tickSubscription is undefined')
    afterDestroy()
  }
}

const asSprite = (cls: unknown) => cls as SpriteComponentConstructor
const asViewport = (cls: unknown) => cls as ViewportComponentConstructor

afterEach(() => {
  vi.useRealTimers()
})

describe('normalizeViewportClamp', () => {
  it('rewrites boolean true, bare or wrapped in a reactive signal, to the all-edges form', () => {
    expect(normalizeViewportClamp({ clamp: true, worldWidth: 1152 })).toEqual({
      clamp: { direction: 'all' },
      worldWidth: 1152,
    })
    expect(normalizeViewportClamp({ clamp: { value: true } })).toEqual({
      clamp: { direction: 'all' },
    })
  })

  it('leaves every other clamp, and the props object itself, alone', () => {
    const explicit = { clamp: { direction: 'x' } }
    expect(normalizeViewportClamp(explicit)).toBe(explicit)
    const absent = { worldWidth: 10 }
    expect(normalizeViewportClamp(absent)).toBe(absent)
    const off = { clamp: false }
    expect(normalizeViewportClamp(off)).toBe(off)
  })
})

describe('viewport patches', () => {
  it('forwards a normalized clamp to the original method', () => {
    class Viewport extends StandInViewport {}
    expect(patchViewportClampConstructor(asViewport(Viewport))).toBe('applied')
    const viewport = new Viewport()
    viewport.updateViewportSettings({ clamp: true })
    expect(viewport.seen).toEqual([{ clamp: { direction: 'all' } }])
  })

  it('releases an inert subscription when teardown beats the mount', async () => {
    class Viewport extends StandInViewport {}
    expect(patchViewportSafeTeardownConstructor(asViewport(Viewport))).toBe('applied')
    const afterDestroy = vi.fn()
    await expect(new Viewport().onDestroy(null, afterDestroy)).resolves.toBeUndefined()
    expect(afterDestroy).toHaveBeenCalledOnce()
  })

  it('keeps a real subscription when mount won the race', async () => {
    class Viewport extends StandInViewport {}
    patchViewportSafeTeardownConstructor(asViewport(Viewport))
    const unsubscribe = vi.fn()
    const viewport = new Viewport()
    viewport.tickSubscription = { unsubscribe }
    await viewport.onDestroy(null, () => undefined)
    expect(viewport.tickSubscription.unsubscribe).toBe(unsubscribe)
  })
})

describe('sprite patches', () => {
  it('releases an inert subscription when teardown beats the mount', async () => {
    class Sprite extends StandInSprite {}
    expect(patchSpriteSafeTeardownConstructor(asSprite(Sprite))).toBe('applied')
    const afterDestroy = vi.fn()
    await expect(new Sprite().onDestroy(null, afterDestroy)).resolves.toBeUndefined()
    expect(afterDestroy).toHaveBeenCalledOnce()
  })

  it('skips animation work once Pixi has cleared the transform points', () => {
    class Sprite extends StandInSprite {}
    expect(patchSpriteAnimationLifecycleConstructor(asSprite(Sprite))).toBe('applied')
    const sprite = new Sprite()
    const set = vi.fn()
    sprite.anchor = { set }
    sprite.scale = null

    expect(() => sprite.play('stand')).not.toThrow()
    expect(() => sprite.update({ deltaRatio: 1 })).not.toThrow()
    expect(set).not.toHaveBeenCalled()
  })

  it('skips animation work on a sprite flagged destroyed, and runs it on a live one', () => {
    class Sprite extends StandInSprite {}
    patchSpriteAnimationLifecycleConstructor(asSprite(Sprite))
    const set = vi.fn()
    const live = new Sprite()
    live.anchor = { set }
    live.play('stand')
    expect(set).toHaveBeenCalledOnce()

    const gone = new Sprite()
    gone.anchor = { set }
    gone.destroyed = true
    gone.play('stand')
    expect(set).toHaveBeenCalledOnce()
  })

  it('defers tracked asset removal without losing the asset ids', async () => {
    vi.useFakeTimers()
    class Sprite extends StandInSprite {}
    patchSpriteSafeTeardownConstructor(asSprite(Sprite))
    expect(patchSpriteDeferredAssetCleanupConstructor(asSprite(Sprite), 25)).toBe('applied')
    const removeAsset = vi.fn()
    const sprite = new Sprite()
    sprite.globalLoader = { removeAsset }
    sprite.trackedAssetIds.add('sheet-one')

    await sprite.onDestroy(null, () => undefined)
    expect(removeAsset).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(25)
    expect(removeAsset).toHaveBeenCalledExactlyOnceWith('sheet-one')
  })

  it('schedules nothing when the sprite tracked no assets or has no loader', async () => {
    vi.useFakeTimers()
    class Sprite extends StandInSprite {}
    patchSpriteSafeTeardownConstructor(asSprite(Sprite))
    patchSpriteDeferredAssetCleanupConstructor(asSprite(Sprite), 25)
    await new Sprite().onDestroy(null, () => undefined)
    const unloaded = new Sprite()
    unloaded.trackedAssetIds.add('orphan')
    await unloaded.onDestroy(null, () => undefined)
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('upstream lifecycle guard detection', () => {
  class GuardedSprite extends StandInSprite {
    get isDisposed(): boolean {
      return this.destroyed
    }
  }

  it('recognizes the isDisposed getter, including through a subclass', () => {
    class Subclass extends GuardedSprite {}
    expect(hasUpstreamSpriteLifecycleGuard(asSprite(StandInSprite))).toBe(false)
    expect(hasUpstreamSpriteLifecycleGuard(asSprite(GuardedSprite))).toBe(true)
    expect(hasUpstreamSpriteLifecycleGuard(asSprite(Subclass))).toBe(true)
  })

  it('does not take a plain isDisposed field for the upstream getter', () => {
    class Plain extends StandInSprite {
      isDisposed = false
    }
    expect(hasUpstreamSpriteLifecycleGuard(asSprite(Plain))).toBe(false)
  })

  it('leaves the late-work methods untouched on a guarded class', () => {
    class Guarded extends GuardedSprite {}
    const { play, update, onDestroy } = Guarded.prototype
    expect(patchSpriteAnimationLifecycleConstructor(asSprite(Guarded))).toBe('not-needed')
    expect(patchSpriteDeferredAssetCleanupConstructor(asSprite(Guarded))).toBe('not-needed')
    expect(Guarded.prototype.play).toBe(play)
    expect(Guarded.prototype.update).toBe(update)
    expect(Guarded.prototype.onDestroy).toBe(onDestroy)
  })
})

describe('installCanvasEnginePatches', () => {
  const hostFor = (Sprite: new () => object, Viewport: new () => object) => ({
    Sprite: () => ({ componentInstance: new Sprite() }),
    Viewport: () => ({ componentInstance: new Viewport() }),
  })

  it('patches the classes the public factories resolve and is idempotent', async () => {
    class Sprite extends StandInSprite {}
    class Viewport extends StandInViewport {}
    const host = hostFor(Sprite, Viewport)

    expect(installCanvasEnginePatches(host)).toEqual({
      viewportClamp: 'applied',
      viewportSafeTeardown: 'applied',
      spriteAnimationLifecycle: 'applied',
      spriteSafeTeardown: 'applied',
      spriteDeferredAssetCleanup: 'applied',
    })
    const installed = [Sprite.prototype.onDestroy, Viewport.prototype.onDestroy]

    expect(Object.values(installCanvasEnginePatches(host))).toEqual(
      Array(5).fill('already-applied'),
    )
    expect([Sprite.prototype.onDestroy, Viewport.prototype.onDestroy]).toEqual(installed)

    await expect(new Sprite().onDestroy(null, () => undefined)).resolves.toBeUndefined()
    await expect(new Viewport().onDestroy(null, () => undefined)).resolves.toBeUndefined()
  })

  it('treats a second copy of the package as the first: markers live on the class', () => {
    class Sprite extends StandInSprite {}
    class Viewport extends StandInViewport {}
    installCanvasEnginePatches(hostFor(Sprite, Viewport))
    const wrapped = Sprite.prototype.onDestroy
    for (const name of [
      'viewportClamp',
      'viewportSafeTeardown',
      'spriteSafeTeardown',
      'spriteAnimationLifecycle',
      'spriteDeferredAssetCleanup',
    ]) {
      const owner = name.startsWith('viewport') ? Viewport : Sprite
      expect(Reflect.get(owner, Symbol.for(`rpgjs-patches:${name}`)), name).toBe(true)
    }
    patchSpriteSafeTeardownConstructor(asSprite(Sprite))
    expect(Sprite.prototype.onDestroy).toBe(wrapped)
  })

  it('fails closed, changing nothing, when a factory cannot resolve its class', () => {
    class Sprite extends StandInSprite {}
    const before = Sprite.prototype.play

    expect(() =>
      installCanvasEnginePatches({
        Sprite: () => ({ componentInstance: {} }),
        Viewport: () => ({ componentInstance: {} }),
      }),
    ).toThrow('CanvasEngine Sprite component class could not be resolved')

    expect(() =>
      installCanvasEnginePatches({
        Sprite: () => ({ componentInstance: new Sprite() }),
        Viewport: () => ({ componentInstance: {} }),
      }),
    ).toThrow('CanvasEngine Viewport component class could not be resolved')
    expect(Sprite.prototype.play).toBe(before)
  })
})
