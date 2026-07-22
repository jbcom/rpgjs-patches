# Changelog

## 0.1.0 - 2026-07-22

- Extract the proven CanvasEngine viewport, sprite-anchor, and deferred-asset
  cleanup patches from Rivers Reckoning.
- Guard CanvasEngine 2.0.1 sprite teardown when async mount has not assigned its
  tick subscription before a map replacement destroys the sprite.
