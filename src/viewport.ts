import type {
  ViewportComponentConstructor,
  ViewportLike,
  ViewportSettings,
} from './types.js';

export function normalizeViewportClamp(props: ViewportSettings): ViewportSettings {
  const clamp = props.clamp as { value?: unknown } | undefined;
  const clampValue = clamp?.value ?? clamp;
  if (clampValue !== true) return props;

  // pixi-viewport treats omitted/false individual bounds as the numeric value
  // zero. CanvasEngine 2.0.1 forwards boolean true directly, which therefore
  // pushes a centered camera to screenHeight instead of clamping it to the
  // world. The supported pixi-viewport representation is direction: all.
  return { ...props, clamp: { direction: 'all' } };
}

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

export function patchViewportClampConstructor(viewportClass: ViewportComponentConstructor): void {
  if (viewportClass.__arcadeClampPatchInstalled) return;

  const original = viewportClass.prototype.updateViewportSettings;
  viewportClass.prototype.updateViewportSettings = function updateViewportSettings(
    props: ViewportSettings,
  ): void {
    original.call(this, normalizeViewportClamp(props));
  };

  viewportClass.__arcadeClampPatchInstalled = true;
}
