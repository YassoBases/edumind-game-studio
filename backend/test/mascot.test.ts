import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));

type MascotLike = {
  create: (scene: unknown, x: number, y: number, scale?: number) => MascotHandle;
  EXPRESSIONS: string[];
  EVENTS: string[];
};
type MascotHandle = {
  container: unknown;
  setExpression: (name: string) => void;
  react: (event: string) => void;
  destroy: () => void;
};

function makeScene(): Record<string, unknown> {
  const noopShape = () => ({
    setOrigin: () => noopShape(),
    setDepth: () => noopShape(),
    setFillStyle: () => noopShape(),
    setStrokeStyle: () => noopShape(),
    setActive: () => noopShape(),
    setVisible: () => noopShape(),
    setAlpha: () => noopShape(),
    setScale: () => noopShape(),
    setRotation: () => noopShape(),
    setColor: () => noopShape(),
    setText: () => noopShape(),
    setX: () => noopShape(),
    setPosition: () => noopShape(),
    setStyle: () => noopShape(),
    destroy: () => {},
    add: () => {},
    clear: () => {},
    lineStyle: () => {},
    fillStyle: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    closePath: () => {},
    arc: () => {},
    fillCircle: () => {},
    strokeRect: () => {},
    fillPath: () => {},
    strokePath: () => {},
    x: 0, y: 0, alpha: 1,
  });
  const tweens = { add: () => ({}), timeScale: 1 };
  const time = {
    timeScale: 1,
    addEvent: () => ({ remove: () => {}, paused: false }),
    delayedCall: (_: number, _fn: () => void) => ({ remove: () => {} }),
  };
  const cameras = {
    main: {
      zoom: 1, shake: () => {}, flash: () => {}, fadeOut: () => {}, once: () => {},
      startFollow: () => {}, setDeadzone: () => {},
    },
  };
  const sys = { settings: { key: 'test' } };
  const scale = { width: 720, height: 1280 };
  return {
    tweens, time, cameras, sys, scale,
    add: {
      text: () => noopShape(),
      rectangle: () => noopShape(),
      ellipse: () => noopShape(),
      circle: () => noopShape(),
      triangle: () => noopShape(),
      container: () => noopShape(),
      graphics: () => noopShape(),
      image: () => noopShape(),
    },
    input: { on: () => {}, off: () => {} },
  };
}

async function loadMascot(): Promise<MascotLike> {
  const src = await readFile(join(__dirname, '..', 'client', 'Mascot.js'), 'utf8');
  const sandbox: Record<string, unknown> = {
    window: { setTimeout, clearTimeout, setInterval, clearInterval },
    setTimeout, clearTimeout, setInterval, clearInterval,
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  const w = sandbox.window as { Mascot?: MascotLike };
  if (!w.Mascot) throw new Error('Mascot did not register on window');
  return w.Mascot;
}

test('Mascot registers on window with documented API', async () => {
  const m = await loadMascot();
  assert.equal(typeof m.create, 'function');
  assert.ok(Array.isArray(m.EXPRESSIONS) && m.EXPRESSIONS.length >= 8);
  const expected = ['idle', 'happy', 'cheering', 'thinking', 'sad', 'celebrating', 'sleeping', 'surprised'];
  for (const e of expected) assert.ok(m.EXPRESSIONS.includes(e), `missing expression: ${e}`);
  for (const e of ['correct', 'wrong', 'combo3', 'levelComplete', 'streak', 'idle']) {
    assert.ok(m.EVENTS.includes(e), `missing event: ${e}`);
  }
});

test('Mascot.create returns a handle with setExpression / react / destroy', async () => {
  const m = await loadMascot();
  const scene = makeScene();
  const pip = m.create(scene, 100, 100, 1);
  assert.ok(pip);
  assert.equal(typeof pip.setExpression, 'function');
  assert.equal(typeof pip.react, 'function');
  assert.equal(typeof pip.destroy, 'function');
});

test('Mascot.setExpression accepts every documented expression', async () => {
  const m = await loadMascot();
  const scene = makeScene();
  const pip = m.create(scene, 0, 0, 1);
  for (const expr of m.EXPRESSIONS) {
    assert.doesNotThrow(() => pip.setExpression(expr), `setExpression(${expr}) threw`);
  }
});

test('Mascot.react handles every documented event', async () => {
  const m = await loadMascot();
  const scene = makeScene();
  const pip = m.create(scene, 0, 0, 1);
  for (const ev of m.EVENTS) {
    assert.doesNotThrow(() => pip.react(ev), `react(${ev}) threw`);
  }
});

test('Mascot.create with a null scene returns null and does not throw', async () => {
  const m = await loadMascot();
  assert.equal(m.create(null, 0, 0, 1), null);
});
