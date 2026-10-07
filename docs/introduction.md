---
title: "rpgjs-patches"
description: Narrow runtime patches for the CanvasEngine defects every RPGJS 5 game meets.
---

`rpgjs-patches` repairs a handful of CanvasEngine defects that RPGJS 5 games run into, without
forking CanvasEngine or RPGJS. One call at startup wraps the broken methods of the real `Sprite` and
`Viewport` classes, and only on the CanvasEngine releases that still break them.

It is temporary by design: every patch is reported upstream and dropped as soon as a release fixes
the defect.

## Why use it?

| Problem | Patch |
| --- | --- |
| `clamp: true` pushes the camera off the world instead of keeping it inside | The boolean becomes pixi-viewport's all-edges form |
| A scene replaced while a viewport is still mounting leaves an unhandled `TypeError` | Teardown tolerates a mount that never finished |
| The same for a sprite | The same guard on the sprite |
| A spritesheet that finishes loading after the sprite was destroyed crashes on a `null` transform (before CanvasEngine 2.4) | Animation work is skipped once the sprite is gone |
| A texture load resolving after destroy logs "not found in tracker" (before CanvasEngine 2.4) | Asset removal waits for pending callbacks |

Each patch is backed by a test that runs the real CanvasEngine classes of every supported release
through the defect, unpatched and patched.

Start with [Getting started](./getting-started/), then read the [API reference](./API/), the
[compatibility audit](./COMPATIBILITY/) for what is patched on which release, and the
[architecture notes](./ARCHITECTURE/) for how.
