---
title: Architecture
description: How rpgjs-patches reaches the CanvasEngine classes, why each patch is shaped as it is, and the invariants behind them.
---

## Modules

| File | Responsibility |
| --- | --- |
| `src/index.ts` | `installCanvasEnginePatches`, class resolution, the report, and the public exports |
| `src/viewport.ts` | The clamp rewrite and the viewport teardown guard |
| `src/sprite.ts` | The sprite teardown guard, the two late-work patches, and upstream-fix detection |
| `src/markers.ts` | Idempotence bookkeeping on the patched class |
| `src/types.ts` | Structural types for the members the patches touch |

## Reaching the classes without importing CanvasEngine

CanvasEngine registers its components behind factory functions: `Sprite(props)` returns an element
whose `componentInstance` is an instance of the registered class. The installer calls each factory
once and takes `componentInstance.constructor`. That keeps the package free of a `canvasengine`
import, so it attaches to the application's single deduplicated runtime, loads in Node tooling that
cannot import browser-only code, and has no runtime dependencies.

The resolved class is checked for the members the patches wrap before anything is changed, so a
CanvasEngine release that renames them fails the install with a clear message instead of
half-patching.

## Wrapping, not replacing

Every patch captures the original method and calls through to it, adding one guard:

- **Clamp.** Rewrites the argument, then calls the original.
- **Teardown.** Fills the one missing subscription with an inert one, then calls the original, so
  the rest of CanvasEngine's teardown still runs and `afterDestroy` is still called.
- **Late sprite work.** Skips `play` and `update` when the sprite is destroyed or a transform point
  is `null`. Skips nothing else.
- **Deferred asset cleanup.** Moves the removal of tracked assets after the original teardown.

## Idempotence across module copies

A game can load both the ESM and the CommonJS copy of this package (a bundler dependency and a
Node tool, say). Each patch records itself on the class as a non-enumerable property keyed by
`Symbol.for('rpgjs-patches:<name>')`. `Symbol.for` is shared across copies, and the property lives
on the class rather than in module state, so the second install sees the first and wraps nothing.

## Detecting an upstream fix, not a version

The two late-work sprite patches must be off on CanvasEngine 2.4 and later (see
[Compatibility](./COMPATIBILITY.md)). The installer cannot read the CanvasEngine version, because
it only receives factories, and a version number is the wrong thing to key off anyway. It looks for
the fix itself: the `isDisposed` getter on the sprite class's prototype chain. A plain field named
`isDisposed` does not count, and a subclass of a guarded class does.

## Invariants

1. No runtime dependencies and no `canvasengine` import.
2. A patch is kept only while a test against the real CanvasEngine class reproduces its defect.
3. Installing twice, from any mix of copies, changes nothing the second time.
4. A failed install changes nothing.
5. A patch the installed release does not need is never applied.
