import { readFileSync } from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '../..')

/**
 * The CanvasEngine releases the test suite runs against, read from the `canvasengine-<version>`
 * aliases in `devDependencies`. Adding a release to the matrix is one alias in `package.json`; the
 * peer range in `package.json` and `docs/COMPATIBILITY.md` must then be widened to match, and
 * `tests/repository-contract.test.ts` fails until they are.
 */
export function verifiedCanvasEngineVersions(): string[] {
  const manifest = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')) as {
    devDependencies: Record<string, string>
  }
  return Object.entries(manifest.devDependencies)
    .flatMap(([alias, spec]) => {
      const match = /^canvasengine-(\d+\.\d+\.\d+)$/.exec(alias)
      return match?.[1] && spec === `npm:canvasengine@${match[1]}` ? [match[1]] : []
    })
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
}

/** True when CanvasEngine `version` is at least `floor`, comparing numeric major.minor.patch. */
export function atLeast(version: string, floor: string): boolean {
  const a = version.split('.').map(Number)
  const b = floor.split('.').map(Number)
  for (let index = 0; index < 3; index += 1) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0)
    if (difference !== 0) return difference > 0
  }
  return true
}
