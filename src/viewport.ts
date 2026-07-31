import type {
  ViewportComponentConstructor,
  ViewportLifecycleInstance,
  ViewportSettings,
} from './types.js';

const EMPTY_SUBSCRIPTION = Object.freeze({
  unsubscribe: () => undefined,
});

export function normalizeViewportClamp(props: ViewportSettings): ViewportSettings {
  const clamp = props.clamp as { value?: unknown } | undefined;
  const clampValue = clamp?.value ?? clamp;
  if (clampValue !== true) return props;

  // pixi-viewport treats omitted/false individual bounds as the numeric value
  // zero. CanvasEngine 2.1.1 forwards boolean true directly, which therefore
  // pushes a centered camera to screenHeight instead of clamping it to the
  // world. The supported pixi-viewport representation is direction: all.
  return { ...props, clamp: { direction: 'all' } };
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

/** Guards a viewport retired before its asynchronous mount assigns the ticker subscription. */
export function patchViewportSafeTeardownConstructor(
  viewportClass: ViewportComponentConstructor,
): void {
  if (viewportClass.__arcadeSafeTeardownPatchInstalled) return;

  const onDestroy = viewportClass.prototype.onDestroy;
  viewportClass.prototype.onDestroy = function patchedSafeViewportOnDestroy(
    this: ViewportLifecycleInstance,
    parent: unknown,
    afterDestroy: () => void,
  ): Promise<void> {
    this.tickSubscription ??= EMPTY_SUBSCRIPTION;
    return onDestroy.call(this, parent, afterDestroy);
  };
  viewportClass.__arcadeSafeTeardownPatchInstalled = true;
}
