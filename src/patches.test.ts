import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  installCanvasEnginePatches,
  normalizeViewportClamp,
  patchSpriteAnimationLifecycleConstructor,
  patchSpriteDeferredAssetCleanupConstructor,
  patchSpriteSafeTeardownConstructor,
  patchViewportClampConstructor,
  patchViewportSafeTeardownConstructor,
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

});

describe('CanvasEngine viewport compatibility patch', () => {
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

  it('makes teardown safe when async mount never assigned tickSubscription', async () => {
    class FakeViewport {
      tickSubscription?: { unsubscribe: () => void };
      updateMask(): void {}
      updateViewportSettings(): void {}
      async onDestroy(_parent: unknown, afterDestroy: () => void): Promise<void> {
        this.tickSubscription!.unsubscribe();
        afterDestroy();
      }
    }
    const viewportClass = FakeViewport as unknown as import('./types.js').ViewportComponentConstructor;
    patchViewportSafeTeardownConstructor(viewportClass);
    const viewport = new FakeViewport();
    const afterDestroy = vi.fn();

    await expect(viewport.onDestroy(null, afterDestroy)).resolves.toBeUndefined();
    expect(afterDestroy).toHaveBeenCalledOnce();
  });
});

describe('CanvasEngine patch installer', () => {
  it('resolves and patches the registered component classes through public factories', async () => {
    const spriteClass = createSpriteConstructor();
    class FakeViewport {
      updateMask(): void {}
      updateViewportSettings(): void {}
      async onDestroy(_parent: unknown, afterDestroy: () => void): Promise<void> {
        afterDestroy();
      }
    }

    installCanvasEnginePatches({
      Sprite: () => ({ componentInstance: new (spriteClass as unknown as new () => object)() }),
      Viewport: () => ({ componentInstance: new FakeViewport() }),
    });

    const sprite = new (spriteClass as unknown as new () => {
      onDestroy: (parent: unknown, callback: () => void) => Promise<void>;
    })();

    await expect(sprite.onDestroy(null, () => undefined)).resolves.toBeUndefined();
    const viewport = new FakeViewport() as FakeViewport & {
      tickSubscription?: { unsubscribe: () => void };
    };
    await expect(viewport.onDestroy(null, () => undefined)).resolves.toBeUndefined();
  });
});
