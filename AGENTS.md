# Agent notes

## Toolchain

- Use Node 26, pnpm 12 (pinned in `package.json`), and TypeScript 7. `mise.toml` and
  `.nvmrc` describe the development toolchain; consumers support Node 24 and newer.
- The pnpm workspace contains the library at `.` and the private Sourcey site at `docs/`.
  Root `llms.txt` orients repository readers; Sourcey generates the site's version.
- `pnpm verify` runs Biome, Markdown linting, strict TypeScript, coverage, the dual-format
  build, publint, Are The Types Wrong, pack-content checks, and packed-consumer installs
  against npmjs for CanvasEngine 2.2.0, 2.3.0, and 2.4.0. Also run `pnpm docs:build`.

## Runtime invariants

1. Keep zero runtime dependencies. Consumers inject their own `Sprite` and `Viewport`
   factories, so there is only one CanvasEngine runtime and no browser import during Node tooling.
2. Installation validates both component classes before modifying either. Preserve idempotence
   across the ESM and CommonJS entry points and the per-patch installation report.
3. Keep the peer range tied to the real-release matrix. Read [compatibility](docs/COMPATIBILITY.md)
   before changing any patch or widening support.
4. The `isDisposed` getter identifies the upstream sprite lifecycle fix. Skip both late-work
   patches on those classes; delayed asset cleanup would otherwise hold progress below 100%.
5. Reproduce an upstream defect without the patch and prove the repair with it. Never weaken
   a test to make a release pass. Retire patches as upstream fixes land.

## Documentation and tests

Public API changes require matching tests, `docs/API.md`, `docs/ARCHITECTURE.md`, and relevant
README examples. Update `docs/COMPATIBILITY.md` and `docs/decisions.md` when audit findings change.
Use neutral examples written for this package. Upstream issue drafts live in `docs/upstream/`;
replace their README links with public issue URLs only once the issues have actually been filed.

## Commits and releases

Use Conventional Commits. `simple-git-hooks`, lint-staged, and commitlint run after install;
never bypass hooks. Release Please manages subsequent versions and changelog updates, and
`.github/workflows/cd.yml` is the OIDC publishing workflow. Release actions require explicit scope.
Keep local runtime state in ignored `.agent-state/`.

## Build details

`scripts/build.mjs` emits ESM and CJS with `.d.ts` and `.d.cts` declarations and rewrites CJS
specifiers. Keep its output aligned with `scripts/verify-package.mjs`. The workspace `allowBuilds`
map controls dependency install scripts. Do not add native build requirements without checking it.
