import {
  patchSpriteDeferredAssetCleanupConstructor,
  patchSpriteHitboxAnchorConstructor,
  patchSpriteSafeTeardownConstructor,
} from './sprite.js';
import type { SpriteComponentConstructor, ViewportComponentConstructor } from './types.js';
import { patchViewportMaskConstructor } from './viewport.js';

type CanvasElementWithInstance = {
  componentInstance?: {
    constructor?: unknown;
  };
};

export type CanvasEnginePatchHost = {
  Sprite: (props: never) => unknown;
  Viewport: (props: never) => unknown;
};

export type InstallCanvasEnginePatchesOptions = {
  deferredAssetCleanupMs?: number;
};

export function resolveRegisteredViewportClass(
  canvasEngine: CanvasEnginePatchHost,
): ViewportComponentConstructor {
  const probe = canvasEngine.Viewport({} as never) as CanvasElementWithInstance;
  const viewportClass = probe.componentInstance?.constructor as
    | ViewportComponentConstructor
    | undefined;

  if (typeof viewportClass?.prototype?.updateMask !== 'function') {
    throw new Error('CanvasEngine Viewport component class could not be resolved');
  }

  return viewportClass;
}

export function resolveRegisteredSpriteClass(
  canvasEngine: CanvasEnginePatchHost,
): SpriteComponentConstructor {
  const probe = canvasEngine.Sprite({} as never) as CanvasElementWithInstance;
  const spriteClass = probe.componentInstance?.constructor as
    | SpriteComponentConstructor
    | undefined;

  if (
    typeof spriteClass?.prototype?.applyHitboxAnchor !== 'function' ||
    typeof spriteClass.prototype.onDestroy !== 'function'
  ) {
    throw new Error('CanvasEngine Sprite component class could not be resolved');
  }

  return spriteClass;
}

export function installCanvasEnginePatches(
  canvasEngine: CanvasEnginePatchHost,
  options: InstallCanvasEnginePatchesOptions = {},
): void {
  const spriteClass = resolveRegisteredSpriteClass(canvasEngine);

  patchViewportMaskConstructor(resolveRegisteredViewportClass(canvasEngine));
  patchSpriteHitboxAnchorConstructor(spriteClass);
  patchSpriteSafeTeardownConstructor(spriteClass);
  patchSpriteDeferredAssetCleanupConstructor(
    spriteClass,
    options.deferredAssetCleanupMs ?? 5_000,
  );
}

export {
  patchSpriteDeferredAssetCleanupConstructor,
  patchSpriteHitboxAnchorConstructor,
  patchSpriteSafeTeardownConstructor,
} from './sprite.js';
export type {
  SpriteComponentConstructor,
  SpriteInstanceWithAnchor,
  SpriteLifecycleInstance,
  ViewportComponentConstructor,
  ViewportLike,
} from './types.js';
export { applyViewportMaskRect, patchViewportMaskConstructor } from './viewport.js';
