import { isPatchInstalled, markPatchInstalled, type PatchOutcome } from './markers.js'
import type {
  SubscriptionLike,
  ViewportComponentConstructor,
  ViewportLifecycleInstance,
  ViewportSettings,
} from './types.js'

const EMPTY_SUBSCRIPTION: SubscriptionLike = Object.freeze({
  unsubscribe: () => undefined,
})

/**
 * CanvasEngine forwards `clamp: true` straight to pixi-viewport's `clamp()`. pixi-viewport reads
 * omitted bounds as the number zero, so a centered camera is pushed to a negative position instead
 * of being kept inside the world. The supported all-edges form is `{ direction: 'all' }`.
 */
export function normalizeViewportClamp(props: ViewportSettings): ViewportSettings {
  const clamp = props.clamp as { value?: unknown } | undefined
  const clampValue = clamp?.value ?? clamp
  if (clampValue !== true) return props

  return { ...props, clamp: { direction: 'all' } }
}

/** Rewrites a boolean `clamp: true` into the all-edges form before CanvasEngine applies it. */
export function patchViewportClampConstructor(
  viewportClass: ViewportComponentConstructor,
): PatchOutcome {
  if (isPatchInstalled(viewportClass, 'viewportClamp')) return 'already-applied'

  const original = viewportClass.prototype.updateViewportSettings
  viewportClass.prototype.updateViewportSettings = function updateViewportSettings(
    props: ViewportSettings,
  ): void {
    original.call(this, normalizeViewportClamp(props))
  }

  markPatchInstalled(viewportClass, 'viewportClamp')
  return 'applied'
}

/**
 * A viewport retired before its asynchronous mount assigns the ticker subscription would make
 * CanvasEngine call `unsubscribe()` on `undefined` during teardown. Give it an inert subscription
 * to release instead.
 */
export function patchViewportSafeTeardownConstructor(
  viewportClass: ViewportComponentConstructor,
): PatchOutcome {
  if (isPatchInstalled(viewportClass, 'viewportSafeTeardown')) return 'already-applied'

  const onDestroy = viewportClass.prototype.onDestroy
  viewportClass.prototype.onDestroy = function patchedSafeViewportOnDestroy(
    this: ViewportLifecycleInstance,
    parent: unknown,
    afterDestroy: () => void,
  ): Promise<void> {
    this.tickSubscription ??= EMPTY_SUBSCRIPTION
    return onDestroy.call(this, parent, afterDestroy)
  }

  markPatchInstalled(viewportClass, 'viewportSafeTeardown')
  return 'applied'
}
