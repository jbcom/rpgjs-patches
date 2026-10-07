import { isPatchInstalled, markPatchInstalled, type PatchOutcome } from './markers.js'
import type {
  SpriteAnimationLifecycleInstance,
  SpriteComponentConstructor,
  SpriteLifecycleInstance,
  SubscriptionLike,
} from './types.js'

const NOOP_SUBSCRIPTION: SubscriptionLike = {
  unsubscribe: () => undefined,
}

/**
 * CanvasEngine 2.4.0 guards sprite initialization against teardown with an `isDisposed` getter on
 * the sprite class: every `await` in the spritesheet load is followed by a check, `play()` refuses a
 * destroyed sprite, and progress for an asset the sprite no longer tracks is ignored. Releases
 * before 2.4.0 have none of that. The presence of the getter is how the two late-work patches tell
 * that upstream already fixed their defects.
 */
export function hasUpstreamSpriteLifecycleGuard(spriteClass: SpriteComponentConstructor): boolean {
  // Walk the chain so a subclass of the registered sprite class is recognized too.
  for (
    let prototype: object | null = spriteClass.prototype;
    prototype !== null;
    prototype = Object.getPrototypeOf(prototype)
  ) {
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'isDisposed')
    if (descriptor) return typeof descriptor.get === 'function'
  }
  return false
}

const hasLiveTransforms = (sprite: SpriteAnimationLifecycleInstance): boolean =>
  !sprite.destroyed &&
  typeof sprite.anchor?.set === 'function' &&
  typeof sprite.scale?.set === 'function' &&
  typeof sprite.skew?.set === 'function' &&
  typeof sprite.pivot?.set === 'function'

/**
 * Before CanvasEngine 2.4.0, an async spritesheet mount could finish after Pixi had destroyed the
 * retiring sprite. `play()` immediately calls `update()`, which writes animation transforms through
 * Pixi points that teardown set to null. Skip animation work once the transforms are gone.
 *
 * A no-op on CanvasEngine 2.4.0 and later, which stop the load and refuse `play()` themselves.
 */
export function patchSpriteAnimationLifecycleConstructor(
  spriteClass: SpriteComponentConstructor,
): PatchOutcome {
  if (isPatchInstalled(spriteClass, 'spriteAnimationLifecycle')) return 'already-applied'
  if (hasUpstreamSpriteLifecycleGuard(spriteClass)) return 'not-needed'

  const play = spriteClass.prototype.play
  const update = spriteClass.prototype.update

  spriteClass.prototype.play = function patchedLifecycleSafePlay(
    this: SpriteAnimationLifecycleInstance,
    animation: string,
    params: unknown[] = [],
  ): void {
    if (hasLiveTransforms(this)) play.call(this, animation, params)
  }

  spriteClass.prototype.update = function patchedLifecycleSafeUpdate(
    this: SpriteAnimationLifecycleInstance,
    tick: { deltaRatio?: number },
  ): void {
    if (hasLiveTransforms(this)) update.call(this, tick)
  }

  markPatchInstalled(spriteClass, 'spriteAnimationLifecycle')
  return 'applied'
}

/**
 * CanvasEngine assigns `subscriptionTick` inside the async `onMount()`, but a fast scene
 * replacement can destroy a sprite before `onMount()` reaches that line. `onDestroy()` then calls
 * `subscriptionTick.unsubscribe()` on `undefined`. Give it an inert subscription to release.
 */
export function patchSpriteSafeTeardownConstructor(
  spriteClass: SpriteComponentConstructor,
): PatchOutcome {
  if (isPatchInstalled(spriteClass, 'spriteSafeTeardown')) return 'already-applied'

  const onDestroy = spriteClass.prototype.onDestroy

  spriteClass.prototype.onDestroy = function patchedSafeSpriteOnDestroy(
    this: SpriteLifecycleInstance,
    parent: unknown,
    afterDestroy: () => void,
  ): Promise<void> {
    this.subscriptionTick ??= NOOP_SUBSCRIPTION
    return onDestroy.call(this, parent, afterDestroy)
  }

  markPatchInstalled(spriteClass, 'spriteSafeTeardown')
  return 'applied'
}

/**
 * Before CanvasEngine 2.4.0, sprite teardown removed its tracked assets from the global loader at
 * once, while a texture load still in flight went on to report progress for an id the loader no
 * longer knew, and the loader logged "not found in tracker" for each. Hold the removals back until
 * pending callbacks have had time to settle.
 *
 * A no-op on CanvasEngine 2.4.0 and later, and it must stay one: those releases ignore progress for
 * ids the sprite no longer tracks, so deferring the removal there would leave the abandoned asset
 * registered and incomplete, stalling the loader's overall progress for the whole delay.
 */
export function patchSpriteDeferredAssetCleanupConstructor(
  spriteClass: SpriteComponentConstructor,
  delayMs = 5_000,
): PatchOutcome {
  if (isPatchInstalled(spriteClass, 'spriteDeferredAssetCleanup')) return 'already-applied'
  if (hasUpstreamSpriteLifecycleGuard(spriteClass)) return 'not-needed'

  const onDestroy = spriteClass.prototype.onDestroy

  spriteClass.prototype.onDestroy = async function patchedDeferredSpriteOnDestroy(
    this: SpriteLifecycleInstance,
    parent: unknown,
    afterDestroy: () => void,
  ): Promise<void> {
    const loader = this.globalLoader
    const trackedAssetIds = this.trackedAssetIds
    const deferredAssetIds = trackedAssetIds ? Array.from(trackedAssetIds) : []

    trackedAssetIds?.clear()
    const result = await onDestroy.call(this, parent, afterDestroy)

    if (loader?.removeAsset && deferredAssetIds.length > 0) {
      setTimeout(() => {
        for (const assetId of deferredAssetIds) loader.removeAsset?.(assetId)
      }, delayMs)
    }

    return result
  }

  markPatchInstalled(spriteClass, 'spriteDeferredAssetCleanup')
  return 'applied'
}
