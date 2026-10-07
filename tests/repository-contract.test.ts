// The package's own repository is its only home: these assertions keep the manifest, the toolchain,
// the publish path and the compatibility claims pointing at it, so a copy-paste from another
// repository, or a peer range wider than the tests prove, cannot drift in.
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { atLeast, verifiedCanvasEngineVersions } from './support/matrix.js'

const root = path.resolve(import.meta.dirname, '..')
const read = (file: string) => readFileSync(path.join(root, file), 'utf8')
const manifest = JSON.parse(read('package.json')) as {
  name: string
  version: string
  license: string
  repository: { type: string; url: string }
  packageManager: string
  engines: Record<string, string>
  scripts: Record<string, string>
  publishConfig: Record<string, unknown>
  peerDependencies: Record<string, string>
  dependencies?: Record<string, string>
  devDependencies: Record<string, string>
}

describe('repository contract', () => {
  it('is the open-source package on npmjs, MIT, published with provenance', () => {
    expect(manifest.name).toBe('rpgjs-patches')
    expect(manifest.license).toBe('MIT')
    expect(manifest.repository).toEqual({
      type: 'git',
      url: 'git+https://github.com/jbcom/rpgjs-patches.git',
    })
    expect(manifest.publishConfig).toEqual({ access: 'public', provenance: true })
    expect(read('.npmrc').trim().split('\n')).toEqual([
      'registry=https://registry.npmjs.org/',
      'provenance=true',
    ])
  })

  it('builds on Node 26, pnpm 12 and TypeScript 7, and runs on Node 24 and later', () => {
    expect(read('.nvmrc').trim()).toBe('26')
    expect(read('mise.toml')).toMatch(/node = "26"[\s\S]*pnpm = "12"/)
    expect(manifest.packageManager).toMatch(/^pnpm@12\.\d+\.\d+$/)
    expect(manifest.devDependencies.typescript).toMatch(/^\^?7\./)
    expect(manifest.engines).toEqual({ node: '>=24' })
    expect(manifest.devDependencies['@types/node']).toMatch(/^\^?24\./)
  })

  it('resolves modules the TypeScript 7 way: no node10 anywhere', () => {
    for (const file of ['tsconfig.json', 'tsconfig.cjs.json']) {
      expect(read(file), file).toContain('"moduleResolution": "bundler"')
    }
    for (const file of ['tsconfig.json', 'tsconfig.esm.json', 'tsconfig.cjs.json']) {
      expect(read(file), file).not.toMatch(/node10|"moduleResolution": "node"/)
    }
  })

  it('verifies everything, including the packed package and a packed consumer', () => {
    const verify = manifest.scripts.verify ?? ''
    for (const step of [
      'lint',
      'lint:docs',
      'typecheck',
      'coverage',
      'build',
      'package:check',
      'smoke:consumer',
    ]) {
      expect(verify, step).toContain(`pnpm run ${step}`)
    }
    expect(manifest.scripts['package:check']).toBe(
      'publint && attw --pack . && node scripts/verify-package.mjs',
    )
    expect(read('.github/workflows/ci.yml')).toContain('run: pnpm verify')
  })

  it('publishes from cd.yml by OIDC after verifying, with no token in the repository', () => {
    const cd = read('.github/workflows/cd.yml')
    expect(cd).toContain('id-token: write')
    expect(cd).toMatch(/pnpm verify[\s\S]+npm publish --access public --provenance/)
    expect(cd).not.toMatch(/NODE_AUTH_TOKEN|NPM_TOKEN|_authToken/)
    expect(read('.github/workflows/release.yml')).toContain('release-please-action')
  })

  it('keeps the release manifest at the package version and the tag pattern plain', () => {
    expect(JSON.parse(read('.release-please-manifest.json'))).toEqual({ '.': manifest.version })
    const config = JSON.parse(read('release-please-config.json')) as {
      packages: Record<string, Record<string, unknown>>
    }
    expect(config.packages['.']).toMatchObject({
      'package-name': manifest.name,
      'include-component-in-tag': false,
      'bump-minor-pre-major': true,
    })
  })

  it('carries no trace of the private Gitea home or the retired scope', () => {
    expect(existsSync(path.join(root, '.gitea'))).toBe(false)
    expect(existsSync(path.join(root, 'scripts/ensure-release-labels.mjs'))).toBe(false)
    const retiredScope = ['@arcade', 'cabinet'].join('-')
    expect(read('package.json')).not.toContain(retiredScope)
  })
})

describe('compatibility claim', () => {
  const verified = verifiedCanvasEngineVersions()
  const [floor] = verified
  const last = verified.at(-1)

  it('has a verified matrix whose oldest release is the floor of the peer range', () => {
    expect(verified.length).toBeGreaterThanOrEqual(2)
    expect(floor).toBeDefined()
    expect(manifest.peerDependencies.canvasengine).toMatch(
      new RegExp(`^>=${floor?.replaceAll('.', '\\.')} <\\d+\\.\\d+\\.\\d+$`),
    )
  })

  it('stops the peer range one minor above the newest verified release', () => {
    const [major, minor] = (last ?? '0.0.0').split('.').map(Number)
    expect(manifest.peerDependencies.canvasengine).toBe(
      `>=${floor} <${major}.${(minor ?? 0) + 1}.0`,
    )
  })

  it('ships no runtime dependency, so the consumer owns the one CanvasEngine runtime', () => {
    expect(manifest.dependencies).toBeUndefined()
  })

  it('documents every verified release in docs/COMPATIBILITY.md', () => {
    const compatibility = read('docs/COMPATIBILITY.md')
    for (const version of verified) expect(compatibility, version).toContain(version)
  })

  it('verifies at least one release before and one after the sprite lifecycle fix', () => {
    expect(verified.some((version) => !atLeast(version, '2.4.0'))).toBe(true)
    expect(verified.some((version) => atLeast(version, '2.4.0'))).toBe(true)
  })
})
