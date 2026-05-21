import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));

type GameFeelLike = Record<string, unknown> & {
  audio: Record<string, unknown>;
  version: string;
};

// Build a minimal Phaser-like stub so GameFeel can install handlers without errors.
function makeScene(): Record<string, unknown> {
  const tweens = { add: () => ({}), timeScale: 1 };
  const time = {
    timeScale: 1,
    addEvent: () => ({ remove: () => {}, paused: false }),
    delayedCall: (_: number, fn: () => void) => fn(),
  };
  const cameras = {
    main: {
      zoom: 1,
      shake: () => {},
      flash: () => {},
      fadeOut: () => {},
      once: () => {},
      startFollow: () => {},
      setDeadzone: () => {},
    },
  };
  const sys = { settings: { key: 'test' } };
  const scale = { width: 720, height: 1280 };
  const tweenObjShim = { add: () => ({}) };
  const inputShim = { on: () => {}, off: () => {} };
  const graphicsShim = () => {
    const g: Record<string, unknown> = {};
    const noop = () => g;
    g.clear = noop; g.fillStyle = noop; g.lineStyle = noop;
    g.fillRect = noop; g.fillRoundedRect = noop;
    g.strokeRect = noop; g.strokeRoundedRect = noop;
    g.beginPath = noop; g.moveTo = noop; g.lineTo = noop; g.closePath = noop;
    g.arc = noop; g.fillCircle = noop; g.fillPath = noop; g.strokePath = noop;
    g.setDepth = noop; g.setVisible = noop; g.setActive = noop;
    g.setScale = noop; g.setAlpha = noop; g.setRotation = noop;
    g.destroy = noop;
    return g;
  };
  const sceneObj = {
    tweens,
    time,
    cameras,
    sys,
    scale,
    add: {
      text: () => ({
        setOrigin: () => sceneObj,
        setDepth: () => sceneObj,
        setScale: () => sceneObj,
        setColor: () => sceneObj,
        setAlpha: () => sceneObj,
        setText: () => sceneObj,
        setX: () => sceneObj,
        destroy: () => {},
        x: 0, y: 0,
      }),
      rectangle: () => {
        const rect: Record<string, unknown> = {};
        const self = () => rect;
        rect.setOrigin = self; rect.setDepth = self; rect.setFillStyle = self;
        rect.setStrokeStyle = self; rect.setActive = self; rect.setVisible = self;
        rect.setAlpha = self; rect.setScale = self; rect.setRotation = self;
        rect.setInteractive = self;
        rect.on = self;
        rect.destroy = () => {};
        rect.x = 0; rect.y = 0; rect.width = 0;
        return rect;
      },
      circle: () => ({
        setStrokeStyle: () => sceneObj, setDepth: () => sceneObj, setScale: () => sceneObj,
        setAlpha: () => sceneObj, destroy: () => {}, x: 0, y: 0,
      }),
      container: () => ({
        setDepth: () => sceneObj, setSize: () => sceneObj, setAlpha: () => sceneObj,
        add: () => {}, destroy: () => {}, x: 0, y: 0,
      }),
      graphics: () => graphicsShim(),
    },
    input: inputShim,
  };
  (sceneObj as Record<string, unknown>).tweens = Object.assign(tweens, tweenObjShim);
  return sceneObj;
}

async function loadGameFeel(): Promise<GameFeelLike> {
  const src = await readFile(join(__dirname, '..', 'client', 'GameFeel.js'), 'utf8');
  // The IIFE in GameFeel.js closes over its first arg as `global` — in a browser that's
  // `window`. Mirror setTimeout/setInterval onto window so the closure sees them.
  const windowStub: Record<string, unknown> = {
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
  };
  const sandbox: {
    window: Record<string, unknown>;
    setTimeout: typeof setTimeout;
    clearTimeout: typeof clearTimeout;
    setInterval: typeof setInterval;
    clearInterval: typeof clearInterval;
    AudioContext?: unknown;
  } = {
    window: windowStub,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  const gf = sandbox.window.GameFeel as GameFeelLike | undefined;
  if (!gf) throw new Error('GameFeel did not register on window');
  return gf;
}

test('GameFeel registers on window with all documented surface', async () => {
  const gf = await loadGameFeel();
  const screenLevel = ['shake', 'flash', 'hitstop', 'slowmo', 'zoomPunch'];
  const objectLevel = ['squashStretch', 'bounceIn', 'pulse', 'wobble'];
  const particles = ['burst', 'confetti', 'sparkle', 'trail', 'ringPop'];
  const popups = ['scorePopup', 'comboPopup', 'critPopup'];
  const camera = ['followObject', 'parallaxLayer', 'cinematicIntro'];
  const transitions = ['wipeIn', 'wipeOut', 'fadeTransition', 'irisOpen', 'irisClose'];
  const composite = ['celebrate', 'punish', 'levelStart', 'levelEnd'];
  const ui = ['candyButton'];
  for (const name of [...screenLevel, ...objectLevel, ...particles, ...popups, ...camera, ...transitions, ...composite, ...ui]) {
    assert.equal(typeof gf[name], 'function', `missing method: ${name}`);
  }
  const audioMethods = [
    'correct', 'correctChain', 'wrong', 'impact', 'woosh', 'levelUp', 'powerUp',
    'countdownTick', 'countdownGo', 'countdownFinal', 'crowdCheer', 'engineRev',
    'swordSlash', 'streakExtended', 'xpGain', 'goalReached',
    'setMusicLoop', 'stopMusic',
  ];
  for (const a of audioMethods) {
    assert.equal(typeof gf.audio[a], 'function', `missing audio.${a}`);
  }
});

test('screen-level effects do not throw with minimal scene', async () => {
  const gf = await loadGameFeel();
  const scene = makeScene();
  // These should all complete synchronously (or schedule async work) without throwing.
  assert.doesNotThrow(() => (gf.shake as (s: unknown, i: number, d: number) => void)(scene, 3, 200));
  assert.doesNotThrow(() => (gf.flash as (s: unknown, c: number, d: number) => void)(scene, 0xffffff, 80));
  assert.doesNotThrow(() => (gf.zoomPunch as (s: unknown, a: number, d: number) => void)(scene, 0.08, 280));
  assert.doesNotThrow(() => (gf.hitstop as (s: unknown, d: number) => void)(scene, 60));
  assert.doesNotThrow(() => (gf.slowmo as (s: unknown, f: number, d: number) => void)(scene, 0.5, 300));
});

test('particle bursts respect a soft cap (no infinite spawn)', async () => {
  const gf = await loadGameFeel();
  const scene = makeScene();
  // Spam the pool — must not throw, must not allocate unbounded.
  for (let i = 0; i < 100; i += 1) {
    (gf.burst as (s: unknown, x: number, y: number, o: unknown) => void)(scene, 100, 100, { count: 24 });
  }
  // Pool exposes an internal Map for inspection
  const pools = (gf as unknown as { _pools: Map<string, { active: unknown[]; cap: number }> })._pools;
  for (const pool of pools.values()) {
    assert.ok(pool.active.length <= pool.cap + 5, `pool active=${pool.active.length} exceeds cap+5=${pool.cap + 5}`);
  }
});

test('correctChain advances pitch without throwing', async () => {
  const gf = await loadGameFeel();
  assert.doesNotThrow(() => {
    for (let i = 1; i <= 15; i += 1) (gf.audio.correctChain as (n: number) => void)(i);
  });
});

test('flash refuses pure-red strobe (photosensitivity guard)', async () => {
  const gf = await loadGameFeel();
  const scene = makeScene();
  const received: number[] = [];
  (scene as { cameras: { main: { flash: (d: number, r: number, g: number, b: number) => void } } }).cameras.main.flash =
    (_d, r, g, b) => { received.push(r, g, b); };
  (gf.flash as (s: unknown, c: number, d: number) => void)(scene, 0xff0000, 80);
  assert.ok(received.length === 3, 'flash should have been called exactly once');
  const [, g, b] = received;
  assert.ok((g ?? 0) > 0 || (b ?? 0) > 0, `pure red was not rewritten: g=${g} b=${b}`);
});

test('flash caps duration at 100ms', async () => {
  const gf = await loadGameFeel();
  const scene = makeScene();
  let receivedDur: number | null = null;
  (scene as { cameras: { main: { flash: (d: number) => void } } }).cameras.main.flash = (d) => { receivedDur = d; };
  (gf.flash as (s: unknown, c: number, d: number) => void)(scene, 0xffffff, 9999);
  assert.ok(receivedDur !== null && receivedDur <= 100, `flash duration ${receivedDur} not clamped to ≤100`);
});

test('version is reported', async () => {
  const gf = await loadGameFeel();
  assert.match(gf.version, /^\d+\.\d+\.\d+/);
});

test('candyButton returns a handle with setLabel / setEnabled / destroy', async () => {
  const gf = await loadGameFeel();
  const scene = makeScene();
  const btn = (gf.candyButton as (s: unknown, x: number, y: number, w: number, h: number, l: string, o?: unknown) => { setLabel: (s: string) => void; setEnabled: (v: boolean) => void; destroy: () => void; } | null)(
    scene, 100, 200, 240, 56, 'Continue', { variant: 'green', onTap: () => {} },
  );
  assert.ok(btn, 'candyButton should return a handle');
  assert.doesNotThrow(() => btn!.setLabel('Press me'));
  assert.doesNotThrow(() => btn!.setEnabled(false));
  assert.doesNotThrow(() => btn!.setEnabled(true));
  assert.doesNotThrow(() => btn!.destroy());
});
