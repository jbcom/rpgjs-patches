# Changelog

## 0.3.0

- Conform the exact peer, development runtime, and packed-consumer proof to
  `canvasengine@2.2.0` under Node 24.19.0 and pnpm 11.21.0.
- Re-audit the published 2.2.0 package against its official source tag. The
  CanvasEngine runtime source is byte-identical to 2.1.1, so the five retained
  clamp and lifecycle defects remain reproducible and patched.
- Prove both ESM and CommonJS entry points, exact peer metadata, cross-entry
  idempotence, and the RPGJS Solo-style public-factory injection contract in a
  freshly packed isolated consumer.
- Add an explicit zero-warning lint gate and align esbuild to its current
  release.

## 0.2.0

- Align the exact peer and development runtime to `canvasengine@2.1.1` under
  Node 24 LTS.
- Remove the viewport-mask and destroyed-sprite hitbox patches because
  CanvasEngine 2.1.1 now provides both behaviors upstream.
- Retain the still-reproducible boolean-clamp, pre-mount sprite and viewport
  teardown, late-animation, and deferred asset-cleanup patches.
- Replace local distribution imports with a freshly packed, isolated consumer
  proof against the real CanvasEngine 2.1.1 component constructors.

## 0.1.4

- Guard CanvasEngine viewport teardown when a revisioned map is retired before
  its asynchronous mount assigns the ticker subscription.
- Align package and CI tooling to pnpm 11.16.0 on Node 24 LTS.

## 0.1.3

- Ignore late CanvasEngine spritesheet animation callbacks after Pixi has
  cleared the retiring sprite's transform points during a fast map swap.

## 0.1.2 - 2026-07-22

- Normalize CanvasEngine 2.0.1's boolean viewport clamp to pixi-viewport's
  supported all-direction clamp options so camera centering cannot push the
  world below the canvas.

## 0.1.1 - 2026-07-22

- Accept CanvasEngine's intentionally opaque public component-factory return
  type while retaining runtime validation of the resolved component classes.

## 0.1.0 - 2026-07-22

- Extract the proven CanvasEngine viewport, sprite-anchor, and deferred-asset
  cleanup patches from Rivers Reckoning.
- Guard CanvasEngine 2.0.1 sprite teardown when async mount has not assigned its
  tick subscription before a map replacement destroys the sprite.
