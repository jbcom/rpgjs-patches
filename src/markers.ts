/**
 * Patch bookkeeping lives on the patched class itself, under well-known symbols, so that two copies
 * of this package (an ESM entry and a CommonJS entry loaded in the same process) agree on what is
 * already installed and never wrap a method twice.
 */
export type PatchName =
  | 'viewportClamp'
  | 'viewportSafeTeardown'
  | 'spriteSafeTeardown'
  | 'spriteAnimationLifecycle'
  | 'spriteDeferredAssetCleanup'

/**
 * What a patch function did to the class it was given:
 *
 * - `applied`: the patch was installed by this call.
 * - `already-applied`: an earlier call (possibly from another copy of this package) installed it.
 * - `not-needed`: the CanvasEngine release in use already fixes the defect, so nothing was wrapped.
 */
export type PatchOutcome = 'applied' | 'already-applied' | 'not-needed'

const markerFor = (name: PatchName): symbol => Symbol.for(`rpgjs-patches:${name}`)

export function isPatchInstalled(target: object, name: PatchName): boolean {
  return (target as Record<symbol, unknown>)[markerFor(name)] === true
}

export function markPatchInstalled(target: object, name: PatchName): void {
  Object.defineProperty(target, markerFor(name), {
    value: true,
    enumerable: false,
    configurable: true,
  })
}
