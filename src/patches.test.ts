import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  applyViewportMaskRect,
  installCanvasEnginePatches,
  normalizeViewportClamp,
  patchSpriteAnimationLifecycleConstructor,
  patchSpriteDeferredAssetCleanupConstructor,
  patchSpriteHitboxAnchorConstructor,
  patchSpriteSafeTeardownConstructor,
  patchViewportClampConstructor,
} from './index.js';
import type { SpriteComponentConstructor } from './types.js';

function createSpriteConstructor(): SpriteComponentConstructor {
  class FakeSprite {
    anchor?: { set?: (...args: number[]) => void } | null;
    destroyed = false;
    globalLoader?: { removeAsset?: (assetId: string) => void } | null;
    trackedAssetIds = new Set<string>();
    subscriptionTick?: { unsubscribe: () => void };
    scale?: { set?: (...args: number[]) => void } | null = { set: () => undefined };
    skew?: { set?: (...args: number[]) => void } | null = { set: () => undefined };
    pivot?: { set?: (...args: number[]) => void } | null = { set: () => undefined };

    applyHitboxAnchor(): void {
      this.anchor?.set?.(0.5, 0.5);
    }

    play(): void {
      this.update({ deltaRatio: 1 });
    }

    update(): void {
      this.anchor!.set!(0.5, 0.5);
      this.scale!.set!(1, 1);
    }

    async onDestroy(_parent: unknown, afterDestroy: () => void): Promise<void> {
      this.trackedAssetIds.forEach((assetId) => this.globalLoader?.removeAsset?.(assetId));
      this.trackedAssetIds.clear();
      this.subscriptionTick!.unsubscribe();
      afterDestroy();
    }
  }

  return FakeSprite as unknown as SpriteComponentConstructor;
}

afterEach(() => {
  vi.useRealTimers();
});

describe('CanvasEngine sprite compatibility patches', () => {
  it('ignores late animation work after Pixi clears sprite transforms', () => {
    const spriteClass = createSpriteConstructor();
    patchSpriteAnimationLifecycleConstructor(spriteClass);
    const sprite = new (spriteClass as unknown as new () => {
      anchor: { set: (...args: number[]) => void } | null;
      scale: { set: (...args: number[]) => void } | null;
      play: (animation: string) => void;
      update: (tick: { deltaRatio?: number }) => void;
    })();
    const set = vi.fn();
    sprite.anchor = { set };
    sprite.scale = null;

    expect(() => sprite.play('stand')).not.toThrow();
    expect(() => sprite.update({ deltaRatio: 1 })).not.toThrow();
    expect(set).not.toHaveBeenCalled();
  });

  it('makes teardown safe when async mount never assigned subscriptionTick', async () => {
    const spriteClass = createSpriteConstructor();
    patchSpriteSafeTeardownConstructor(spriteClass);
    const sprite = new (spriteClass as unknown as new () => {
      onDestroy: (parent: unknown, callback: () => void) => Promise<void>;
    })();
    const afterDestroy = vi.fn();

    await expect(sprite.onDestroy(null, afterDestroy)).resolves.toBeUndefined();
    expect(afterDestroy).toHaveBeenCalledOnce();
  });

  it('defers tracked asset removal without losing the asset IDs', async () => {
    vi.useFakeTimers();
    const spriteClass = createSpriteConstructor();
    patchSpriteSafeTeardownConstructor(spriteClass);
    patchSpriteDeferredAssetCleanupConstructor(spriteClass, 25);
    const sprite = new (spriteClass as unknown as new () => {
      globalLoader: { removeAsset: (assetId: string) => void };
      trackedAssetIds: Set<string>;
      onDestroy: (parent: unknown, callback: () => void) => Promise<void>;
    })();
    const removeAsset = vi.fn();
    sprite.globalLoader = { removeAsset };
    sprite.trackedAssetIds.add('hero-sheet');

    await sprite.onDestroy(null, () => undefined);
    expect(removeAsset).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(25);
    expect(removeAsset).toHaveBeenCalledWith('hero-sheet');
  });

  it('skips hitbox anchoring after Pixi has destroyed the sprite', () => {
    const spriteClass = createSpriteConstructor();
    patchSpriteHitboxAnchorConstructor(spriteClass);
    const sprite = new (spriteClass as unknown as new () => {
      destroyed: boolean;
      anchor: { set: (...args: number[]) => void };
      applyHitboxAnchor: (width: number, height: number) => void;
    })();
    const set = vi.fn();
    sprite.anchor = { set };
    sprite.destroyed = true;

    sprite.applyHitboxAnchor(32, 32);
    expect(set).not.toHaveBeenCalled();
  });
});

describe('CanvasEngine viewport compatibility patch', () => {
  it('uses the Pixi 8 rect and fill drawing API', () => {
    const clear = vi.fn();
    const rect = vi.fn();
    const fill = vi.fn();

    applyViewportMaskRect({
      mask: { clear, rect, fill },
      viewport: { screenWidth: 640, screenHeight: 360 },
    });

    expect(clear).toHaveBeenCalledOnce();
    expect(rect).toHaveBeenCalledWith(0, 0, 640, 360);
    expect(fill).toHaveBeenCalledWith(0xffffff);
  });

  it('normalizes boolean clamp to pixi-viewport all-direction bounds', () => {
    expect(normalizeViewportClamp({ clamp: true, worldWidth: 1152 })).toEqual({
      clamp: { direction: 'all' },
      worldWidth: 1152,
    });
    expect(normalizeViewportClamp({ clamp: { direction: 'x' } })).toEqual({
      clamp: { direction: 'x' },
    });
  });

  it('normalizes CanvasEngine viewport settings before forwarding them', () => {
    const updateViewportSettings = vi.fn();
    class FakeViewport {
      updateViewportSettings(props: unknown): void {
        updateViewportSettings(props);
      }
    }
    const viewportClass = FakeViewport as unknown as import('./types.js').ViewportComponentConstructor;

    patchViewportClampConstructor(viewportClass);
    const viewport = new FakeViewport();
    viewport.updateViewportSettings({ clamp: true });

    expect(updateViewportSettings).toHaveBeenCalledWith({ clamp: { direction: 'all' } });
  });
});

describe('CanvasEngine patch installer', () => {
  it('resolves and patches the registered component classes through public factories', async () => {
    const spriteClass = createSpriteConstructor();
    class FakeViewport {
      updateMask(): void {}
      updateViewportSettings(): void {}
    }

    installCanvasEnginePatches({
      Sprite: () => ({ componentInstance: new (spriteClass as unknown as new () => object)() }),
      Viewport: () => ({ componentInstance: new FakeViewport() }),
    });

    const sprite = new (spriteClass as unknown as new () => {
      onDestroy: (parent: unknown, callback: () => void) => Promise<void>;
    })();

    await expect(sprite.onDestroy(null, () => undefined)).resolves.toBeUndefined();
  });
});
