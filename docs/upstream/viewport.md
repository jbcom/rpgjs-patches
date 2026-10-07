# Upstream issue draft: viewport

Status: not filed. Reproduction and proposed fix for the upstream maintainers.

+## Description

`CanvasViewport.onDestroy()` calls `this.tickSubscription.unsubscribe()` unconditionally. `tickSubscription` is only assigned late in `onMount()`, after `await super.onMount(...)`. A viewport that is destroyed before its mount reaches that line (for example a scene replaced while it is still mounting) therefore throws:

```text
TypeError: Cannot read properties of undefined (reading 'unsubscribe')
```

The throw happens inside the async `_afterDestroy` wrapper that nothing awaits, so it surfaces as an unhandled promise rejection, and the caller's `afterDestroy` callback is never invoked.

## Reproduction

Against `canvasengine@2.4.0` (the same on 2.2.0 and 2.3.0):

```ts
import { Viewport } from 'canvasengine'

const component = Viewport({}).componentInstance
await component.onDestroy(null, () => {})
// Unhandled rejection: TypeError: Cannot read properties of undefined (reading 'unsubscribe')
```

## Expected behavior

Destroying a component that never finished mounting releases what exists and still runs `afterDestroy`.

## Suggested fix

```ts
this.tickSubscription?.unsubscribe()
```

in `onDestroy`, ideally also an early return in `onMount` when the component was destroyed while `await super.onMount(...)` was pending, so a late mount does not subscribe to the tick after teardown.

## Environment

- canvasengine 2.4.0 (also 2.2.0, 2.3.0), `packages/core/src/components/Viewport.ts` line 199
