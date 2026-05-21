import type { GameSpec, LevelSpec } from '../src/schemas/gameSpec.ts';

function level(index: 1 | 2 | 3 | 4 | 5): LevelSpec {
  return {
    index,
    name: `Level ${index}`,
    timeLimitSeconds: 90,
    hintsAvailable: 2,
    contentItems: Array.from({ length: 5 }, (_, i) => ({
      id: `it${index}-${i}`,
      prompt: `Prompt ${index}-${i}`,
      answer: `Answer ${index}-${i}`,
      concepts: ['c1'],
      difficulty: 0.1 + index * 0.15,
      explanationOnWrong: 'Short explanation',
    })),
    passingScore: 0.6,
  };
}

export function makeValidSpec(): GameSpec {
  return {
    templateId: 'match_pairs',
    language: 'en',
    subject: 'Biology',
    topic: 'Cell organelles',
    theme: 'lab',
    orientation: 'portrait',
    concepts: [
      { id: 'c1', label: 'Concept 1', description: 'Desc 1' },
      { id: 'c2', label: 'Concept 2', description: 'Desc 2' },
    ],
    levels: [level(1), level(2), level(3), level(4), level(5)],
    feedback: {
      correctPool: ['Nice', 'Great', 'Right'],
      wrongPool: ['Nope', 'Off', 'Try'],
      levelComplete: ['Done', 'Next'],
    },
    visualStyle: { palette: ['#000', '#111', '#222', '#333'], accent: '#4ade80' },
    audioCues: ['correct', 'wrong', 'levelUp', 'win', 'lose'],
  };
}

export const VALID_INNER_SCRIPT = `
const SPEC = {};
const engine = window.EduCore.AdaptiveEngine.create(SPEC);
class MenuScene extends Phaser.Scene {}
class GameScene extends Phaser.Scene {
  create() {
    const hud = window.EduCore.makeHud(this, { timeLimitSeconds: 60, hearts: 3 });
    const bridge = window.EduCore.buildBridgeWiring(this, engine);
    const pip = window.Mascot.create(this, 600, 130, 0.6);
    window.GameFeel.levelStart(this, 1, 'Begin');
    window.GameFeel.scorePopup(this, 360, 640, '+10', 0xfbbf24);
    window.GameFeel.celebrate(this, 360, 640, 3);
    window.GameFeel.audio.correctChain(2);
    window.GameFeel.levelEnd(this, 100, 0.8, () => {});
    window.GameFeel.candyButton(this, 360, 900, 220, 56, 'Continue', { variant: 'green', onTap: () => {} });
    bridge.reportLevel(1, { score: 0.8, accuracy: 0.8, durationMs: 1000 });
    bridge.reportFinish();
  }
}
class EndScene extends Phaser.Scene {}
new Phaser.Game({ ...window.EduCore.buildPhaserConfig({ width: 720, height: 1280 }), scene: [MenuScene, GameScene, EndScene] });
`;
