import type { ViewportComponentConstructor, ViewportLike } from './types.js';

export function applyViewportMaskRect(target: ViewportLike): void {
  const mask = target.mask;
  const viewport = target.viewport;
  if (!mask || !viewport) return;

  mask.clear();
  mask.rect(0, 0, viewport.screenWidth ?? 0, viewport.screenHeight ?? 0);
  mask.fill(0xffffff);
}

export function patchViewportMaskConstructor(viewportClass: ViewportComponentConstructor): void {
  if (viewportClass.__arcadeMaskPatchInstalled) return;

  viewportClass.prototype.updateMask = function updateMask(this: ViewportLike): void {
    applyViewportMaskRect(this);
  };

  viewportClass.__arcadeMaskPatchInstalled = true;
}
