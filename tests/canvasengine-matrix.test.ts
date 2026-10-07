// Runs the real CanvasEngine component classes of every verified release through each defect twice:
// on pristine classes, to prove the defect is still there (a patch with no observable defect is
// dead and gets dropped), and on patched classes, to prove the repair. The expectations that differ
// between releases are written as such, so a release that changes upstream behavior fails here and
// forces a re-audit instead of silently widening the supported range.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installCanvasEnginePatches } from '../src/index.js'
import { atLeast, verifiedCanvasEngineVersions } from './support/matrix.js'
import {
  spriteAssetLoadResolvesAfterDestroy,
  spriteDestroyedBeforeMount,
  spriteMountResolvesAfterDestroy,
  spritePlayAfterDestroy,
  viewportClampCenter,
  viewportDestroyedBeforeMount,
} from './support/scenarios.js'
import { createSubject, type Subject } from './support/subject.js'

const DELAY_MS = 50
const WORLD_CENTER = { x: 576, y: 400 }

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe.each(verifiedCanvasEngineVersions())('CanvasEngine %s', (version) => {
  // CanvasEngine 2.4.0 stops sprite initialization after teardown (upstream #60).
  const upstreamGuardsSprite = atLeast(version, '2.4.0')
  let subject: Subject

  beforeEach(async () => {
    subject = await createSubject(version)
  })

  describe('as released', () => {
    it('pushes a clamp: true camera off the world instead of clamping it', () => {
      const center = viewportClampCenter(subject)
      expect(center.x).toBeLessThan(0)
      expect(center.y).toBeLessThan(0)
    })

    it('throws from viewport teardown before mount', async () => {
      expect(await viewportDestroyedBeforeMount(subject)).toMatch(/unsubscribe/)
    })

    it('throws from sprite teardown before mount', async () => {
      expect(await spriteDestroyedBeforeMount(subject)).toMatch(/unsubscribe/)
    })

    it(`${upstreamGuardsSprite ? 'refuses' : 'crashes on'} play() after the sprite is destroyed`, async () => {
      const outcome = await spritePlayAfterDestroy(subject)
      if (upstreamGuardsSprite) expect(outcome).toBe('clean')
      else expect(outcome).toMatch(/threw: TypeError.*'set'/)
    })

    it(`${upstreamGuardsSprite ? 'abandons' : 'crashes finishing'} a spritesheet mount that resolves after destroy`, async () => {
      const outcome = await spriteMountResolvesAfterDestroy(subject)
      if (upstreamGuardsSprite) expect(outcome).toBe('clean')
      else expect(outcome).toMatch(/threw: TypeError.*'set'/)
    })

    it(`${upstreamGuardsSprite ? 'ignores' : 'warns about'} an asset load that resolves after destroy`, async () => {
      vi.useFakeTimers()
      const seen = await spriteAssetLoadResolvesAfterDestroy(subject, DELAY_MS)
      expect(seen.registeredAfterDestroy).toBe(0)
      expect(seen.incompleteAfterSettling).toBe(0)
      if (upstreamGuardsSprite) expect(seen.warnings).toEqual([])
      else expect(seen.warnings).toEqual([expect.stringMatching(/not found in tracker/)])
    })
  })

  describe('with the patches installed', () => {
    beforeEach(() => {
      installCanvasEnginePatches(subject.host, { deferredAssetCleanupMs: DELAY_MS })
    })

    it('reports exactly the patches this release still needs', () => {
      // A second install on the same classes only confirms what the first one did.
      const report = installCanvasEnginePatches(subject.host)
      expect(report).toEqual({
        viewportClamp: 'already-applied',
        viewportSafeTeardown: 'already-applied',
        spriteSafeTeardown: 'already-applied',
        spriteAnimationLifecycle: upstreamGuardsSprite ? 'not-needed' : 'already-applied',
        spriteDeferredAssetCleanup: upstreamGuardsSprite ? 'not-needed' : 'already-applied',
      })
    })

    it('keeps a clamp: true camera inside the world', () => {
      expect(viewportClampCenter(subject)).toEqual(WORLD_CENTER)
    })

    it('tears a viewport down cleanly before mount', async () => {
      expect(await viewportDestroyedBeforeMount(subject)).toBe('clean')
    })

    it('tears a sprite down cleanly before mount', async () => {
      expect(await spriteDestroyedBeforeMount(subject)).toBe('clean')
    })

    it('ignores play() after the sprite is destroyed', async () => {
      expect(await spritePlayAfterDestroy(subject)).toBe('clean')
    })

    it('finishes a spritesheet mount that resolves after destroy without error', async () => {
      expect(await spriteMountResolvesAfterDestroy(subject)).toBe('clean')
    })

    it('never leaves an abandoned asset registered once the load has settled', async () => {
      vi.useFakeTimers()
      const seen = await spriteAssetLoadResolvesAfterDestroy(subject, DELAY_MS)
      expect(seen.warnings).toEqual([])
      expect(seen.incompleteAfterSettling).toBe(0)
      // Releases before 2.4.0 hold the removal back for the delay; later ones remove at once.
      expect(seen.registeredAfterDestroy).toBe(upstreamGuardsSprite ? 0 : 1)
    })
  })
})
