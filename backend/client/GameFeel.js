// GameFeel.js — the juice library.
// Vanilla JS, no framework, inlined into every generated EduMind game.
// Exposed globally as window.GameFeel.
//
// Design rules:
//  - 60fps on mobile WebView with a hard ≤50 simultaneous object cap. Particles are pooled.
//  - Web Audio API only. No sample files. Oscillators + filtered noise.
//  - Respectful by default. Flashes capped at 100ms, never red strobes, no harsh punishment.
//  - Intensity 1–10. 3 = "default polish", 7 = "big moment", 10 = "boss kill".
//  - Combo-aware audio: each consecutive correct rises one semitone (capped at +12 = +1 octave).
//
// Public API at the bottom of the file (see `global.GameFeel = {...}`).
(function (global) {
  'use strict';

  // ---------------------------------------------------------------------------
  // Audio engine
  // ---------------------------------------------------------------------------
  let audioCtx = null;
  let masterGain = null;
  let musicLoopHandle = null;
  let lastCueAt = {};      // event-type → timestamp, used to avoid same-cue repetition
  let lastCueVariant = {}; // event-type → variant index, rotated to vary timbre
  let comboPitchStep = 0;  // current pitch offset (semitones) for correctChain

  function ctx() {
    if (audioCtx) return audioCtx;
    try {
      audioCtx = new (global.AudioContext || global.webkitAudioContext)();
      masterGain = audioCtx.createGain();
      masterGain.gain.value = 0.6;
      masterGain.connect(audioCtx.destination);
    } catch (e) {
      audioCtx = null;
    }
    return audioCtx;
  }

  // Convert MIDI-like semitone offset from a base frequency.
  function semitone(baseHz, st) {
    return baseHz * Math.pow(2, st / 12);
  }

  // Schedule a single tone. opts: { freq, type, durationMs, attackMs, releaseMs, gain, detune }
  function tone(opts) {
    const a = ctx();
    if (!a) return;
    const t0 = a.currentTime;
    const osc = a.createOscillator();
    const g = a.createGain();
    osc.type = opts.type || 'sine';
    osc.frequency.value = opts.freq;
    if (typeof opts.detune === 'number') osc.detune.value = opts.detune;
    const peak = opts.gain != null ? opts.gain : 0.12;
    const dur = (opts.durationMs || 140) / 1000;
    const attack = (opts.attackMs || 6) / 1000;
    const release = Math.min(dur, (opts.releaseMs || 80) / 1000);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(masterGain || a.destination);
    osc.start(t0);
    osc.stop(t0 + dur + release);
  }

  // Schedule a chord — array of {freq, gain?, detune?, type?, durationMs?}.
  function chord(notes, opts) {
    const o = opts || {};
    for (const n of notes) {
      tone({
        freq: n.freq,
        type: n.type || o.type || 'triangle',
        durationMs: n.durationMs || o.durationMs || 220,
        gain: (n.gain != null ? n.gain : (o.gain != null ? o.gain : 0.08)),
        attackMs: o.attackMs || 4,
        releaseMs: o.releaseMs || 200,
        detune: n.detune || 0,
      });
    }
  }

  // Filtered noise burst. Used for crowd murmur, woosh, impact crunch.
  function noiseBurst(opts) {
    const a = ctx();
    if (!a) return;
    const dur = (opts.durationMs || 180) / 1000;
    const t0 = a.currentTime;
    const bufferLen = Math.max(1, Math.floor(a.sampleRate * dur));
    const buf = a.createBuffer(1, bufferLen, a.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufferLen; i += 1) data[i] = (Math.random() * 2 - 1) * 0.6;
    const src = a.createBufferSource();
    src.buffer = buf;
    const filter = a.createBiquadFilter();
    filter.type = opts.filterType || 'bandpass';
    filter.frequency.value = opts.filterHz || 900;
    filter.Q.value = opts.q || 4;
    const g = a.createGain();
    const peak = opts.gain != null ? opts.gain : 0.18;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(masterGain || a.destination);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  function rotateVariant(key, max) {
    const v = ((lastCueVariant[key] || 0) + 1) % max;
    lastCueVariant[key] = v;
    return v;
  }

  // ----- Audio cues -----
  const audio = {
    correct() {
      const variant = rotateVariant('correct', 3);
      const base = [523.25, 587.33, 659.25][variant]; // C5 / D5 / E5
      chord([
        { freq: base, type: 'triangle' },
        { freq: base * 1.5, gain: 0.05 },
        { freq: base * 2, gain: 0.03 },
      ], { durationMs: 200 });
    },
    correctChain(n) {
      // Each consecutive correct rises one semitone, capped at +12.
      const st = Math.min(Math.max(0, n - 1), 12);
      comboPitchStep = st;
      const base = semitone(523.25, st);
      chord([
        { freq: base, type: 'triangle' },
        { freq: base * 1.25, gain: 0.06 },
        { freq: base * 1.5, gain: 0.045 },
      ], { durationMs: 220 });
      // High sparkle layer for combos ≥3
      if (n >= 3) {
        global.setTimeout(() => tone({ freq: base * 4, durationMs: 110, gain: 0.04, type: 'sine' }), 60);
      }
    },
    wrong() {
      // Subtle low thump — never punishing. Two close-pitch tones for body.
      tone({ freq: 180, type: 'triangle', durationMs: 180, gain: 0.10 });
      tone({ freq: 150, type: 'sine', durationMs: 200, gain: 0.06 });
      comboPitchStep = 0;
    },
    impact() {
      noiseBurst({ durationMs: 90, filterType: 'lowpass', filterHz: 600, q: 1, gain: 0.22 });
      tone({ freq: 110, type: 'square', durationMs: 90, gain: 0.10 });
    },
    woosh() {
      noiseBurst({ durationMs: 220, filterType: 'bandpass', filterHz: 2000, q: 6, gain: 0.10 });
    },
    levelUp() {
      // Ascending fanfare: C → E → G → C'
      const seq = [523.25, 659.25, 783.99, 1046.5];
      seq.forEach((f, i) => global.setTimeout(() => tone({ freq: f, type: 'triangle', durationMs: 180, gain: 0.10 }), i * 90));
    },
    powerUp() {
      // Upward sparkle: fast frequency sweep via stepped tones
      const a = ctx();
      if (!a) return;
      for (let i = 0; i < 8; i += 1) {
        const f = 440 * Math.pow(2, i / 12);
        global.setTimeout(() => tone({ freq: f, type: 'sine', durationMs: 60, gain: 0.05 }), i * 30);
      }
    },
    countdownTick() {
      tone({ freq: 440, type: 'sine', durationMs: 80, gain: 0.10 });
    },
    countdownGo() {
      tone({ freq: 880, type: 'triangle', durationMs: 200, gain: 0.14 });
      tone({ freq: 1320, type: 'sine', durationMs: 200, gain: 0.07 });
    },
    countdownFinal() {
      // "3, 2, 1" — each note distinct
      tone({ freq: 392, type: 'triangle', durationMs: 120, gain: 0.12 });
    },
    crowdCheer() {
      noiseBurst({ durationMs: 700, filterType: 'bandpass', filterHz: 700, q: 2, gain: 0.16 });
      noiseBurst({ durationMs: 700, filterType: 'bandpass', filterHz: 1400, q: 1.5, gain: 0.10 });
    },
    engineRev() {
      // Sawtooth ramping up — fake engine
      const a = ctx();
      if (!a) return;
      const osc = a.createOscillator();
      const g = a.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(80, a.currentTime);
      osc.frequency.exponentialRampToValueAtTime(220, a.currentTime + 0.4);
      g.gain.setValueAtTime(0.0001, a.currentTime);
      g.gain.exponentialRampToValueAtTime(0.12, a.currentTime + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + 0.5);
      osc.connect(g);
      g.connect(masterGain || a.destination);
      osc.start();
      osc.stop(a.currentTime + 0.55);
    },
    swordSlash() {
      noiseBurst({ durationMs: 220, filterType: 'highpass', filterHz: 2400, q: 8, gain: 0.18 });
      tone({ freq: 1200, type: 'triangle', durationMs: 120, gain: 0.07 });
    },
    // v3 streak / XP / goal cues
    streakExtended() {
      // Two-tone ascending woosh, plus a sparkle. Used when streak day++ on completion.
      noiseBurst({ durationMs: 280, filterType: 'highpass', filterHz: 1800, q: 4, gain: 0.10 });
      tone({ freq: 880, type: 'triangle', durationMs: 180, gain: 0.10 });
      global.setTimeout(() => tone({ freq: 1320, type: 'triangle', durationMs: 240, gain: 0.10 }), 150);
    },
    xpGain() {
      // Single shimmer tick — UI plays this per-XP at 30ms intervals (capped at 20 reps).
      tone({ freq: 1760, type: 'sine', durationMs: 50, gain: 0.05 });
    },
    goalReached() {
      // Daily goal fanfare — a slightly grander variant of levelUp.
      const seq = [659.25, 880, 1046.5, 1318.5, 1760];
      seq.forEach((f, i) => global.setTimeout(() => tone({ freq: f, type: 'triangle', durationMs: 200, gain: 0.11 }), i * 80));
    },
    setMusicLoop(pattern) {
      this.stopMusic();
      const a = ctx();
      if (!a || !pattern || !pattern.notes || pattern.notes.length === 0) return;
      const step = pattern.stepMs || 380;
      let i = 0;
      musicLoopHandle = global.setInterval(() => {
        const note = pattern.notes[i % pattern.notes.length];
        tone({ freq: note, type: 'sine', durationMs: step * 0.9, gain: 0.035 });
        i += 1;
      }, step);
    },
    stopMusic() {
      if (musicLoopHandle != null) {
        global.clearInterval(musicLoopHandle);
        musicLoopHandle = null;
      }
    },
  };

  // ---------------------------------------------------------------------------
  // Particle pool
  // ---------------------------------------------------------------------------
  // We pool Phaser.Rectangle/Circle objects per scene to respect the 50-object cap.
  // pool is keyed by scene.sys.settings.key (or 'default') → array of free particles.
  const pools = new Map();
  function poolFor(scene) {
    const key = scene && scene.sys && scene.sys.settings ? scene.sys.settings.key : 'default';
    if (!pools.has(key)) pools.set(key, { free: [], active: [], cap: 36 });
    return pools.get(key);
  }
  function acquireParticle(scene, color) {
    const p = poolFor(scene);
    let obj = p.free.pop();
    if (!obj) {
      if (p.active.length >= p.cap) return null;
      obj = scene.add.rectangle(0, 0, 6, 6, color);
      obj.setDepth(900);
    } else {
      obj.setFillStyle(color);
      obj.setActive(true).setVisible(true);
    }
    p.active.push(obj);
    return obj;
  }
  function releaseParticle(p, obj) {
    if (!obj || !obj.scene) return;
    obj.setActive(false).setVisible(false);
    obj.setAlpha(1);
    obj.setScale(1);
    obj.setRotation(0);
    const idx = p.active.indexOf(obj);
    if (idx >= 0) p.active.splice(idx, 1);
    p.free.push(obj);
  }

  // ---------------------------------------------------------------------------
  // Screen-level effects
  // ---------------------------------------------------------------------------
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

  function screenShake(scene, intensity, durationMs) {
    if (!scene || !scene.cameras) return;
    const i = clamp(intensity || 3, 1, 10);
    const dur = durationMs || 200;
    // Map intensity 1-10 to ~0.002-0.02 amplitude (proportion of viewport).
    const amp = 0.002 + (i - 1) * 0.002;
    scene.cameras.main.shake(dur, amp);
  }

  function screenFlash(scene, color, durationMs) {
    if (!scene || !scene.cameras) return;
    // Photosensitivity guard — cap at 100ms and never pure red.
    const dur = clamp(durationMs || 80, 30, 100);
    const c = (typeof color === 'number') ? color : 0xffffff;
    // Block pure-red strobes
    const r = (c >> 16) & 0xff;
    const g = (c >> 8) & 0xff;
    const b = c & 0xff;
    const safeColor = (r > 200 && g < 60 && b < 60) ? 0xffeebb : c;
    scene.cameras.main.flash(dur, (safeColor >> 16) & 0xff, (safeColor >> 8) & 0xff, safeColor & 0xff);
  }

  function hitstop(scene, durationMs) {
    if (!scene || !scene.time) return;
    const prev = scene.time.timeScale;
    scene.time.timeScale = 0;
    if (scene.tweens) scene.tweens.timeScale = 0;
    global.setTimeout(() => {
      try {
        scene.time.timeScale = prev || 1;
        if (scene.tweens) scene.tweens.timeScale = prev || 1;
      } catch (e) { /* ignore */ }
    }, clamp(durationMs || 80, 30, 200));
  }

  function slowmo(scene, factor, durationMs) {
    if (!scene || !scene.tweens) return;
    const prev = scene.time.timeScale;
    const f = clamp(factor || 0.4, 0.1, 0.95);
    scene.time.timeScale = f;
    if (scene.tweens) scene.tweens.timeScale = f;
    global.setTimeout(() => {
      try {
        scene.time.timeScale = prev || 1;
        if (scene.tweens) scene.tweens.timeScale = prev || 1;
      } catch (e) { /* ignore */ }
    }, durationMs || 500);
  }

  function zoomPunch(scene, scaleAmount, durationMs) {
    if (!scene || !scene.cameras) return;
    const amt = scaleAmount || 0.08;
    const dur = durationMs || 280;
    const cam = scene.cameras.main;
    const base = cam.zoom || 1;
    scene.tweens.add({
      targets: cam,
      zoom: base + amt,
      duration: dur * 0.3,
      yoyo: true,
      ease: 'sine.out',
      onComplete: () => { cam.zoom = base; },
    });
  }

  // ---------------------------------------------------------------------------
  // Object-level juice
  // ---------------------------------------------------------------------------
  function squashStretch(obj, axis, amount, durationMs) {
    if (!obj || !obj.scene) return;
    const amt = amount || 0.15;
    const dur = durationMs || 160;
    const sx = axis === 'y' ? 1 - amt : 1 + amt;
    const sy = axis === 'y' ? 1 + amt : 1 - amt;
    const baseX = obj.scaleX || 1;
    const baseY = obj.scaleY || 1;
    obj.scene.tweens.add({
      targets: obj,
      scaleX: baseX * sx,
      scaleY: baseY * sy,
      duration: dur * 0.4,
      yoyo: true,
      ease: 'sine.out',
      onComplete: () => { obj.setScale(baseX, baseY); },
    });
  }

  function bounceIn(obj, fromScale, durationMs) {
    if (!obj || !obj.scene) return;
    const baseX = obj.scaleX || 1;
    const baseY = obj.scaleY || 1;
    obj.setScale((fromScale || 0.2) * baseX, (fromScale || 0.2) * baseY);
    obj.scene.tweens.add({
      targets: obj,
      scaleX: baseX,
      scaleY: baseY,
      duration: durationMs || 380,
      ease: 'back.out(2.2)',
    });
  }

  function objShake(obj, intensity, durationMs) {
    if (!obj || !obj.scene) return;
    const i = clamp(intensity || 3, 1, 10);
    const amp = 1 + i * 0.6;
    const dur = durationMs || 220;
    const x0 = obj.x;
    const y0 = obj.y;
    const start = Date.now();
    const handle = obj.scene.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => {
        const t = Date.now() - start;
        if (t >= dur) {
          obj.x = x0; obj.y = y0;
          handle.remove();
          return;
        }
        const dampen = 1 - t / dur;
        obj.x = x0 + (Math.random() * 2 - 1) * amp * dampen;
        obj.y = y0 + (Math.random() * 2 - 1) * amp * dampen;
      },
    });
  }

  function pulse(obj, scaleAmount, durationMs) {
    if (!obj || !obj.scene) return;
    const amt = scaleAmount || 0.06;
    const dur = durationMs || 700;
    const baseX = obj.scaleX || 1;
    const baseY = obj.scaleY || 1;
    obj.scene.tweens.add({
      targets: obj,
      scaleX: baseX * (1 + amt),
      scaleY: baseY * (1 + amt),
      duration: dur / 2,
      yoyo: true,
      repeat: -1,
      ease: 'sine.inOut',
    });
  }

  function wobble(obj, angleDeg, durationMs) {
    if (!obj || !obj.scene) return;
    const a = (angleDeg || 6) * Math.PI / 180;
    const dur = durationMs || 800;
    obj.scene.tweens.add({
      targets: obj,
      rotation: { from: -a, to: a },
      duration: dur / 4,
      yoyo: true,
      repeat: 3,
      ease: 'sine.inOut',
      onComplete: () => { obj.setRotation(0); },
    });
  }

  // ---------------------------------------------------------------------------
  // Particle bursts
  // ---------------------------------------------------------------------------
  function burst(scene, x, y, opts) {
    if (!scene) return;
    const o = opts || {};
    const count = clamp(o.count || 12, 1, 24);
    const colors = o.colors || [0xfbbf24, 0xff4d6d, 0x5eead4];
    const speed = o.speed || 200;
    const spread = o.spread || Math.PI * 2;
    const angle0 = o.angle != null ? o.angle : -Math.PI / 2;
    const life = o.life || 600;
    const p = poolFor(scene);
    for (let i = 0; i < count; i += 1) {
      const part = acquireParticle(scene, colors[i % colors.length]);
      if (!part) break;
      part.x = x; part.y = y;
      part.setScale(0.8 + Math.random() * 0.6);
      part.setAlpha(1);
      const a = angle0 + (Math.random() - 0.5) * spread;
      const v = speed * (0.6 + Math.random() * 0.6);
      const tx = x + Math.cos(a) * v * (life / 1000);
      const ty = y + Math.sin(a) * v * (life / 1000) + 60 * (life / 1000);
      scene.tweens.add({
        targets: part,
        x: tx,
        y: ty,
        alpha: 0,
        scaleX: 0.2,
        scaleY: 0.2,
        rotation: (Math.random() - 0.5) * 4,
        duration: life,
        ease: 'cubic.out',
        onComplete: () => releaseParticle(p, part),
      });
    }
  }

  function confetti(scene, x, y, count, palette) {
    if (!scene) return;
    const cnt = clamp(count || 18, 1, 30);
    const colors = palette || [0xff4d6d, 0xfbbf24, 0x5eead4, 0xa78bfa];
    const p = poolFor(scene);
    for (let i = 0; i < cnt; i += 1) {
      const part = acquireParticle(scene, colors[i % colors.length]);
      if (!part) break;
      part.x = x + (Math.random() - 0.5) * 200;
      part.y = y - 20;
      part.setScale(1.2, 0.6);
      part.setAlpha(1);
      const fallY = y + 600 + Math.random() * 300;
      const driftX = part.x + (Math.random() - 0.5) * 220;
      scene.tweens.add({
        targets: part,
        x: driftX,
        y: fallY,
        rotation: (Math.random() - 0.5) * 8,
        alpha: { from: 1, to: 0 },
        duration: 1400 + Math.random() * 600,
        ease: 'cubic.in',
        onComplete: () => releaseParticle(p, part),
      });
    }
  }

  function sparkle(scene, x, y, count) {
    if (!scene) return;
    const cnt = clamp(count || 8, 1, 16);
    const colors = [0xfff7c0, 0xfbbf24, 0xffffff];
    const p = poolFor(scene);
    for (let i = 0; i < cnt; i += 1) {
      const part = acquireParticle(scene, colors[i % colors.length]);
      if (!part) break;
      part.x = x + (Math.random() - 0.5) * 40;
      part.y = y + (Math.random() - 0.5) * 40;
      part.setScale(0.4 + Math.random() * 0.6);
      part.setAlpha(1);
      scene.tweens.add({
        targets: part,
        scaleX: { from: 0.2, to: 1.4 },
        scaleY: { from: 0.2, to: 1.4 },
        alpha: { from: 1, to: 0 },
        rotation: Math.random() * Math.PI,
        duration: 500 + Math.random() * 300,
        ease: 'sine.out',
        onComplete: () => releaseParticle(p, part),
      });
    }
  }

  function trail(obj) {
    if (!obj || !obj.scene) return null;
    const scene = obj.scene;
    let active = true;
    const handle = scene.time.addEvent({
      delay: 50,
      loop: true,
      callback: () => {
        if (!active || !obj.scene) return;
        const p = poolFor(scene);
        const part = acquireParticle(scene, 0xfbbf24);
        if (!part) return;
        part.x = obj.x;
        part.y = obj.y;
        part.setScale(0.6);
        part.setAlpha(0.6);
        scene.tweens.add({
          targets: part,
          alpha: 0,
          scaleX: 0.2,
          scaleY: 0.2,
          duration: 420,
          onComplete: () => releaseParticle(p, part),
        });
      },
    });
    return {
      stop() {
        active = false;
        if (handle) handle.remove();
      },
    };
  }

  function ringPop(scene, x, y, color) {
    if (!scene) return;
    const ring = scene.add.circle(x, y, 8, 0x000000, 0);
    ring.setStrokeStyle(3, color || 0xfbbf24, 1);
    ring.setDepth(950);
    scene.tweens.add({
      targets: ring,
      scaleX: 6,
      scaleY: 6,
      alpha: 0,
      duration: 420,
      ease: 'cubic.out',
      onComplete: () => ring.destroy(),
    });
  }

  // ---------------------------------------------------------------------------
  // Score popups
  // ---------------------------------------------------------------------------
  function scorePopup(scene, x, y, text, color) {
    if (!scene) return;
    const t = scene.add.text(x, y, text, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '28px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#0a0a0a',
      strokeThickness: 4,
    });
    if (typeof color === 'number') t.setColor('#' + color.toString(16).padStart(6, '0'));
    t.setOrigin(0.5);
    t.setDepth(960);
    t.setScale(0.4);
    scene.tweens.add({
      targets: t,
      scaleX: 1, scaleY: 1,
      duration: 140,
      ease: 'back.out(2.5)',
    });
    const vx = (Math.random() - 0.5) * 80;
    scene.tweens.add({
      targets: t,
      x: x + vx,
      y: y - 80,
      alpha: { from: 1, to: 0 },
      duration: 900,
      delay: 80,
      ease: 'cubic.out',
      onComplete: () => t.destroy(),
    });
  }

  function comboPopup(scene, x, y, comboCount) {
    if (!scene) return;
    const n = comboCount || 2;
    const txt = 'x' + n + ' COMBO';
    const color = n >= 5 ? 0xff4d6d : (n >= 3 ? 0xfbbf24 : 0xffffff);
    const t = scene.add.text(x, y, txt, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: (24 + Math.min(n, 8) * 3) + 'px',
      fontStyle: 'bold',
      color: '#' + color.toString(16).padStart(6, '0'),
      stroke: '#0a0a0a',
      strokeThickness: 5,
    });
    t.setOrigin(0.5);
    t.setDepth(965);
    t.setScale(0.2);
    scene.tweens.add({
      targets: t,
      scaleX: 1, scaleY: 1,
      duration: 200,
      ease: 'back.out(3)',
    });
    scene.tweens.add({
      targets: t,
      y: y - 40,
      alpha: { from: 1, to: 0 },
      duration: 900,
      delay: 220,
      onComplete: () => t.destroy(),
    });
    if (n >= 5) screenShake(scene, 2, 140);
    if (n >= 3) sparkle(scene, x, y, 6);
  }

  function critPopup(scene, x, y, text) {
    if (!scene) return;
    const t = scene.add.text(x, y, text, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '40px',
      fontStyle: 'bold',
      color: '#fff7c0',
      stroke: '#ff4d6d',
      strokeThickness: 6,
    });
    t.setOrigin(0.5);
    t.setDepth(970);
    t.setScale(0.2);
    scene.tweens.add({
      targets: t,
      scaleX: 1.1, scaleY: 1.1,
      duration: 180,
      ease: 'back.out(3)',
    });
    scene.tweens.add({
      targets: t,
      scaleX: 1, scaleY: 1,
      duration: 120,
      delay: 180,
    });
    scene.tweens.add({
      targets: t,
      y: y - 100,
      alpha: { from: 1, to: 0 },
      duration: 1000,
      delay: 300,
      onComplete: () => t.destroy(),
    });
    sparkle(scene, x, y, 10);
    ringPop(scene, x, y, 0xfbbf24);
  }

  // ---------------------------------------------------------------------------
  // Camera personality
  // ---------------------------------------------------------------------------
  function followObject(scene, obj, opts) {
    if (!scene || !scene.cameras || !obj) return;
    const o = opts || {};
    scene.cameras.main.startFollow(obj, true, o.lerpX || 0.1, o.lerpY || 0.1);
    if (typeof o.deadzoneW === 'number') {
      scene.cameras.main.setDeadzone(o.deadzoneW, o.deadzoneH || o.deadzoneW);
    }
  }

  function parallaxLayer(scene, opts) {
    if (!scene) return null;
    const o = opts || {};
    const layer = scene.add.container(0, 0);
    layer.setDepth(o.depth || -10);
    const speed = o.speed || 60; // px/sec
    const direction = o.direction || 'down';
    const items = [];
    const factory = o.factory || ((y) => scene.add.rectangle(scene.scale.width / 2, y, scene.scale.width, 8, 0x222222));
    const spacing = o.spacing || 120;
    const count = o.count || Math.ceil(scene.scale.height / spacing) + 2;
    for (let i = 0; i < count; i += 1) {
      const obj = factory(i * spacing);
      items.push(obj);
      layer.add(obj);
    }
    const handle = scene.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => {
        const dt = 16 / 1000;
        const d = speed * dt;
        for (const obj of items) {
          if (direction === 'down') {
            obj.y += d;
            if (obj.y > scene.scale.height + 80) obj.y -= spacing * count;
          } else if (direction === 'up') {
            obj.y -= d;
            if (obj.y < -80) obj.y += spacing * count;
          } else if (direction === 'left') {
            obj.x -= d;
            if (obj.x < -80) obj.x += spacing * count;
          } else if (direction === 'right') {
            obj.x += d;
            if (obj.x > scene.scale.width + 80) obj.x -= spacing * count;
          }
        }
      },
    });
    return {
      layer,
      stop: () => handle.remove(),
      setSpeed(s) { /* mutate captured speed via closure */ opts.speed = s; },
    };
  }

  function cinematicIntro(scene, lines, onComplete) {
    if (!scene) { if (onComplete) onComplete(); return; }
    const w = scene.scale.width, h = scene.scale.height;
    const overlay = scene.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.55).setDepth(980);
    const queue = (lines || ['LEVEL', 'READY?', 'GO!']).slice();
    let i = 0;
    const showNext = () => {
      if (i >= queue.length) {
        scene.tweens.add({ targets: overlay, alpha: 0, duration: 200, onComplete: () => overlay.destroy() });
        if (i === queue.length && onComplete) onComplete();
        return;
      }
      const line = queue[i++];
      const isFinal = i === queue.length;
      const txt = scene.add.text(w / 2, h / 2, line, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: isFinal ? '88px' : '64px',
        fontStyle: 'bold',
        color: isFinal ? '#fbbf24' : '#ffffff',
        stroke: '#0a0a0a',
        strokeThickness: 6,
      }).setOrigin(0.5).setDepth(985).setScale(0.3);
      scene.tweens.add({
        targets: txt,
        scaleX: 1, scaleY: 1,
        duration: 220,
        ease: 'back.out(3)',
      });
      if (isFinal) {
        audio.countdownGo();
        screenFlash(scene, 0xffeebb, 80);
      } else {
        audio.countdownTick();
      }
      scene.time.delayedCall(isFinal ? 500 : 450, () => {
        scene.tweens.add({
          targets: txt,
          alpha: 0,
          scaleX: 1.4, scaleY: 1.4,
          duration: 180,
          onComplete: () => { txt.destroy(); showNext(); },
        });
      });
    };
    showNext();
  }

  // ---------------------------------------------------------------------------
  // Transitions
  // ---------------------------------------------------------------------------
  function wipeIn(scene, direction, durationMs) {
    if (!scene) return;
    const w = scene.scale.width, h = scene.scale.height;
    const r = scene.add.rectangle(w / 2, h / 2, w, h, 0x0b1020).setDepth(995);
    if (direction === 'left') r.x = -w / 2;
    if (direction === 'right') r.x = w * 1.5;
    if (direction === 'up') r.y = -h / 2;
    if (direction === 'down') r.y = h * 1.5;
    scene.tweens.add({
      targets: r,
      x: w / 2, y: h / 2,
      duration: durationMs || 400,
      ease: 'cubic.out',
      onComplete: () => r.destroy(),
    });
  }
  function wipeOut(scene, direction, durationMs) {
    if (!scene) return;
    const w = scene.scale.width, h = scene.scale.height;
    const r = scene.add.rectangle(w / 2, h / 2, w, h, 0x0b1020).setDepth(995);
    const target = { x: w / 2, y: h / 2 };
    if (direction === 'left') target.x = -w / 2;
    if (direction === 'right') target.x = w * 1.5;
    if (direction === 'up') target.y = -h / 2;
    if (direction === 'down') target.y = h * 1.5;
    scene.tweens.add({
      targets: r,
      x: target.x, y: target.y,
      duration: durationMs || 400,
      ease: 'cubic.in',
      onComplete: () => r.destroy(),
    });
  }
  function fadeTransition(fromScene, toScene) {
    if (!fromScene || !fromScene.cameras) return;
    fromScene.cameras.main.fadeOut(280, 11, 16, 32);
    fromScene.cameras.main.once('camerafadeoutcomplete', () => {
      if (toScene && fromScene.scene && fromScene.scene.start) fromScene.scene.start(toScene);
    });
  }
  function irisOpen(scene, x, y, durationMs) {
    if (!scene) return;
    const w = scene.scale.width, h = scene.scale.height;
    const mask = scene.add.circle(x, y, 10, 0x000000, 1).setDepth(996);
    scene.tweens.add({
      targets: mask,
      scaleX: w / 5, scaleY: h / 5,
      alpha: 0,
      duration: durationMs || 500,
      ease: 'cubic.out',
      onComplete: () => mask.destroy(),
    });
  }
  function irisClose(scene, x, y, durationMs) {
    if (!scene) return;
    const w = scene.scale.width;
    const mask = scene.add.circle(x, y, w, 0x000000, 0.0).setDepth(996);
    scene.tweens.add({
      targets: mask,
      scaleX: 0.05, scaleY: 0.05,
      alpha: 1,
      duration: durationMs || 500,
      ease: 'cubic.in',
      onComplete: () => mask.destroy(),
    });
  }

  // ---------------------------------------------------------------------------
  // Composite effects
  // ---------------------------------------------------------------------------
  function celebrate(scene, x, y, intensity) {
    const i = clamp(intensity || 3, 1, 10);
    burst(scene, x, y, { count: 8 + i * 2, speed: 180 + i * 30, colors: [0xfbbf24, 0xff4d6d, 0x5eead4] });
    sparkle(scene, x, y, 4 + i);
    ringPop(scene, x, y, 0xfbbf24);
    audio.correct();
    if (i >= 6) screenShake(scene, i / 2, 140);
  }

  function punish(scene) {
    // Mild — never harsh. No red, no big shake.
    screenShake(scene, 2, 120);
    screenFlash(scene, 0x1a2347, 60);
    audio.wrong();
  }

  function levelStart(scene, levelNum, levelName) {
    return new Promise((resolve) => {
      cinematicIntro(scene, ['LEVEL ' + (levelNum || 1), levelName || 'READY?', 'GO!'], () => resolve());
    });
  }

  function levelEnd(scene, score, accuracy, onDone) {
    if (!scene) { if (onDone) onDone(); return; }
    const w = scene.scale.width, h = scene.scale.height;
    const overlay = scene.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0).setDepth(990);
    scene.tweens.add({ targets: overlay, alpha: 0.6, duration: 240 });
    confetti(scene, w / 2, -40, 22);
    audio.levelUp();

    const banner = scene.add.text(w / 2, h * 0.32, 'LEVEL COMPLETE', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '52px',
      fontStyle: 'bold',
      color: '#fbbf24',
      stroke: '#0a0a0a',
      strokeThickness: 6,
    }).setOrigin(0.5).setDepth(992).setAlpha(0).setX(-w);
    scene.tweens.add({
      targets: banner,
      x: w / 2, alpha: 1,
      duration: 380,
      ease: 'back.out(2.5)',
    });

    const scoreLabel = scene.add.text(w / 2, h * 0.46, 'SCORE', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '24px',
      color: '#ffffff',
    }).setOrigin(0.5).setDepth(992).setAlpha(0);
    const scoreNum = scene.add.text(w / 2, h * 0.52, '0', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '64px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#0a0a0a',
      strokeThickness: 5,
    }).setOrigin(0.5).setDepth(992).setAlpha(0);

    const accBg = scene.add.rectangle(w / 2, h * 0.62, w * 0.6, 16, 0x222831, 1).setDepth(992).setAlpha(0);
    const accFill = scene.add.rectangle(w / 2 - w * 0.3, h * 0.62, 0, 16, 0x5eead4, 1).setOrigin(0, 0.5).setDepth(993).setAlpha(0);
    const accLabel = scene.add.text(w / 2, h * 0.67, 'ACCURACY 0%', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '20px',
      color: '#ffffff',
    }).setOrigin(0.5).setDepth(992).setAlpha(0);

    const continueLabel = scene.add.text(w / 2, h * 0.85, 'TAP TO CONTINUE', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '22px',
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5).setDepth(992).setAlpha(0);

    scene.time.delayedCall(420, () => {
      scene.tweens.add({ targets: [scoreLabel, scoreNum, accBg, accFill, accLabel], alpha: 1, duration: 280 });
      // Animate score count-up
      const finalScore = Math.max(0, Math.round(score || 0));
      const obj = { v: 0 };
      scene.tweens.add({
        targets: obj,
        v: finalScore,
        duration: 800,
        onUpdate: () => scoreNum.setText(String(Math.round(obj.v))),
      });
      // Animate accuracy bar
      const acc = clamp(accuracy || 0, 0, 1);
      scene.tweens.add({
        targets: accFill,
        width: w * 0.6 * acc,
        duration: 800,
        ease: 'cubic.out',
        onUpdate: () => accLabel.setText('ACCURACY ' + Math.round((accFill.width / (w * 0.6)) * 100) + '%'),
      });
    });

    scene.time.delayedCall(1500, () => {
      scene.tweens.add({
        targets: continueLabel,
        alpha: { from: 0.3, to: 1 },
        duration: 700,
        yoyo: true,
        repeat: -1,
      });
      // Wait for a tap to clear and call onDone
      const dismiss = () => {
        scene.input.off('pointerdown', dismiss);
        scene.tweens.add({
          targets: [overlay, banner, scoreLabel, scoreNum, accBg, accFill, accLabel, continueLabel],
          alpha: 0,
          duration: 220,
          onComplete: () => {
            [overlay, banner, scoreLabel, scoreNum, accBg, accFill, accLabel, continueLabel].forEach((o) => o && o.destroy());
            if (onDone) onDone();
          },
        });
      };
      scene.input.on('pointerdown', dismiss);
    });
  }

  // ---------------------------------------------------------------------------
  // Candy button — signature Duolingo-style button for in-game UI.
  // Solid top + 5px darker shadow band underneath, presses down on tap.
  // Returns { container, setLabel, setEnabled, destroy }.
  // Variants: 'green'|'blue'|'yellow'|'red'|'purple'|'outline'
  // ---------------------------------------------------------------------------
  const CANDY_TOP = {
    green: 0x58CC02, blue: 0x1CB0F6, yellow: 0xFFC800,
    red: 0xFF4B4B, purple: 0xCE82FF, outline: 0xFFFFFF,
  };
  const CANDY_SHADOW = {
    green: 0x46A302, blue: 0x188FCB, yellow: 0xD1A500,
    red: 0xD13C3C, purple: 0xA968D9, outline: 0xE5E5E5,
  };
  const CANDY_LABEL = {
    green: '#FFFFFF', blue: '#FFFFFF', yellow: '#131F24',
    red: '#FFFFFF', purple: '#FFFFFF', outline: '#131F24',
  };

  function candyButton(scene, x, y, w, h, label, opts) {
    if (!scene) return null;
    const variant = (opts && opts.variant) || 'green';
    const onTap = opts && opts.onTap;
    const SHADOW_BAND = (opts && opts.shadowBand) || 5;
    const radius = (opts && opts.radius) || 16;

    const top = CANDY_TOP[variant] || CANDY_TOP.green;
    const shadow = CANDY_SHADOW[variant] || CANDY_SHADOW.green;
    const labelColor = CANDY_LABEL[variant] || '#FFFFFF';

    const container = scene.add.container(x, y);
    container.setDepth(85);
    container.setSize(w, h + SHADOW_BAND);

    // Shadow band (drawn first so it sits below the top surface)
    const shadowRect = scene.add.graphics();
    shadowRect.fillStyle(shadow, 1);
    shadowRect.fillRoundedRect(-w / 2, -h / 2 + SHADOW_BAND, w, h, radius);
    container.add(shadowRect);

    // Top surface
    const topRect = scene.add.graphics();
    function drawTop(offsetY) {
      topRect.clear();
      if (variant === 'outline') {
        topRect.lineStyle(2, shadow, 1);
      }
      topRect.fillStyle(top, 1);
      topRect.fillRoundedRect(-w / 2, -h / 2 + offsetY, w, h, radius);
      if (variant === 'outline') {
        topRect.strokeRoundedRect(-w / 2, -h / 2 + offsetY, w, h, radius);
      }
    }
    drawTop(0);
    container.add(topRect);

    // Label
    const txt = scene.add.text(0, 0, label, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: Math.min(h * 0.34, 22) + 'px',
      fontStyle: 'bold',
      color: labelColor,
    });
    txt.setOrigin(0.5);
    container.add(txt);

    // Hit area
    const hit = scene.add.rectangle(0, 0, w, h + SHADOW_BAND, 0x000000, 0).setInteractive({ useHandCursor: true });
    container.add(hit);

    let enabled = true;
    let pressed = false;

    const press = () => {
      if (!enabled || pressed) return;
      pressed = true;
      drawTop(SHADOW_BAND);
      txt.y = SHADOW_BAND / 2;
    };
    const release = (fire) => {
      if (!pressed) return;
      pressed = false;
      drawTop(0);
      txt.y = 0;
      if (fire && enabled && onTap) onTap();
    };

    hit.on('pointerdown', press);
    hit.on('pointerup', () => release(true));
    hit.on('pointerupoutside', () => release(false));
    hit.on('pointerout', () => release(false));

    function setLabel(s) { txt.setText(s); }
    function setEnabled(v) {
      enabled = !!v;
      container.setAlpha(enabled ? 1 : 0.6);
    }
    function destroy() { container.destroy(); }

    return { container, setLabel, setEnabled, destroy };
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------
  function combinedShake(targetOrScene, intensity, durationMs) {
    // Overloaded — works on both scenes (camera shake) and game objects (per-object shake).
    if (targetOrScene && targetOrScene.cameras) {
      screenShake(targetOrScene, intensity, durationMs);
    } else if (targetOrScene && targetOrScene.scene) {
      objShake(targetOrScene, intensity, durationMs);
    }
  }

  global.GameFeel = {
    // Screen-level
    shake: combinedShake,
    flash: screenFlash,
    hitstop,
    slowmo,
    zoomPunch,
    // Object-level
    squashStretch,
    bounceIn,
    pulse,
    wobble,
    // Particles
    burst,
    confetti,
    sparkle,
    trail,
    ringPop,
    // Score popups
    scorePopup,
    comboPopup,
    critPopup,
    // Audio
    audio,
    // Camera
    followObject,
    parallaxLayer,
    cinematicIntro,
    // Transitions
    wipeIn,
    wipeOut,
    fadeTransition,
    irisOpen,
    irisClose,
    // Composite
    celebrate,
    punish,
    levelStart,
    levelEnd,
    // Candy button (UI primitive used by archetypes and EduCore HUD)
    candyButton,
    // Debug
    version: '1.1.0',
    _pools: pools,
  };
})(typeof window !== 'undefined' ? window : globalThis);
