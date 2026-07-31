# @arcade-cabinet/rpgjs-patches

Reusable, narrowly-scoped compatibility patches for CanvasEngine-backed RPGJS
games in the arcade cabinet fleet. The package preserves RPGJS and CanvasEngine
as the real runtime; it only corrects upstream lifecycle defects that have been
reproduced in headed browser playthroughs.

## Included patches

- Correct all-direction camera clamping when CanvasEngine receives
  `clamp: true`.
- Safe viewport teardown when a revisioned map retires before async `onMount()`
  assigns the ticker subscription.
- Safe sprite teardown when a map changes before async `onMount()` assigns the
  tick subscription.
- Safe late animation work when an asynchronous spritesheet finishes after
  Pixi has destroyed the retiring sprite.
- Deferred tracked-asset removal so late Pixi texture callbacks can settle.

The camera and asset-lifecycle patterns were proven in `rivers-reckoning`; the
sprite and viewport lifecycle guards were added after Quest for the Crown
reproduced subscription and late-animation failures during rapid authored map
replacement.

CanvasEngine 2.1.1 now implements the correct Pixi 8 viewport-mask API itself
and safely skips its own hitbox-anchor work after Pixi destroys a sprite. The
0.2 line removes those two obsolete patches instead of continuing to override
fixed upstream behavior.

## CanvasEngine 2.1.1 audit

| Behavior | 2.1.1 evidence | Decision |
| --- | --- | --- |
| Viewport mask | `CanvasViewport.updateMask()` calls Pixi 8 `clear().rect().fill()` and the packed probe observes that call chain. | Remove patch. |
| Destroyed hitbox anchor | `CanvasSprite.applyHitboxAnchor()` returns when Pixi has cleared `anchor`; the packed probe destroys a real sprite and calls it safely. | Remove patch. |
| Boolean viewport clamp | `updateViewportSettings()` still forwards `true` to `pixi-viewport`, whose all-edge form is `{ direction: 'all' }`. | Retain. |
| Viewport pre-mount teardown | `onDestroy()` still unconditionally calls `tickSubscription.unsubscribe()`. | Retain. |
| Sprite pre-mount teardown | `onDestroy()` still unconditionally calls `subscriptionTick.unsubscribe()`. | Retain. |
| Late spritesheet animation | `play()` and `update()` can still write through Pixi transform points after destruction. | Retain. |
| Tracked asset cleanup | `onDestroy()` still removes tracked assets immediately while async Pixi loading can remain in flight. | Retain. |

## Usage

Install the package beside the exact supported CanvasEngine release:

```sh
pnpm add @arcade-cabinet/rpgjs-patches@0.2.0 canvasengine@2.1.1
```

Install the patches before CanvasEngine bootstraps a scene:

```ts
import { installCanvasEnginePatches } from '@arcade-cabinet/rpgjs-patches';
import { Sprite, Viewport } from 'canvasengine';

installCanvasEnginePatches({ Sprite, Viewport });
```

Installation is idempotent. Direct patch functions are exported for isolated
tests and for consumers that intentionally need only one compatibility fix.
Passing the public factories keeps the package attached to the consumer's one
deduplicated CanvasEngine runtime and avoids importing browser-only code in
Node-based package tooling.

## Support boundary

This release supports exactly `canvasengine@2.1.1`. The 0.2 version boundary is
intentional: it removes obsolete public patch functions and does not claim
compatibility with the older 2.0 runtime. A private package is not
feature-complete while its direct underlying runtime is behind latest. Audit
the published upstream source and behavior again before widening the peer range
or aligning to a newer CanvasEngine.

## Verification

Use Node 24 LTS and the repository-pinned pnpm release:

```sh
pnpm install --frozen-lockfile
pnpm verify
```

`pnpm verify` runs strict type checking, focused lifecycle tests, ESM and CJS
builds, then packs the artifact into a fresh temporary consumer beside the
exact CanvasEngine peer. That consumer proves the two upstream fixes, reproduces
the five defects that remain before patch installation, and proves the packed
ESM patch entry repairs the real deduplicated CanvasEngine constructors.
