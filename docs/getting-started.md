---
title: Getting started
description: Install rpgjs-patches beside canvasengine and patch the Sprite and Viewport classes once at startup.
---

## Install

```sh
pnpm add rpgjs-patches canvasengine
```

`canvasengine` is a peer: your application, or `@rpgjs/client`, installs it, so there is exactly one
CanvasEngine runtime. Supported releases are `>=2.2.0 <2.5.0`. Use Node.js 24 or newer for tooling.
The package ships native ESM and CommonJS entry points with format-correct TypeScript declarations.

## Patch once at startup

Call `installCanvasEnginePatches` before CanvasEngine mounts a scene, in the module that boots your
client:

```ts
import { Sprite, Viewport } from 'canvasengine'
import { installCanvasEnginePatches } from 'rpgjs-patches'

installCanvasEnginePatches({ Sprite, Viewport })
```

It patches the `Sprite` and `Viewport` component classes in place. Calling it again, or from a
second copy of the package, changes nothing.

## Read the report

```ts
const report = installCanvasEnginePatches({ Sprite, Viewport })
console.info(report)
```

Each entry is `applied`, `already-applied` or `not-needed`. `not-needed` means your CanvasEngine
release already fixes that defect upstream, so the patch was skipped on purpose.

## Check that it is working

A `clamp: true` viewport should keep the camera inside the world. Without the patch, centering on
the middle of a world larger than the screen pushes the camera off it. A scene replaced while it is
still loading should no longer log an unhandled `Cannot read properties of undefined (reading
'unsubscribe')`.

Next: the [API reference](./API/), the [compatibility audit](./COMPATIBILITY/), and the
[architecture notes](./ARCHITECTURE/).
