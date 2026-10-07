# Upstream issue draft: clamp

Status: not filed. Reproduction and proposed fix for the upstream maintainers.

+## Description

`ViewportProps.clamp` is typed `boolean | { left?, right?, top?, bottom? }`, but `clamp: true` does not keep the camera inside the world. `CanvasViewport.updateViewportSettings()` forwards the value unchanged:

```ts
if (props.clamp) {
  this.viewport.clamp(props.clamp.value ?? props.clamp)
}
```

With `true`, pixi-viewport builds the plugin from its defaults only (`Object.assign({}, defaults, true)`). Its default `left`, `right`, `top` and `bottom` are `false`, and the plugin only treats `null` as "edge not clamped", so every edge is clamped against a bound of `0` instead of the world size. The camera is pushed off the world.

## Reproduction

Against `canvasengine@2.4.0` (the same on 2.2.0 and 2.3.0), `pixi-viewport@6.0.3`:

```ts
import { Viewport } from 'canvasengine'

const component = Viewport({}).componentInstance
component.viewport.screenWidth = 640
component.viewport.screenHeight = 360
component.updateViewportSettings({ worldWidth: 1152, worldHeight: 800, clamp: true })

component.viewport.moveCenter(576, 400) // the middle of the world
component.viewport.update(1)

console.log(component.viewport.center)
// actual:   { x: -320, y: -180 }
// expected: { x: 576, y: 400 }
```

With `clamp: { direction: 'all' }` the same sequence leaves the center at `{ x: 576, y: 400 }`.

## Expected behavior

`clamp: true` clamps all four edges to the world, as the boolean type suggests.

## Suggested fix

Translate the boolean before handing it to pixi-viewport:

```ts
if (props.clamp) {
  const clamp = props.clamp.value ?? props.clamp
  this.viewport.clamp(clamp === true ? { direction: 'all' } : clamp)
}
```

Plus a regression test that moves the camera to the middle of a world larger than the screen and asserts the center.

## Environment

- canvasengine 2.4.0 (also 2.2.0, 2.3.0)
- pixi-viewport 6.0.3, pixi.js 8.19
