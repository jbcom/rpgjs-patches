# Decisions

## 2026-10-07: unscoped package, version 0.4.0

The target npmjs name is `rpgjs-patches`, from `github.com/jbcom/rpgjs-patches`, licensed MIT.
The name describes narrow repairs for the CanvasEngine runtime used by RPGJS 5. Version 0.4.0
records the expanded compatibility claim and per-patch installation report. Public repository
creation and publishing are separate operations; this local preparation does not perform them.

## Support only audited CanvasEngine lines

The peer range is `>=2.2.0 <2.5.0`, backed by development aliases and real-class matrix tests
for 2.2.0, 2.3.0, and 2.4.0. RPGJS 5.0.0 depends on `canvasengine ^2.4.0`; older supported
lines remain useful for pinned applications. New minor releases require an explicit matrix
addition and audit before the range widens. See [compatibility](COMPATIBILITY.md) for evidence.

## Retain three defects on all audited releases

Boolean viewport clamp still passes raw `true` to pixi-viewport, producing zero bounds rather
than world bounds. Normalize it to `{ direction: 'all' }`. Viewport and sprite teardown still
unsubscribe from ticker subscriptions that do not exist before mount. Keep both safe teardown
patches. These three surviving defects have local [issue drafts](upstream/clamp.md),
[viewport teardown details](upstream/viewport.md), and [sprite teardown details](upstream/sprite.md).

## Skip upstream-fixed late sprite work on 2.4

CanvasEngine 2.4.0 fixes late spritesheet initialization and completion for untracked assets
([upstream issue 60](https://github.com/RSamaium/CanvasEngine/issues/60)). The private `isDisposed`
getter identifies the fixed class without needing a version string. Skip `spriteAnimationLifecycle`
and `spriteDeferredAssetCleanup` when it exists and expose the result in the installation report.

The animation wrapper would be redundant on 2.4. Deferred asset retention would be harmful:
upstream clears tracked ids at destroy and ignores their completions, so retained assets can
hold loader progress below 100% until the delay expires. The matrix's abandoned-asset assertion
was observed to fail when this detection was removed; keep that regression contract.

## Leave unsupported direct update calls alone

Calling `update()` manually on a destroyed animated sprite still throws on 2.4. CanvasEngine's
own tick subscriber and `play()` guard destroyed sprites, so its runtime cannot reach this edge.
Do not add a patch for callers that bypass the supported lifecycle.

## Inject one runtime and retire repairs as upstream fixes land

Keep zero runtime dependencies. Inject public factories to avoid duplicate CanvasEngine copies
and browser imports in Node tooling. Validate both classes before mutation and share installation
markers across ESM/CJS. Remove repairs after a verified upstream fix; when none remain, retire
the package with a pointer to the upstream release.

## Toolchain and verification

Build with Node 26, pnpm 12, and TypeScript 7 using bundler resolution. Keep consumer support
at Node.js 22, 24 and 26 (`engines.node: >=22`), retaining Node 24 type definitions. Emit ESM/CJS with format-correct
declarations. `pnpm verify` checks lint, docs lint, types, coverage, build, publint, Are The Types
Wrong, pack contents, and isolated ESM/CJS consumers against every audited release from npmjs.
Sourcey renders the documentation separately with `pnpm docs:build`.

## 2026-10-07: maintained Node lines

Support Node.js 22 (maintenance LTS), 24 (active LTS), and 26 (current). The engine range
is a lower bound, not an assertion that end-of-life intermediate lines are maintained.
Node 26 is the development default, not an exact-version requirement. CI selects each major
independently. Verify all package gates and isolated packed ESM/CJS consumers on Node 22 and 26
before lowering the floor; no shipped entry point needs a later Node 22 API.
