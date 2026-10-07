# Contributing

## Getting set up

Use [mise](https://mise.jdx.dev) to install the pinned Node 26 and pnpm 12 toolchain:

```sh
mise install
pnpm install --frozen-lockfile
pnpm verify
pnpm docs:build
```

Alternatively, use Corepack to select the pnpm version in `package.json#packageManager`.
Consumers support Node 24 and newer; CI covers Node 24 and 26 on Linux.

## Making a change

1. Branch from `main` and keep changes focused.
2. For a patch change, reproduce the defect on the real CanvasEngine classes in
   `tests/support/scenarios.ts` and prove the repair in the release matrix. A regression test
   must fail without the fix. Never weaken an existing test.
3. Run `pnpm verify` and `pnpm docs:build`. The library gate includes lint, Markdown lint,
   strict types, coverage, ESM/CJS build, package checks, and isolated packed consumers.
4. Update API, architecture, and compatibility documentation alongside the code. Use examples
   written for this package and record audit decisions in `docs/decisions.md`.
5. Use [Conventional Commits](https://www.conventionalcommits.org), with `!` or a
   `BREAKING CHANGE:` footer for incompatible public changes. Keep local hooks enabled.
6. Open a pull request explaining the defect, the change, and validation. Merge `main` into
   your branch when necessary to preserve commit history.

## Review boundaries

Keep zero runtime dependencies and inject the consumer's CanvasEngine factories. Preserve
installation reports, validation before mutation, and cross-format idempotence. Widen the
CanvasEngine peer range only after adding the release to the test matrix and documenting the audit.
Read [compatibility](docs/COMPATIBILITY.md) before changing the upstream-fix detection.

## Releases

Release Please manages subsequent version and changelog changes. Publishing uses OIDC with
provenance from `.github/workflows/cd.yml`. Contributors should not tag, release, or publish as
part of an ordinary change.
