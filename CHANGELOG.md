# Changelog

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
