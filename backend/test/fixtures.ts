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
    const score = window.EduCore.makeScoreHud(this, 24, 24);
    const timer = window.EduCore.makeTimerHud(this, 696, 24, 60);
    window.EduMindAPI.reportLevel(1, 0.8, 0.8, 1000);
    window.EduMindAPI.reportSummary({});
    window.EduMindAPI.reportComplete(0, true, 0);
    this.add.rectangle(360, 640, 200, 100, 0x1f2937).setInteractive({ useHandCursor: true });
  }
}
class EndScene extends Phaser.Scene {}
new Phaser.Game({ scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH } });
`;
