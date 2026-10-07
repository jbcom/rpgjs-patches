#!/usr/bin/env node
// Built-tarball consumer smoke: pack the package, then for every CanvasEngine release in the
// verified matrix install the tarball and that release into a clean scratch consumer against npmjs
// only (no scoped registry, no token), and run scripts/consumer-proof.mjs there. Proves the exports
// map, the .cjs rewrite, the files list, and the repair on the real classes of each release.
// With RPGJS_PATCHES_CONSUMER_SOURCE=rpgjs-patches@<version> it installs that published version from
// npmjs instead: the cold-install proof after a release.
import { execFileSync } from 'node:child_process'
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const pkgRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const scratch = mkdtempSync(path.join(tmpdir(), 'rpgjs-patches-smoke-'))
const registrySource = process.env.RPGJS_PATCHES_CONSUMER_SOURCE
const manifest = JSON.parse(readFileSync(path.join(pkgRoot, 'package.json'), 'utf8'))

const matrix = Object.keys(manifest.devDependencies)
  .map((alias) => /^canvasengine-(\d+\.\d+\.\d+)$/.exec(alias)?.[1])
  .filter(Boolean)
if (matrix.length === 0) throw new Error('no canvasengine-<version> aliases in devDependencies')

// Anonymous: no inherited npm_config_* (pnpm run exports them into scripts) and no
// credential-looking variables, so no token on the machine can authenticate any npm call here.
const anonymousEnv = {
  ...Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) => !/^npm_config_/i.test(key) && !/auth|token|secret|password|credential/i.test(key),
    ),
  ),
  // `npm pack` runs the package's own `prepare` (the git-hook installer); hooks are irrelevant here.
  SKIP_INSTALL_SIMPLE_GIT_HOOKS: '1',
}

try {
  if (registrySource && !/^rpgjs-patches@\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(registrySource)) {
    throw new Error('RPGJS_PATCHES_CONSUMER_SOURCE must be an exact rpgjs-patches@<version> spec')
  }
  let source = registrySource
  if (!source) {
    execFileSync('npm', ['pack', '--pack-destination', scratch], {
      cwd: pkgRoot,
      stdio: 'inherit',
      env: anonymousEnv,
    })
    const tarball = readdirSync(scratch).find((file) => file.endsWith('.tgz'))
    if (!tarball) throw new Error('npm pack produced no tarball')
    source = path.join(scratch, tarball)
  }

  const userConfig = path.join(scratch, 'anonymous.npmrc')
  const globalConfig = path.join(scratch, 'empty-global.npmrc')
  writeFileSync(userConfig, 'registry=https://registry.npmjs.org/\n')
  writeFileSync(globalConfig, '')

  for (const canvasEngineVersion of matrix) {
    const consumer = path.join(scratch, `consumer-${canvasEngineVersion}`)
    mkdirSync(consumer, { recursive: true })
    writeFileSync(
      path.join(consumer, 'package.json'),
      JSON.stringify({ name: 'rpgjs-patches-smoke-consumer', private: true, type: 'module' }),
    )
    execFileSync(
      'npm',
      [
        'install',
        '--no-audit',
        '--no-fund',
        '--ignore-scripts',
        '--userconfig',
        userConfig,
        '--globalconfig',
        globalConfig,
        source,
        `canvasengine@${canvasEngineVersion}`,
        'pixi.js@^8.19.0',
      ],
      { cwd: consumer, stdio: 'inherit', env: anonymousEnv },
    )
    copyFileSync(path.join(pkgRoot, 'scripts/consumer-proof.mjs'), path.join(consumer, 'proof.mjs'))
    execFileSync(process.execPath, ['proof.mjs'], { cwd: consumer, stdio: 'inherit' })
  }
  console.info(
    `rpgjs-patches: consumer smoke passed (ESM + CJS) against canvasengine ${matrix.join(', ')} from ${registrySource ?? 'the packed tarball'}`,
  )
} finally {
  rmSync(scratch, { recursive: true, force: true })
}
