#!/usr/bin/env node
// Package contract gate (run after `pnpm build`): the packed file list is exactly what ships, and
// the built ESM and CommonJS entry points export the same runtime surface with the same behavior.
// Registry-only install proof lives in consumer-smoke.mjs; this gate inspects the pack itself.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const packageRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
// pnpm forwards its own npm_config_* settings to child processes; newer npm versions warn about
// pnpm-only keys, so this read-only pack inspection gets a clean npm configuration. npm always runs
// `prepare` for `npm pack`, which would print the git-hook installer's [INFO] line into the --json
// stream, so hook installation is skipped for this dry run.
const npmEnvironment = {
  ...Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.toLowerCase().startsWith('npm_config_')),
  ),
  SKIP_INSTALL_SIMPLE_GIT_HOOKS: '1',
}

const scratch = mkdtempSync(path.join(tmpdir(), 'rpgjs-patches-package-'))

try {
  const packOutput = execFileSync(
    'npm',
    ['pack', '--pack-destination', scratch, '--ignore-scripts', '--json'],
    { cwd: packageRoot, encoding: 'utf8', env: npmEnvironment },
  )
  // Any other lifecycle script writing text around the JSON array must not break parsing: try each
  // line-leading "[" until one parses.
  const jsonEnd = packOutput.lastIndexOf(']')
  assert(jsonEnd !== -1, `npm pack produced no JSON array:\n${packOutput}`)
  let pack
  for (const match of packOutput.matchAll(/^\[/gm)) {
    try {
      ;[pack] = JSON.parse(packOutput.slice(match.index, jsonEnd + 1))
      break
    } catch {
      // Not the real array start (for example an "[INFO] ..." line): try the next "[".
    }
  }
  assert(pack, `npm pack did not return a parseable package manifest:\n${packOutput}`)

  const packedPaths = new Set(pack.files.map((file) => file.path))
  for (const required of [
    'LICENSE',
    'README.md',
    'CHANGELOG.md',
    'package.json',
    'docs/API.md',
    'docs/ARCHITECTURE.md',
    'docs/COMPATIBILITY.md',
    'dist/esm/index.js',
    'dist/esm/index.d.ts',
    'dist/cjs/index.cjs',
    'dist/cjs/index.d.cts',
    'dist/cjs/package.json',
  ]) {
    assert(packedPaths.has(required), `packed artifact is missing ${required}`)
  }
  for (const forbiddenPrefix of ['src/', 'tests/', 'coverage/', 'scripts/', '.github/']) {
    assert(
      [...packedPaths].every((file) => !file.startsWith(forbiddenPrefix)),
      `packed artifact unexpectedly contains ${forbiddenPrefix}`,
    )
  }

  const require = createRequire(import.meta.url)
  const esm = await import(pathToFileURL(path.join(packageRoot, 'dist/esm/index.js')).href)
  const cjs = require(path.join(packageRoot, 'dist/cjs/index.cjs'))

  const expectedFunctions = [
    'hasUpstreamSpriteLifecycleGuard',
    'installCanvasEnginePatches',
    'normalizeViewportClamp',
    'patchSpriteAnimationLifecycleConstructor',
    'patchSpriteDeferredAssetCleanupConstructor',
    'patchSpriteSafeTeardownConstructor',
    'patchViewportClampConstructor',
    'patchViewportSafeTeardownConstructor',
    'resolveRegisteredSpriteClass',
    'resolveRegisteredViewportClass',
  ]
  assert.deepEqual(Object.keys(esm).sort(), expectedFunctions, 'ESM export surface changed')
  assert.deepEqual(Object.keys(cjs).sort(), expectedFunctions, 'CommonJS export surface changed')

  // Both builds repair the same stand-in classes identically, and agree on shared markers.
  const makeHost = () => {
    class Sprite {
      play() {}
      update() {}
      async onDestroy() {}
    }
    class Viewport {
      updateViewportSettings() {}
      async onDestroy() {}
    }
    return {
      host: {
        Sprite: () => ({ componentInstance: new Sprite() }),
        Viewport: () => ({ componentInstance: new Viewport() }),
      },
    }
  }
  const { host } = makeHost()
  const first = esm.installCanvasEnginePatches(host)
  const second = cjs.installCanvasEnginePatches(host)
  assert(Object.values(first).every((outcome) => outcome === 'applied'))
  assert(Object.values(second).every((outcome) => outcome === 'already-applied'))
  assert.deepEqual(
    esm.normalizeViewportClamp({ clamp: true }),
    cjs.normalizeViewportClamp({ clamp: true }),
  )

  console.info(
    `rpgjs-patches: ${pack.entryCount} intentional files packed; ESM and CommonJS APIs agree`,
  )
} finally {
  rmSync(scratch, { recursive: true, force: true })
}
