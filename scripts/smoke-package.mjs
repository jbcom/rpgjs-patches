import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const consumerDir = await mkdtemp(join(tmpdir(), 'rpgjs-patches-consumer-'));
const repositoryPackage = JSON.parse(
  await readFile(new URL('../package.json', import.meta.url), 'utf8'),
);
const packageManager = repositoryPackage.packageManager;
const supportedCanvasEngineVersion = repositoryPackage.peerDependencies?.canvasengine;

if (
  typeof supportedCanvasEngineVersion !== 'string' ||
  !/^\d+\.\d+\.\d+$/.test(supportedCanvasEngineVersion)
) {
  throw new Error('CanvasEngine smoke proof requires one exact peer version');
}

try {
  execFileSync('corepack', [packageManager, 'pack', '--pack-destination', consumerDir], {
    cwd: process.cwd(),
    stdio: 'pipe',
  });

  const tarballName = (await readdir(consumerDir)).find((name) => name.endsWith('.tgz'));
  if (!tarballName) throw new Error('pnpm pack did not produce a tarball');

  const tarballPath = join(consumerDir, tarballName);
  await writeFile(
    join(consumerDir, 'package.json'),
    `${JSON.stringify(
      {
        name: 'rpgjs-patches-packed-consumer',
        private: true,
        type: 'module',
        dependencies: {
          '@arcade-cabinet/rpgjs-patches': `file:${tarballPath}`,
          canvasengine: supportedCanvasEngineVersion,
          'pixi.js': '8.19.0',
        },
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(
    join(consumerDir, 'verify.mjs'),
    packedConsumerProof(repositoryPackage.version, supportedCanvasEngineVersion),
  );

  execFileSync(
    'corepack',
    [packageManager, 'install', '--ignore-scripts', '--ignore-workspace'],
    {
      cwd: consumerDir,
      stdio: 'inherit',
    },
  );
  execFileSync(process.execPath, ['verify.mjs'], {
    cwd: consumerDir,
    stdio: 'inherit',
  });
} finally {
  await rm(consumerDir, { recursive: true, force: true });
}

function packedConsumerProof(packageVersion, canvasEngineVersion) {
  return String.raw`
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

globalThis.window = globalThis;
globalThis.addEventListener = () => {};
globalThis.removeEventListener = () => {};
globalThis.document = {
  createElement: () => ({
    style: {},
    addEventListener() {},
    removeEventListener() {},
    getContext() { return null; },
  }),
  addEventListener() {},
  removeEventListener() {},
  body: {
    appendChild() {},
    removeChild() {},
  },
};
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: { userAgent: 'node' },
});
globalThis.Image = class {};
globalThis.HTMLElement = class {};
globalThis.HTMLCanvasElement = class {};

const esm = await import('@arcade-cabinet/rpgjs-patches');
const require = createRequire(import.meta.url);
const cjs = require('@arcade-cabinet/rpgjs-patches');
const packageJson = require('@arcade-cabinet/rpgjs-patches/package.json');

assert.equal(packageJson.version, '${packageVersion}');
assert.equal(packageJson.peerDependencies.canvasengine, '${canvasEngineVersion}');
for (const entry of [esm, cjs]) {
  assert.equal(typeof entry.installCanvasEnginePatches, 'function');
  assert.equal(typeof entry.patchSpriteAnimationLifecycleConstructor, 'function');
  assert.equal(typeof entry.patchSpriteSafeTeardownConstructor, 'function');
  assert.equal(typeof entry.patchSpriteDeferredAssetCleanupConstructor, 'function');
  assert.equal(typeof entry.patchViewportClampConstructor, 'function');
  assert.equal(typeof entry.patchViewportSafeTeardownConstructor, 'function');
  assert.equal(entry.patchViewportMaskConstructor, undefined);
  assert.equal(entry.patchSpriteHitboxAnchorConstructor, undefined);
}

const originalWarn = console.warn;
console.warn = () => {};
const canvasEngine = await import('canvasengine');
console.warn = originalWarn;
const { Texture } = await import('pixi.js');
const canvasEnginePackage = require('canvasengine/package.json');
assert.equal(canvasEnginePackage.version, '${canvasEngineVersion}');

const spriteClass = canvasEngine.Sprite({}).componentInstance.constructor;
const viewportClass = canvasEngine.Viewport({}).componentInstance.constructor;

function animationFixture(sprite) {
  sprite.spritesheet = {};
  sprite.animations.set('stand', {
    frames: [[Texture.EMPTY]],
    name: 'stand',
    animations: [[{ frameX: 0, frameY: 0, anchor: [0.5, 0.5], time: 0 }]],
    params: [],
    data: { spriteWidth: 32, spriteHeight: 32 },
    sprites: [],
  });
}

async function captureUnhandled(run, waitMs = 25) {
  let listener;
  const rejection = new Promise((resolve) => {
    listener = (reason) => resolve({ hit: true, reason });
    process.once('unhandledRejection', listener);
  });

  try {
    await run();
  } catch (reason) {
    process.removeListener('unhandledRejection', listener);
    return reason;
  }

  const result = await Promise.race([
    rejection,
    new Promise((resolve) => setTimeout(() => resolve({ hit: false }), waitMs)),
  ]);
  if (!result.hit) {
    process.removeListener('unhandledRejection', listener);
    return undefined;
  }
  return result.reason;
}

// CanvasEngine ${canvasEngineVersion} retains the fixed Pixi 8 mask path.
{
  const instance = new viewportClass();
  const mask = instance.mask;
  const calls = [];
  mask.clear = () => {
    calls.push(['clear']);
    return mask;
  };
  mask.rect = (...args) => {
    calls.push(['rect', ...args]);
    return mask;
  };
  mask.fill = (...args) => {
    calls.push(['fill', ...args]);
    return mask;
  };
  instance.viewport.screenWidth = 640;
  instance.viewport.screenHeight = 360;
  instance.updateMask();
  assert.deepEqual(calls, [
    ['clear'],
    ['rect', 0, 0, 640, 360],
    ['fill', 0xffffff],
  ]);
}

// CanvasEngine ${canvasEngineVersion} safely ignores its own hitbox-anchor work after
// Pixi has destroyed the anchor point.
{
  const instance = new spriteClass();
  instance.hitbox = { w: 16, h: 16 };
  instance.destroy();
  assert.doesNotThrow(() => instance.applyHitboxAnchor(32, 32));
}

// The retained patches must still have an observable ${canvasEngineVersion} defect before
// installation.
{
  const instance = new viewportClass();
  const clampArguments = [];
  instance.viewport = {
    screenWidth: 640,
    screenHeight: 360,
    clamp: (value) => clampArguments.push(value),
  };
  instance.updateViewportSettings({ clamp: true });
  assert.deepEqual(clampArguments, [true]);
}
{
  const instance = new spriteClass();
  animationFixture(instance);
  instance.destroy();
  assert.throws(() => instance.play('stand'), /null|set/i);
}
{
  const instance = new spriteClass();
  const removed = [];
  instance.globalLoader = { removeAsset: (assetId) => removed.push(assetId) };
  instance.trackedAssetIds.add('late-sheet');
  instance.subscriptionTick = { unsubscribe() {} };
  await instance.onDestroy(null, () => {});
  assert.deepEqual(removed, ['late-sheet']);
}
{
  const instance = new spriteClass();
  const failure = await captureUnhandled(() => instance.onDestroy(null, () => {}));
  assert.match(String(failure), /subscriptionTick|unsubscribe/i);
}
{
  const instance = new viewportClass();
  const failure = await captureUnhandled(() => instance.onDestroy(null, () => {}));
  assert.match(String(failure), /tickSubscription|unsubscribe/i);
}

esm.installCanvasEnginePatches(canvasEngine, { deferredAssetCleanupMs: 5 });

// A consumer can safely inject either package entry more than once before
// creating a scene. This mirrors the RPGJS Solo renderer's constructor hook.
const installedSpritePlay = spriteClass.prototype.play;
const installedSpriteDestroy = spriteClass.prototype.onDestroy;
const installedViewportSettings = viewportClass.prototype.updateViewportSettings;
const installedViewportDestroy = viewportClass.prototype.onDestroy;
cjs.installCanvasEnginePatches(canvasEngine, { deferredAssetCleanupMs: 5 });
assert.equal(spriteClass.prototype.play, installedSpritePlay);
assert.equal(spriteClass.prototype.onDestroy, installedSpriteDestroy);
assert.equal(viewportClass.prototype.updateViewportSettings, installedViewportSettings);
assert.equal(viewportClass.prototype.onDestroy, installedViewportDestroy);

// The packed ESM entry patches the real, deduplicated CanvasEngine ${canvasEngineVersion}
// constructors used by the isolated consumer.
{
  const instance = new viewportClass();
  const clampArguments = [];
  instance.viewport = {
    screenWidth: 640,
    screenHeight: 360,
    clamp: (value) => clampArguments.push(value),
  };
  instance.updateViewportSettings({ clamp: true });
  assert.deepEqual(clampArguments, [{ direction: 'all' }]);
}
{
  const instance = new spriteClass();
  animationFixture(instance);
  instance.destroy();
  assert.doesNotThrow(() => instance.play('stand'));
  assert.doesNotThrow(() => instance.update({ deltaRatio: 1 }));
}
{
  const instance = new spriteClass();
  const failure = await captureUnhandled(() => instance.onDestroy(null, () => {}));
  assert.equal(failure, undefined);
}
{
  const instance = new viewportClass();
  const failure = await captureUnhandled(() => instance.onDestroy(null, () => {}));
  assert.equal(failure, undefined);
}
{
  const instance = new spriteClass();
  const removed = [];
  instance.globalLoader = { removeAsset: (assetId) => removed.push(assetId) };
  instance.trackedAssetIds.add('late-sheet');
  instance.subscriptionTick = { unsubscribe() {} };
  await instance.onDestroy(null, () => {});
  assert.deepEqual(removed, []);
  await new Promise((resolve) => setTimeout(resolve, 15));
  assert.deepEqual(removed, ['late-sheet']);
}

console.log('Packed CanvasEngine ${canvasEngineVersion} consumer proof passed');
`;
}
