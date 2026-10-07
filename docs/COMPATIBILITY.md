---
title: Compatibility
description: Which CanvasEngine releases rpgjs-patches supports, the per-patch audit behind that range, and how the range is widened.
---

`rpgjs-patches` supports `canvasengine` `>=2.2.0 <2.5.0`. RPGJS 5.0.0 depends on `canvasengine`
`^2.4.0`, so a fresh RPGJS 5 project resolves to the 2.4 line; the 2.2 and 2.3 lines remain
supported for projects still pinned to them.

The range is a claim, and the test suite is its evidence. `package.json` lists each verified release
as a `canvasengine-<version>` alias in `devDependencies`; `tests/canvasengine-matrix.test.ts` runs
every defect against the real `Sprite` and `Viewport` classes of each one, twice: as released, to
show the defect is still there, and with the patches installed, to show the repair. A repository
contract test fails if the peer range is wider than the matrix proves.

## Audit result per patch

Audited against `canvasengine@2.4.0` (the newest release, tagged from upstream `main`) and against
2.2.0 and 2.3.0. The upstream source of `Viewport.ts` is unchanged between 2.2.0 and 2.4.0 apart
from an unrelated `overrideProps` entry; `Sprite.ts` changed in 2.4.0.

| Patch | 2.2.0 | 2.3.0 | 2.4.0 | Evidence on 2.4.0 | Decision |
| --- | --- | --- | --- | --- | --- |
| `viewportClamp` | defect | defect | defect | `clamp: true` then `moveCenter(576, 400)` on a 1152 by 800 world leaves the camera at `(-320, -180)`; `{ direction: 'all' }` leaves it at `(576, 400)`. `Viewport.ts` still forwards `props.clamp` raw. | kept |
| `viewportSafeTeardown` | defect | defect | defect | `onDestroy()` before `onMount()` leaves an unhandled `TypeError` on `tickSubscription.unsubscribe()` (`Viewport.ts:199`). | kept |
| `spriteSafeTeardown` | defect | defect | defect | The same for `subscriptionTick.unsubscribe()` (`Sprite.ts:507`); the `isDisposed` checks added in 2.4.0 sit after it. | kept |
| `spriteAnimationLifecycle` | defect | defect | fixed | `play()` returns on a destroyed sprite, and `onMount()` returns after each `await` once `isDisposed`. A spritesheet that resolves after destroy mounts without error. | kept for 2.2 - 2.3, skipped on 2.4 |
| `spriteDeferredAssetCleanup` | defect | defect | fixed | Progress and completion for an id the sprite no longer tracks are ignored, so no "not found in tracker" warning is logged. | kept for 2.2 - 2.3, skipped on 2.4 |

CanvasEngine 2.4.0 fixed the last two upstream: "Stop `CanvasSprite` initialization after the sprite
is destroyed while its spritesheet is loading"
([RSamaium/CanvasEngine#60](https://github.com/RSamaium/CanvasEngine/issues/60)).

### Why the two sprite patches stay off on 2.4

`spriteAnimationLifecycle` would be harmless on 2.4 but redundant. `spriteDeferredAssetCleanup`
would be harmful: it holds a destroyed sprite's assets in the loader for a delay, relying on the
late completion to find them. CanvasEngine 2.4 clears the sprite's tracked ids at destroy and
ignores completion for ids it does not track, so the held assets would never complete and would
keep the loader's overall progress below 100% for the whole delay. The matrix test for that
(`never leaves an abandoned asset registered once the load has settled`) was seen to fail with one
incomplete asset when the gate was removed.

The installer therefore detects the upstream fix, rather than the version string: CanvasEngine 2.4
adds a private `isDisposed` getter to the sprite class, and the two patches skip a class that has
it. The report returned by `installCanvasEnginePatches` shows the outcome.

One edge remains on 2.4 and is not patched: calling `update()` directly on a destroyed sprite that
had an animation playing still throws. CanvasEngine itself never does that after 2.4.0 (the tick
subscriber and `play()` both check `destroyed`), so only code that drives the sprite by hand can
reach it.

## Widening the range

1. Add the release as a `canvasengine-<version>` alias in `devDependencies` and install.
2. Run `pnpm test`. A change in upstream behavior fails the matrix test and says which patch
   changed status. Update the expectation, and the `hasUpstreamSpriteLifecycleGuard` detection if a
   patch is now unneeded, deliberately.
3. Widen `peerDependencies.canvasengine` to one minor above the newest verified release, and add
   the release to the table above.

## Retirement

Each remaining patch is reported upstream (see the README). When a CanvasEngine release fixes a
defect, its test flips from "defect" to "fixed", the patch is dropped from the code, and when none
remain the package is deprecated on npm with a pointer to the CanvasEngine release that made it
unnecessary.
