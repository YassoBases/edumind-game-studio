// EduCore.js — shared library for all EduMind generated games.
// Single source of truth for i18n, RTL, HUDs, audio cues, and the AdaptiveEngine.
// Generated games MUST use these primitives. Reimplementing any of them is a validator failure.
(function (global) {
  'use strict';

  const I18N = {
    en: {
      score: 'Score',
      time: 'Time',
      level: 'Level',
      hearts: 'Hearts',
      start: 'Start',
      next: 'Next',
      retry: 'Retry',
      tapToStart: 'Tap to start',
      correct: 'Correct!',
      wrong: 'Not quite',
      timeUp: "Time's up",
      hint: 'Hint',
      levelComplete: 'Level complete',
      win: 'You win!',
      lose: 'Game over',
      takeBreak: "Let's take a break",
      retryFromOne: 'Try from Level 1',
      quit: 'Quit',
      finalScore: 'Final score',
      mastery: 'Mastery',
      accuracy: 'Accuracy',
    },
    ar: {
      score: 'النقاط',
      time: 'الوقت',
      level: 'المستوى',
      hearts: 'القلوب',
      start: 'ابدأ',
      next: 'التالي',
      retry: 'حاول مجددًا',
      tapToStart: 'انقر للبدء',
      correct: 'أحسنت!',
      wrong: 'ليس تمامًا',
      timeUp: 'انتهى الوقت',
      hint: 'تلميح',
      levelComplete: 'اكتمل المستوى',
      win: 'لقد فزت!',
      lose: 'انتهت اللعبة',
      takeBreak: 'لنأخذ استراحة',
      retryFromOne: 'حاول من المستوى الأول',
      quit: 'خروج',
      finalScore: 'النتيجة النهائية',
      mastery: 'الإتقان',
      accuracy: 'الدقة',
    },
  };

  const STATE = { lang: 'en', palette: null };

  function isRtl() {
    return STATE.lang === 'ar';
  }

  function setLanguage(lang) {
    STATE.lang = lang === 'ar' ? 'ar' : 'en';
  }

  function t(key, params) {
    const dict = I18N[STATE.lang] || I18N.en;
    let s = dict[key] || I18N.en[key] || key;
    if (params) {
      for (const k of Object.keys(params)) s = s.replace('{' + k + '}', String(params[k]));
    }
    return s;
  }

  function fontSize(en, ar) {
    return STATE.lang === 'ar' ? ar : en;
  }

  function textStyle(scene, opts) {
    opts = opts || {};
    const base = {
      fontFamily: isRtl() ? "'NotoArabic', sans-serif" : 'system-ui, sans-serif',
      fontSize: opts.size || (isRtl() ? '28px' : '24px'),
      color: opts.color || '#ffffff',
      align: opts.align || (isRtl() ? 'right' : 'left'),
      rtl: isRtl(),
      wordWrap: opts.wordWrap || null,
    };
    return base;
  }

  function addText(scene, x, y, str, opts) {
    const style = textStyle(scene, opts);
    const txt = scene.add.text(x, y, str, style);
    // Phaser 4 supports setStyle({rtl}); reinforce in case the spec built the style elsewhere
    txt.setStyle({ rtl: isRtl() });
    if (opts && opts.origin) txt.setOrigin(opts.origin[0], opts.origin[1]);
    return txt;
  }

  // ---------- HUDs ----------

  function makeScoreHud(scene, x, y) {
    const label = addText(scene, x, y, t('score') + ': 0', { size: '26px', origin: [isRtl() ? 1 : 0, 0] });
    let v = 0;
    return {
      set(n) {
        v = n;
        label.setText(t('score') + ': ' + v);
      },
      add(n) {
        v += n;
        label.setText(t('score') + ': ' + v);
      },
      value() {
        return v;
      },
    };
  }

  function makeTimerHud(scene, x, y, seconds, onTimeout) {
    const label = addText(scene, x, y, t('time') + ': ' + seconds, {
      size: '26px',
      origin: [isRtl() ? 0 : 1, 0],
    });
    let remaining = seconds;
    let running = false;
    let timerEvent = null;
    function tick() {
      if (!running) return;
      remaining -= 1;
      label.setText(t('time') + ': ' + Math.max(0, remaining));
      if (remaining <= 0) {
        running = false;
        if (onTimeout) onTimeout();
      }
    }
    return {
      start() {
        if (timerEvent) timerEvent.remove();
        running = true;
        timerEvent = scene.time.addEvent({ delay: 1000, loop: true, callback: tick });
      },
      pause() {
        running = false;
        if (timerEvent) timerEvent.paused = true;
      },
      resume() {
        running = true;
        if (timerEvent) timerEvent.paused = false;
      },
      reset(s) {
        remaining = s;
        label.setText(t('time') + ': ' + s);
      },
      stop() {
        running = false;
        if (timerEvent) {
          timerEvent.remove();
          timerEvent = null;
        }
      },
      remaining() {
        return remaining;
      },
    };
  }

  function makeHeartsHud(scene, x, y, count) {
    const hearts = [];
    const dir = isRtl() ? -1 : 1;
    for (let i = 0; i < count; i += 1) {
      const h = scene.add.text(x + i * 36 * dir, y, '♥', {
        fontFamily: 'sans-serif',
        fontSize: '32px',
        color: '#ff5577',
      });
      h.setOrigin(0.5);
      hearts.push(h);
    }
    let alive = count;
    return {
      lose() {
        if (alive <= 0) return;
        alive -= 1;
        const h = hearts[alive];
        if (h) h.setColor('#3a3a3a');
      },
      gain() {
        if (alive >= hearts.length) return;
        const h = hearts[alive];
        if (h) h.setColor('#ff5577');
        alive += 1;
      },
      count() {
        return alive;
      },
    };
  }

  function makeLevelHud(scene, x, y, currentLevel, maxLevel) {
    const label = addText(
      scene,
      x,
      y,
      t('level') + ' ' + currentLevel + '/' + maxLevel,
      { size: '24px', origin: [0.5, 0] },
    );
    return {
      set(cur, max) {
        label.setText(t('level') + ' ' + cur + '/' + max);
      },
    };
  }

  function makeProgressBar(scene, x, y, w, h) {
    const bg = scene.add.rectangle(x, y, w, h, 0x222831).setOrigin(isRtl() ? 1 : 0, 0.5);
    const fill = scene.add.rectangle(x, y, 0, h, 0x4ade80).setOrigin(isRtl() ? 1 : 0, 0.5);
    return {
      set(ratio) {
        const r = Math.max(0, Math.min(1, ratio));
        fill.width = w * r;
      },
    };
  }

  // ---------- Toasts ----------

  function showCorrect(scene, x, y, scoreGained) {
    const msg = t('correct') + (scoreGained ? ' +' + scoreGained : '');
    const text = addText(scene, x, y, msg, { size: '32px', color: '#4ade80', origin: [0.5, 0.5] });
    scene.tweens.add({
      targets: text,
      y: y - 40,
      alpha: 0,
      duration: 900,
      onComplete: () => text.destroy(),
    });
    cues.correct();
  }

  function showWrong(scene, x, y, explanation) {
    const text = addText(scene, x, y, t('wrong'), {
      size: '32px',
      color: '#f87171',
      origin: [0.5, 0.5],
    });
    let exp = null;
    if (explanation) {
      exp = addText(scene, x, y + 40, explanation, {
        size: '20px',
        color: '#fbbf24',
        origin: [0.5, 0.5],
        wordWrap: { width: 480 },
      });
    }
    scene.tweens.add({
      targets: [text, exp].filter(Boolean),
      alpha: 0,
      duration: 1600,
      delay: 600,
      onComplete: () => {
        text.destroy();
        if (exp) exp.destroy();
      },
    });
    cues.wrong();
  }

  function showHint(scene, x, y, hintText) {
    const bg = scene.add.rectangle(x, y, 520, 80, 0x1f2937, 0.95).setOrigin(0.5);
    const text = addText(scene, x, y, t('hint') + ': ' + hintText, {
      size: '22px',
      color: '#fde68a',
      origin: [0.5, 0.5],
      wordWrap: { width: 480 },
    });
    scene.tweens.add({
      targets: [bg, text],
      alpha: 0,
      duration: 2000,
      delay: 1500,
      onComplete: () => {
        bg.destroy();
        text.destroy();
      },
    });
  }

  // ---------- Audio (Web Audio API, gated behind first tap) ----------

  let audioCtx = null;
  function ctx() {
    if (audioCtx) return audioCtx;
    try {
      audioCtx = new (global.AudioContext || global.webkitAudioContext)();
    } catch (e) {
      audioCtx = null;
    }
    return audioCtx;
  }
  function beep(freq, durationMs, type, gain) {
    const a = ctx();
    if (!a) return;
    const osc = a.createOscillator();
    const g = a.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    g.gain.value = gain || 0.08;
    osc.connect(g);
    g.connect(a.destination);
    osc.start();
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + durationMs / 1000);
    osc.stop(a.currentTime + durationMs / 1000);
  }
  const cues = {
    correct: () => beep(880, 140, 'sine', 0.12),
    wrong: () => beep(180, 220, 'square', 0.08),
    levelUp: () => {
      beep(660, 120, 'triangle', 0.1);
      setTimeout(() => beep(990, 180, 'triangle', 0.1), 130);
    },
    win: () => {
      [660, 880, 1100].forEach((f, i) => setTimeout(() => beep(f, 200, 'triangle', 0.12), i * 180));
    },
    lose: () => beep(110, 480, 'sawtooth', 0.1),
    tick: () => beep(440, 50, 'sine', 0.04),
  };

  // ---------- Palette ----------

  function applyPalette(palette) {
    STATE.palette = palette;
  }

  // ---------- AdaptiveEngine ----------

  function AdaptiveEngineCreate(spec) {
    const totalLevels = 5;
    const maxLevels = 7;
    const levelHistory = [];
    const conceptStats = new Map();
    const sessionStart = Date.now();
    let currentLevel = 1;
    let lowStreak = 0;

    function trackConcepts(items, correctIds) {
      const correctSet = new Set(correctIds);
      for (const item of items) {
        for (const c of item.concepts) {
          const s = conceptStats.get(c) || { attempts: 0, correct: 0 };
          s.attempts += 1;
          if (correctSet.has(item.id)) s.correct += 1;
          conceptStats.set(c, s);
        }
      }
    }

    function scoreLevel({ correct, attempts, timeUsedMs, timeLimitMs, hintsUsed, maxHints }) {
      const accAttempts = attempts > 0 ? correct / attempts : 0;
      const timeRatio = timeLimitMs > 0 ? Math.min(1, timeUsedMs / timeLimitMs) : 0;
      const timeComponent = timeLimitMs > 0 ? 1 - timeRatio : 1;
      const hintRatio = maxHints > 0 ? hintsUsed / maxHints : 0;
      const raw = accAttempts * 0.7 + timeComponent * 0.2 + (1 - hintRatio) * 0.1;
      return Math.max(0, Math.min(1, raw));
    }

    function nextDelta(score) {
      if (score >= 0.85) return 2;
      if (score >= 0.65) return 1;
      if (score >= 0.4) return 0;
      return -1;
    }

    function masteryAchieved() {
      const last = levelHistory[levelHistory.length - 1];
      if (last && last.adaptedLevel === 5 && last.score >= 0.75) return true;
      if (levelHistory.length >= 3) {
        const tail = levelHistory.slice(-3);
        if (tail.every((l) => l.score >= 0.8)) return true;
      }
      return false;
    }

    function frustrationTriggered() {
      if (levelHistory.length < 3) return false;
      const tail = levelHistory.slice(-3);
      return tail.every((l) => l.score < 0.4);
    }

    function completeLevel(input) {
      const score = scoreLevel(input);
      const accuracy = input.attempts > 0 ? input.correct / input.attempts : 0;
      const delta = nextDelta(score);
      let adaptedNext = currentLevel + delta;
      if (delta === 0) adaptedNext = currentLevel;
      adaptedNext = Math.max(1, Math.min(totalLevels, adaptedNext));

      if (input.correctItems && input.attemptedItems) {
        trackConcepts(input.attemptedItems, input.correctItems);
      }

      levelHistory.push({
        adaptedLevel: currentLevel,
        score,
        accuracy,
        durationMs: input.timeUsedMs,
      });

      if (score < 0.4) lowStreak += 1;
      else lowStreak = 0;

      const sessionLevels = levelHistory.length;
      const stopReason = (() => {
        if (masteryAchieved()) return 'mastery';
        if (frustrationTriggered()) return 'frustration';
        if (sessionLevels >= maxLevels) return 'cap';
        return null;
      })();

      currentLevel = adaptedNext;
      return {
        score,
        accuracy,
        nextLevel: currentLevel,
        durationMs: input.timeUsedMs,
        stopReason,
        bonusHeart: delta === 0,
      };
    }

    function buildSummary() {
      const conceptMastery = [];
      for (const concept of spec.concepts) {
        const s = conceptStats.get(concept.id) || { attempts: 0, correct: 0 };
        const acc = s.attempts > 0 ? s.correct / s.attempts : 0;
        conceptMastery.push({
          conceptId: concept.id,
          conceptLabel: concept.label,
          attempts: s.attempts,
          correct: s.correct,
          mastered: s.attempts >= 3 && acc >= 0.75,
        });
      }
      const strengths = conceptMastery.filter((c) => c.mastered).map((c) => c.conceptLabel);
      const growthAreas = conceptMastery
        .filter((c) => c.attempts > 0 && !c.mastered)
        .map((c) => c.conceptLabel);

      const totalAttempts = conceptMastery.reduce((s, c) => s + c.attempts, 0);
      const totalCorrect = conceptMastery.reduce((s, c) => s + c.correct, 0);
      const totalDuration = levelHistory.reduce((s, l) => s + l.durationMs, 0);
      const avgResponse = totalAttempts > 0 ? Math.round(totalDuration / totalAttempts) : 0;
      const highest = levelHistory.reduce((m, l) => Math.max(m, l.adaptedLevel), 0);

      return {
        topic: spec.topic,
        subject: spec.subject,
        durationSeconds: Math.round((Date.now() - sessionStart) / 1000),
        levelsPlayed: levelHistory.length,
        highestLevelReached: highest,
        masteryAchieved: masteryAchieved(),
        totalScore: Math.round(
          levelHistory.reduce((s, l) => s + l.score, 0) * 100,
        ),
        overallAccuracy: totalAttempts > 0 ? totalCorrect / totalAttempts : 0,
        averageResponseTimeMs: avgResponse,
        conceptMastery,
        strengths,
        growthAreas,
        recommendedNextTopics: [],
      };
    }

    return {
      get currentLevel() {
        return currentLevel;
      },
      completeLevel,
      buildSummary,
      levelHistory: () => levelHistory.slice(),
      stopReason: () => {
        if (masteryAchieved()) return 'mastery';
        if (frustrationTriggered()) return 'frustration';
        if (levelHistory.length >= maxLevels) return 'cap';
        return null;
      },
    };
  }

  // ---------- Built menu / end scenes ----------

  function buildMenuScene(spec, onStart) {
    return class MenuScene extends Phaser.Scene {
      constructor() {
        super('MenuScene');
      }
      create() {
        const cx = this.scale.width / 2;
        const cy = this.scale.height / 2;
        addText(this, cx, cy - 200, spec.topic, {
          size: isRtl() ? '40px' : '36px',
          color: '#ffffff',
          origin: [0.5, 0.5],
          wordWrap: { width: this.scale.width - 80 },
        });
        addText(this, cx, cy - 120, spec.subject, {
          size: isRtl() ? '28px' : '24px',
          color: '#9ca3af',
          origin: [0.5, 0.5],
        });
        const btn = this.add.rectangle(cx, cy + 80, 280, 90, 0x4ade80).setInteractive({ useHandCursor: true });
        addText(this, cx, cy + 80, t('start'), {
          size: '32px',
          color: '#0a0a0a',
          origin: [0.5, 0.5],
        });
        btn.on('pointerup', () => {
          ctx();
          this.scene.start('GameScene');
          if (onStart) onStart();
        });
      }
    };
  }

  function buildEndScene(getSummary, onReplay, onExit) {
    return class EndScene extends Phaser.Scene {
      constructor() {
        super('EndScene');
      }
      create() {
        const summary = getSummary();
        const cx = this.scale.width / 2;
        let y = 120;
        addText(this, cx, y, summary.masteryAchieved ? t('win') : t('lose'), {
          size: '44px',
          color: summary.masteryAchieved ? '#4ade80' : '#fbbf24',
          origin: [0.5, 0.5],
        });
        y += 80;
        addText(this, cx, y, t('finalScore') + ': ' + summary.totalScore, {
          size: '30px',
          origin: [0.5, 0.5],
        });
        y += 50;
        addText(
          this,
          cx,
          y,
          t('accuracy') + ': ' + Math.round(summary.overallAccuracy * 100) + '%',
          { size: '26px', origin: [0.5, 0.5] },
        );
        y += 50;
        addText(this, cx, y, t('level') + ': ' + summary.highestLevelReached, {
          size: '26px',
          origin: [0.5, 0.5],
        });
        y += 80;
        const replay = this.add
          .rectangle(cx - 120, y, 200, 80, 0x4ade80)
          .setInteractive({ useHandCursor: true });
        addText(this, cx - 120, y, t('retry'), { size: '24px', color: '#0a0a0a', origin: [0.5, 0.5] });
        replay.on('pointerup', () => onReplay && onReplay());
        const exit = this.add
          .rectangle(cx + 120, y, 200, 80, 0x374151)
          .setInteractive({ useHandCursor: true });
        addText(this, cx + 120, y, t('quit'), { size: '24px', color: '#ffffff', origin: [0.5, 0.5] });
        exit.on('pointerup', () => onExit && onExit());

        cues[summary.masteryAchieved ? 'win' : 'lose']();
      }
    };
  }

  // ---------- Sprites ----------
  // Preload base64 sprite data URIs from window.EduSprites into Phaser textures by key.
  // Call inside a scene's preload(): EduCore.preloadSprites(this, ['player','road','horizon'])
  function preloadSprites(scene, roles) {
    const lib = (global.EduSprites && global.EduSprites.library) || {};
    for (const role of roles) {
      const uri = lib[role];
      if (uri && !scene.textures.exists('lib:' + role)) {
        scene.load.image('lib:' + role, uri);
      }
    }
  }
  function preloadGeneratedConcepts(scene, conceptIds) {
    const gen = (global.EduSprites && global.EduSprites.generated) || {};
    for (const id of conceptIds) {
      const uri = gen[id];
      if (uri && !scene.textures.exists('gen:' + id)) {
        scene.load.image('gen:' + id, uri);
      }
    }
  }
  function hasSprite(role) {
    const lib = (global.EduSprites && global.EduSprites.library) || {};
    return Boolean(lib[role]);
  }
  function hasGeneratedSprite(conceptId) {
    const gen = (global.EduSprites && global.EduSprites.generated) || {};
    return Boolean(gen[conceptId]);
  }

  // ---------- Level-complete overlay (used by all 4 new archetypes) ----------
  // Pauses the action visually, shows score/accuracy, then calls onDismiss().
  function showLevelComplete(scene, info, onDismiss) {
    const cx = scene.scale.width / 2;
    const cy = scene.scale.height / 2;
    const dim = scene.add.rectangle(cx, cy, scene.scale.width, scene.scale.height, 0x000000, 0.65).setDepth(900);
    const card = scene.add.rectangle(cx, cy, 540, 380, 0x1f2937, 0.96).setStrokeStyle(3, 0x4ade80).setDepth(901);
    const title = addText(scene, cx, cy - 130, t('levelComplete'), { size: '36px', color: '#4ade80', origin: [0.5, 0.5] });
    title.setDepth(902);
    const scoreLine = addText(scene, cx, cy - 60, t('score') + ': ' + Math.round(info.score * 100), { size: '28px', origin: [0.5, 0.5] });
    scoreLine.setDepth(902);
    const accLine = addText(scene, cx, cy - 10, t('accuracy') + ': ' + Math.round(info.accuracy * 100) + '%', { size: '24px', color: '#fbbf24', origin: [0.5, 0.5] });
    accLine.setDepth(902);
    const direction =
      info.delta >= 2 ? (isRtl() ? 'مستوى أعلى مرتين' : 'Level UP +2!') :
      info.delta === 1 ? (isRtl() ? 'مستوى أعلى' : 'Level up!') :
      info.delta === 0 ? (isRtl() ? 'إعادة بقلب إضافي' : 'Same level — bonus heart') :
      (isRtl() ? 'أخف قليلًا' : 'A bit easier next');
    const dirText = addText(scene, cx, cy + 40, direction, { size: '22px', color: '#a78bfa', origin: [0.5, 0.5] });
    dirText.setDepth(902);
    const btn = scene.add.rectangle(cx, cy + 130, 240, 80, 0x4ade80).setInteractive({ useHandCursor: true }).setDepth(902);
    const btnTxt = addText(scene, cx, cy + 130, t('next'), { size: '28px', color: '#0a0a0a', origin: [0.5, 0.5] });
    btnTxt.setDepth(903);
    btn.on('pointerup', () => {
      [dim, card, title, scoreLine, accLine, dirText, btn, btnTxt].forEach((o) => o.destroy());
      cues.levelUp();
      onDismiss && onDismiss();
    });
  }

  global.EduCore = {
    setLanguage,
    t,
    isRtl,
    addText,
    fontSize,
    makeScoreHud,
    makeTimerHud,
    makeHeartsHud,
    makeLevelHud,
    makeProgressBar,
    showCorrect,
    showWrong,
    showHint,
    showLevelComplete,
    preloadSprites,
    preloadGeneratedConcepts,
    hasSprite,
    hasGeneratedSprite,
    AdaptiveEngine: { create: AdaptiveEngineCreate },
    buildMenuScene,
    buildEndScene,
    cues,
    applyPalette,
    version: '1.1.0',
  };
})(window);
