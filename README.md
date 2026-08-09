# @arcade-cabinet/rpgjs-patches

Reusable, narrowly-scoped compatibility patches for CanvasEngine-backed RPGJS
games in the arcade cabinet fleet. The package preserves RPGJS and CanvasEngine
as the real runtime; it only corrects upstream lifecycle defects that have been
reproduced in headed browser playthroughs.

GitHub is the primary source and release home. The Arcade Cabinet Gitea copy is
the synchronized LAN backup and private npm registry.

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

CanvasEngine 2.2.0 implements the correct Pixi 8 viewport-mask API itself and
safely skips its own hitbox-anchor work after Pixi destroys a sprite. This
package does not override those fixed upstream behaviors.

## CanvasEngine 2.2.0 audit

The official `canvasengine@2.2.0` tag resolves to upstream commit `be33aac`.
The `packages/core/src` tree is byte-identical to the prior 2.1.1 release at
`9902a33`; 2.2.0's functional changes are in the coordinated compiler package.
The packed-consumer proof still reproduces each retained defect against the
published npm tarball before installation and verifies the repaired behavior
after installation.

| Behavior | 2.2.0 evidence | Decision |
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
pnpm add @arcade-cabinet/rpgjs-patches@0.3.0 canvasengine@2.2.0
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

This release supports exactly `canvasengine@2.2.0`. The exact peer is
intentional: compatibility patches are claims about observed upstream behavior,
not broad semver guesses. Audit the published upstream source and behavior
again before widening the peer range or aligning to a newer CanvasEngine.

## Verification

Use Node 24.19.0 LTS and the repository-pinned pnpm 11.21.0 release:

```sh
pnpm install --frozen-lockfile
pnpm verify
```

`pnpm verify` runs zero-warning linting, strict type checking, focused lifecycle
tests, ESM and CJS builds, then packs the artifact into a fresh temporary
consumer beside the exact CanvasEngine peer. That consumer proves the two
upstream fixes, reproduces the five defects that remain before patch
installation, and proves the packed ESM and CJS entries idempotently repair the
real deduplicated CanvasEngine constructors through the same public-factory
injection used by RPGJS Solo.
