import type {
  SpriteAnimationLifecycleInstance,
  SpriteComponentConstructor,
  SpriteLifecycleInstance,
  SubscriptionLike,
} from './types.js';

const NOOP_SUBSCRIPTION: SubscriptionLike = {
  unsubscribe: () => undefined,
};

const hasLiveTransforms = (sprite: SpriteAnimationLifecycleInstance): boolean =>
  !sprite.destroyed &&
  typeof sprite.anchor?.set === 'function' &&
  typeof sprite.scale?.set === 'function' &&
  typeof sprite.skew?.set === 'function' &&
  typeof sprite.pivot?.set === 'function';

/**
 * CanvasEngine can finish an async spritesheet mount after Pixi has destroyed
 * the retiring Sprite. Its play() path immediately calls update(), which then
 * writes animation transforms through Pixi points that teardown set to null.
 */
export function patchSpriteAnimationLifecycleConstructor(
  spriteClass: SpriteComponentConstructor,
): void {
  if (spriteClass.__arcadeAnimationLifecyclePatchInstalled) return;

  const play = spriteClass.prototype.play;
  const update = spriteClass.prototype.update;

  spriteClass.prototype.play = function patchedLifecycleSafePlay(
    this: SpriteAnimationLifecycleInstance,
    animation: string,
    params: unknown[] = [],
  ): void {
    if (!hasLiveTransforms(this)) return;
    return play.call(this, animation, params);
  };

  spriteClass.prototype.update = function patchedLifecycleSafeUpdate(
    this: SpriteAnimationLifecycleInstance,
    tick: { deltaRatio?: number },
  ): void {
    if (!hasLiveTransforms(this)) return;
    return update.call(this, tick);
  };

  spriteClass.__arcadeAnimationLifecyclePatchInstalled = true;
}

/**
 * CanvasEngine 2.1.1 assigns subscriptionTick inside async onMount(), but a
 * fast map replacement can destroy a Sprite before onMount reaches that line.
 * Its onDestroy() then unconditionally calls subscriptionTick.unsubscribe().
 */
export function patchSpriteSafeTeardownConstructor(spriteClass: SpriteComponentConstructor): void {
  if (spriteClass.__arcadeSafeTeardownPatchInstalled) return;

  const onDestroy = spriteClass.prototype.onDestroy;

  spriteClass.prototype.onDestroy = function patchedSafeSpriteOnDestroy(
    this: SpriteLifecycleInstance,
    parent: unknown,
    afterDestroy: () => void,
  ): Promise<void> {
    this.subscriptionTick ??= NOOP_SUBSCRIPTION;
    return onDestroy.call(this, parent, afterDestroy);
  };

  spriteClass.__arcadeSafeTeardownPatchInstalled = true;
}

/**
 * CanvasEngine removes tracked asset IDs immediately during Sprite teardown.
 * Pixi can still complete an async texture load after a fast map replacement,
 * so defer those removals until pending callbacks have had time to settle.
 */
export function patchSpriteDeferredAssetCleanupConstructor(
  spriteClass: SpriteComponentConstructor,
  delayMs = 5_000,
): void {
  if (spriteClass.__arcadeDeferredAssetCleanupPatchInstalled) return;

  const onDestroy = spriteClass.prototype.onDestroy;

  spriteClass.prototype.onDestroy = async function patchedDeferredSpriteOnDestroy(
    this: SpriteLifecycleInstance,
    parent: unknown,
    afterDestroy: () => void,
  ): Promise<void> {
    const loader = this.globalLoader;
    const trackedAssetIds = this.trackedAssetIds;
    const deferredAssetIds = trackedAssetIds ? Array.from(trackedAssetIds) : [];

    trackedAssetIds?.clear();
    const result = await onDestroy.call(this, parent, afterDestroy);

    if (loader?.removeAsset && deferredAssetIds.length > 0) {
      setTimeout(() => {
        for (const assetId of deferredAssetIds) loader.removeAsset?.(assetId);
      }, delayMs);
    }

    return result;
  };

  spriteClass.__arcadeDeferredAssetCleanupPatchInstalled = true;
}
