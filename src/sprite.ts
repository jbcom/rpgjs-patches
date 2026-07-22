import type {
  SpriteComponentConstructor,
  SpriteInstanceWithAnchor,
  SpriteLifecycleInstance,
  SubscriptionLike,
} from './types.js';

const NOOP_SUBSCRIPTION: SubscriptionLike = {
  unsubscribe: () => undefined,
};

export function patchSpriteHitboxAnchorConstructor(spriteClass: SpriteComponentConstructor): void {
  if (spriteClass.__arcadeHitboxAnchorPatchInstalled) return;

  const applyHitboxAnchor = spriteClass.prototype.applyHitboxAnchor;

  spriteClass.prototype.applyHitboxAnchor = function patchedApplyHitboxAnchor(
    this: SpriteInstanceWithAnchor,
    width: number,
    height: number,
    realSize?: unknown,
  ): void {
    if (this.destroyed || !this.anchor?.set) return;
    return applyHitboxAnchor.call(this, width, height, realSize);
  };

  spriteClass.__arcadeHitboxAnchorPatchInstalled = true;
}

/**
 * CanvasEngine 2.0.1 assigns subscriptionTick inside async onMount(), but a
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
