# rpgjs-patches

[![CI](https://github.com/jbcom/rpgjs-patches/actions/workflows/ci.yml/badge.svg)](https://github.com/jbcom/rpgjs-patches/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/rpgjs-patches.svg)](https://www.npmjs.com/package/rpgjs-patches)
[![MIT license](https://img.shields.io/badge/license-MIT-17324d.svg)](./LICENSE)

Narrow runtime patches for the CanvasEngine defects that every [RPGJS 5](https://rpgjs.dev) game
meets: a `clamp: true` camera that leaves the world, viewports and sprites destroyed before they
finish mounting, and late sprite work after Pixi has destroyed the sprite.

One call, before CanvasEngine mounts a scene, repairs the real `Sprite` and `Viewport` classes in
place. RPGJS and CanvasEngine stay the runtime; the package wraps only the methods that are
broken, and only on the CanvasEngine releases that still break them.

**This package is temporary by design.** Each patch exists because of a defect in CanvasEngine, and
each is dropped the moment a release fixes it. When the defects listed under
[Upstream issues](#upstream-issues) are fixed, the package retires.

Full documentation: **[jonbogaty.com/rpgjs-patches](https://jonbogaty.com/rpgjs-patches/)**

## Install

```sh
pnpm add rpgjs-patches canvasengine
```

Requirements:

- `canvasengine` `>=2.2.0 <2.5.0` as a peer, resolved by your application so there is exactly one
  CanvasEngine runtime
- Node.js 24 or newer for tooling (CI covers Node 24 and 26 on Linux)

The package has no runtime dependencies and ships native ESM and CommonJS entry points with
format-correct TypeScript declarations.

## Quick start

Install the patches once, before CanvasEngine mounts a scene:

```ts
import { Sprite, Viewport } from 'canvasengine'
import { installCanvasEnginePatches } from 'rpgjs-patches'

const report = installCanvasEnginePatches({ Sprite, Viewport })
```

Passing the factories keeps the package attached to your one deduplicated CanvasEngine runtime and
keeps browser-only code out of Node tooling. Installation is idempotent, including across the ESM
and CommonJS copies of this package, and it throws before changing anything if either component
class cannot be resolved.

The returned report says what the installed release still needed:

```ts
// canvasengine 2.2.0 or 2.3.0: every patch applies
{
  viewportClamp: 'applied',
  viewportSafeTeardown: 'applied',
  spriteAnimationLifecycle: 'applied',
  spriteSafeTeardown: 'applied',
  spriteDeferredAssetCleanup: 'applied',
}

// canvasengine 2.4.0: upstream fixed the two late-sprite-work defects
{
  viewportClamp: 'applied',
  viewportSafeTeardown: 'applied',
  spriteAnimationLifecycle: 'not-needed',
  spriteSafeTeardown: 'applied',
  spriteDeferredAssetCleanup: 'not-needed',
}
```

## What it patches

| Patch | Defect | CanvasEngine 2.2 - 2.3 | CanvasEngine 2.4 |
| --- | --- | --- | --- |
| `viewportClamp` | `clamp: true` is forwarded raw to pixi-viewport, which clamps every edge to `0` and pushes a centered camera off the world | patched | patched |
| `viewportSafeTeardown` | `Viewport.onDestroy()` calls `tickSubscription.unsubscribe()` before `onMount()` assigned it | patched | patched |
| `spriteSafeTeardown` | `Sprite.onDestroy()` calls `subscriptionTick.unsubscribe()` before `onMount()` assigned it | patched | patched |
| `spriteAnimationLifecycle` | A spritesheet that finishes loading after destroy calls `play()`, which writes through Pixi transforms that destroy set to `null` | patched | fixed upstream, skipped |
| `spriteDeferredAssetCleanup` | A texture load that resolves after destroy reports progress for an asset the loader already forgot, logging "not found in tracker" | patched | fixed upstream, skipped |

Every row is backed by a test that runs the real CanvasEngine classes of each supported release
through the defect, unpatched and patched. See [Compatibility](./docs/COMPATIBILITY.md) for the
audit, the evidence, and why the two sprite patches must stay off on 2.4.

## Upstream issues

The surviving defects are reported to CanvasEngine. The package retires once they are fixed.

- Viewport `clamp: true`: _link added once filed_
- `Viewport.onDestroy()` before `onMount()`: _link added once filed_
- `Sprite.onDestroy()` before `onMount()`: _link added once filed_

CanvasEngine 2.4.0 already fixed the other two defects upstream
([RSamaium/CanvasEngine#60](https://github.com/RSamaium/CanvasEngine/issues/60)).

## Support boundary

The peer range is `>=2.2.0 <2.5.0`: exactly the releases the test suite runs, from 2.2.0 to the
newest 2.4.x. A patch is a claim about observed upstream behavior, so the range is widened only
after the new release is added to the matrix and every test passes against it. Next CanvasEngine
minor, add the release, run the suite, widen the range.

## Verification

```sh
pnpm install --frozen-lockfile
pnpm verify
```

`pnpm verify` runs Biome, markdownlint, strict TypeScript 7, the test suite with coverage, the dual
ESM/CommonJS build, `publint`, Are The Types Wrong, a pack-content check, and a packed-consumer
smoke that installs the tarball into an empty project, once per supported CanvasEngine release,
against npmjs only.

## License

MIT
