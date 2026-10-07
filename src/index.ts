import type { PatchName, PatchOutcome } from './markers.js'
import {
  patchSpriteAnimationLifecycleConstructor,
  patchSpriteDeferredAssetCleanupConstructor,
  patchSpriteSafeTeardownConstructor,
} from './sprite.js'
import type { SpriteComponentConstructor, ViewportComponentConstructor } from './types.js'
import { patchViewportClampConstructor, patchViewportSafeTeardownConstructor } from './viewport.js'

type CanvasElementWithInstance = {
  componentInstance?: {
    constructor?: unknown
  }
}

/** The CanvasEngine `Sprite` and `Viewport` component factories, exactly as `canvasengine` exports them. */
export type CanvasEnginePatchHost = {
  Sprite: (props: never) => unknown
  Viewport: (props: never) => unknown
}

export type InstallCanvasEnginePatchesOptions = {
  /** How long a destroyed sprite's tracked assets stay registered. Default 5000 ms. Pre-2.4 releases only. */
  deferredAssetCleanupMs?: number
}

/** The outcome of each patch for the CanvasEngine release that was patched. */
export type CanvasEnginePatchReport = Record<PatchName, PatchOutcome>

export function resolveRegisteredViewportClass(
  canvasEngine: CanvasEnginePatchHost,
): ViewportComponentConstructor {
  const probe = canvasEngine.Viewport({} as never) as CanvasElementWithInstance
  const viewportClass = probe.componentInstance?.constructor as
    | ViewportComponentConstructor
    | undefined

  if (
    typeof viewportClass?.prototype?.updateViewportSettings !== 'function' ||
    typeof viewportClass.prototype.onDestroy !== 'function'
  ) {
    throw new Error('CanvasEngine Viewport component class could not be resolved')
  }

  return viewportClass
}

export function resolveRegisteredSpriteClass(
  canvasEngine: CanvasEnginePatchHost,
): SpriteComponentConstructor {
  const probe = canvasEngine.Sprite({} as never) as CanvasElementWithInstance
  const spriteClass = probe.componentInstance?.constructor as SpriteComponentConstructor | undefined

  if (
    typeof spriteClass?.prototype?.onDestroy !== 'function' ||
    typeof spriteClass.prototype.play !== 'function' ||
    typeof spriteClass.prototype.update !== 'function'
  ) {
    throw new Error('CanvasEngine Sprite component class could not be resolved')
  }

  return spriteClass
}

/**
 * Patches the CanvasEngine `Sprite` and `Viewport` component classes in place. Call it once,
 * before CanvasEngine mounts a scene. It is idempotent, including across the ESM and CommonJS
 * copies of this package, and it throws before changing anything if either class cannot be found.
 *
 * Only the patches the installed CanvasEngine release still needs are applied. The returned report
 * says which: `not-needed` means the release already fixes that defect.
 */
export function installCanvasEnginePatches(
  canvasEngine: CanvasEnginePatchHost,
  options: InstallCanvasEnginePatchesOptions = {},
): CanvasEnginePatchReport {
  const spriteClass = resolveRegisteredSpriteClass(canvasEngine)
  const viewportClass = resolveRegisteredViewportClass(canvasEngine)

  return {
    viewportClamp: patchViewportClampConstructor(viewportClass),
    viewportSafeTeardown: patchViewportSafeTeardownConstructor(viewportClass),
    spriteAnimationLifecycle: patchSpriteAnimationLifecycleConstructor(spriteClass),
    spriteSafeTeardown: patchSpriteSafeTeardownConstructor(spriteClass),
    spriteDeferredAssetCleanup: patchSpriteDeferredAssetCleanupConstructor(
      spriteClass,
      options.deferredAssetCleanupMs ?? 5_000,
    ),
  }
}

export type { PatchName, PatchOutcome } from './markers.js'
export {
  hasUpstreamSpriteLifecycleGuard,
  patchSpriteAnimationLifecycleConstructor,
  patchSpriteDeferredAssetCleanupConstructor,
  patchSpriteSafeTeardownConstructor,
} from './sprite.js'
export type {
  SpriteAnimationLifecycleInstance,
  SpriteComponentConstructor,
  SpriteLifecycleInstance,
  ViewportComponentConstructor,
  ViewportLifecycleInstance,
  ViewportSettings,
} from './types.js'
export {
  normalizeViewportClamp,
  patchViewportClampConstructor,
  patchViewportSafeTeardownConstructor,
} from './viewport.js'
