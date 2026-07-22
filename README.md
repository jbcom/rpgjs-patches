# @arcade-cabinet/rpgjs-patches

Reusable, narrowly-scoped compatibility patches for CanvasEngine-backed RPGJS
games in the arcade cabinet fleet. The package preserves RPGJS and CanvasEngine
as the real runtime; it only corrects upstream lifecycle defects that have been
reproduced in headed browser playthroughs.

## Included patches

- Pixi 8 viewport mask drawing (`rect().fill()` instead of deprecated APIs).
- Correct all-direction camera clamping when CanvasEngine receives
  `clamp: true`.
- Safe sprite hitbox anchoring after an asynchronous sprite has been destroyed.
- Safe sprite teardown when a map changes before async `onMount()` assigns the
  tick subscription.
- Deferred tracked-asset removal so late Pixi texture callbacks can settle.

The first three patterns were proven in `rivers-reckoning`; the safe teardown
guard was added after Quest for the Crown reproduced CanvasEngine 2.0.1's
`subscriptionTick.unsubscribe()` failure during rapid authored map travel.

## Usage

Install the package beside the exact supported CanvasEngine release:

```sh
pnpm add @arcade-cabinet/rpgjs-patches@0.1.2 canvasengine@2.0.1
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

This release supports `canvasengine@2.0.1`, currently the latest underlying
runtime. A private package is not feature-complete while its direct underlying
runtime is behind latest. Re-test and release this package before widening the
peer range or aligning to a newer CanvasEngine.

## Verification

Use Node 24 LTS and the repository-pinned pnpm release:

```sh
pnpm install --frozen-lockfile
pnpm verify
```

`pnpm verify` runs strict type checking, focused lifecycle tests, ESM and CJS
builds, and package-entry smoke checks.
