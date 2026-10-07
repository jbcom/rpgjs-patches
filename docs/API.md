---
title: API reference
description: Every export of rpgjs-patches, with the exact behavior of each patch.
---

Everything is exported from the package root, in ESM and CommonJS.

## `installCanvasEnginePatches(host, options?)`

```ts
function installCanvasEnginePatches(
  host: { Sprite: (props: never) => unknown; Viewport: (props: never) => unknown },
  options?: { deferredAssetCleanupMs?: number },
): CanvasEnginePatchReport
```

Resolves the registered `Sprite` and `Viewport` component classes by calling the two factories once
each, then patches those classes in place. Pass `{ Sprite, Viewport }` exactly as `canvasengine`
exports them.

- Idempotent. Bookkeeping lives on the class under `Symbol.for('rpgjs-patches:<name>')`, so an ESM
  copy and a CommonJS copy of the package in one process never wrap a method twice.
- Fails closed. If either class cannot be resolved it throws
  `CanvasEngine Sprite component class could not be resolved` (or `Viewport`) before changing
  anything.
- `deferredAssetCleanupMs` (default `5000`) is how long a destroyed sprite's tracked assets stay
  registered. It only matters on releases before 2.4.

Returns a `CanvasEnginePatchReport`: a record from each `PatchName` to a `PatchOutcome`.

```ts
type PatchName =
  | 'viewportClamp'
  | 'viewportSafeTeardown'
  | 'spriteSafeTeardown'
  | 'spriteAnimationLifecycle'
  | 'spriteDeferredAssetCleanup'

type PatchOutcome = 'applied' | 'already-applied' | 'not-needed'
```

`not-needed` means the installed CanvasEngine release already fixes that defect and nothing was
wrapped.

## The individual patches

Each takes the component class and returns a `PatchOutcome`. Use them when you need exactly one
repair; `installCanvasEnginePatches` is the normal entry point.

| Function | Wraps | Behavior |
| --- | --- | --- |
| `patchViewportClampConstructor(viewportClass)` | `updateViewportSettings` | Rewrites `clamp: true` (bare or inside a reactive signal) to `{ direction: 'all' }` |
| `patchViewportSafeTeardownConstructor(viewportClass)` | `onDestroy` | Supplies an inert `tickSubscription` if mount never assigned one |
| `patchSpriteSafeTeardownConstructor(spriteClass)` | `onDestroy` | Supplies an inert `subscriptionTick` if mount never assigned one |
| `patchSpriteAnimationLifecycleConstructor(spriteClass)` | `play`, `update` | Does nothing once the sprite is destroyed or Pixi cleared a transform point. `not-needed` on 2.4 and later |
| `patchSpriteDeferredAssetCleanupConstructor(spriteClass, delayMs?)` | `onDestroy` | Clears the tracked ids before teardown and removes them from the loader after `delayMs`. `not-needed` on 2.4 and later |

## Helpers

- `normalizeViewportClamp(props)` returns `props` with `clamp: true` rewritten to
  `{ direction: 'all' }`; every other value, including the props object itself, passes through
  unchanged.
- `hasUpstreamSpriteLifecycleGuard(spriteClass)` is `true` when the class carries the `isDisposed`
  getter CanvasEngine 2.4 added. The two late-work sprite patches key off it.
- `resolveRegisteredViewportClass(host)` and `resolveRegisteredSpriteClass(host)` return the class a
  factory registers, or throw the errors above.

## Types

`CanvasEnginePatchHost`, `InstallCanvasEnginePatchesOptions`, `CanvasEnginePatchReport`,
`PatchName`, `PatchOutcome`, `SpriteComponentConstructor`, `ViewportComponentConstructor`,
`SpriteLifecycleInstance`, `SpriteAnimationLifecycleInstance`, `ViewportLifecycleInstance`,
`ViewportSettings`. They describe only the members the patches touch; the package never imports
`canvasengine`.
