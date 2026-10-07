# Upstream issue draft: sprite

Status: not filed. Reproduction and proposed fix for the upstream maintainers.

+## Description

`CanvasSprite.onDestroy()` calls `this.subscriptionTick.unsubscribe()` unconditionally. `subscriptionTick` is assigned in `onMount()`, which CanvasEngine runs asynchronously after the component is created. A sprite destroyed before `onMount()` has started (a scene or map replaced right after it was created) throws:

```text
TypeError: Cannot read properties of undefined (reading 'unsubscribe')
```

As in `CanvasViewport`, the throw is inside the `_afterDestroy` wrapper that nothing awaits, so it is an unhandled promise rejection and the caller's `afterDestroy` callback is skipped. The 2.4.0 `isDisposed` checks (#60) stop the asynchronous initialization after teardown, but they do not cover this path, because `onDestroy()` itself throws before it gets to them.

## Reproduction

Against `canvasengine@2.4.0` (the same on 2.2.0 and 2.3.0):

```ts
import { Sprite } from 'canvasengine'

const component = Sprite({}).componentInstance
await component.onDestroy(null, () => {})
// Unhandled rejection: TypeError: Cannot read properties of undefined (reading 'unsubscribe')
```

## Expected behavior

Destroying a sprite that never mounted releases what exists and still runs `afterDestroy`.

## Suggested fix

```ts
this.subscriptionTick?.unsubscribe()
```

in `onDestroy`, and a check of `isDisposed` at the top of `onMount()` so a mount that starts after teardown does not subscribe to the tick (the `destroyed` guard in the subscriber currently hides that leak).

## Environment

- canvasengine 2.4.0 (also 2.2.0, 2.3.0), `packages/core/src/components/Sprite.ts` line 507
