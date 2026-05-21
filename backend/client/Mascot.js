// Mascot.js — Pip the fox.
// Drawn entirely from Phaser shape primitives. No sprite sheet, no external image. The
// same character is mirrored in Flutter at flutter_module/.../widgets/mascot_widget.dart
// using CustomPainter — both must look the same.
//
// Expressions: idle | happy | cheering | thinking | sad | celebrating | sleeping | surprised
// Events: 'correct' | 'wrong' | 'combo3' | 'levelComplete' | 'streak' | 'idle'
//
// Usage:
//   const pip = window.Mascot.create(scene, 100, 100, 1.2);
//   pip.setExpression('cheering');
//   pip.react('correct');
//   pip.destroy();
(function (global) {
  'use strict';

  // Pip's body palette (warm orange fox).
  const COLORS = {
    body: 0xE85D1E,        // primary orange
    bodyDark: 0xB44415,    // shadow
    belly: 0xFFE7CE,       // cream
    tailTip: 0xFFFFFF,     // white
    ear: 0xB44415,         // dark inner ear
    eye: 0x131F24,         // black-base-dark
    eyeWhite: 0xFFFFFF,
    mouth: 0x131F24,
    cheek: 0xFFB28A,       // soft cheek blush
    accent: 0xFFC800,      // streak yellow used for celebration flames
  };

  // ------------------------------------------------------------
  // Expression presets: each is a small render delta from "idle"
  // ------------------------------------------------------------
  const EXPRESSIONS = {
    idle:        { eyes: 'open',     mouth: 'softSmile', earTilt: 0,        bodyScale: 1.00, headTilt: 0 },
    happy:       { eyes: 'open',     mouth: 'smile',     earTilt: 4,        bodyScale: 1.02, headTilt: 0 },
    cheering:    { eyes: 'crescent', mouth: 'openGrin',  earTilt: 8,        bodyScale: 1.05, headTilt: 0, arms: 'up' },
    thinking:    { eyes: 'sideways', mouth: 'pursed',    earTilt: -2,       bodyScale: 1.00, headTilt: 8 },
    sad:         { eyes: 'droop',    mouth: 'frown',     earTilt: -10,      bodyScale: 0.97, headTilt: -4 },
    celebrating: { eyes: 'crescent', mouth: 'openGrin',  earTilt: 10,       bodyScale: 1.08, headTilt: 0, arms: 'up', sparkle: true },
    sleeping:    { eyes: 'closed',   mouth: 'softSmile', earTilt: -4,       bodyScale: 1.00, headTilt: -6, zzz: true },
    surprised:   { eyes: 'wide',     mouth: 'oh',        earTilt: 12,       bodyScale: 1.04, headTilt: 0 },
  };

  function create(scene, x, y, scale) {
    if (!scene) return null;
    const s = scale || 1;
    const container = scene.add.container(x, y);
    container.setDepth(80);

    // Layout (all in container-local coordinates, before scale)
    //   body ellipse 90×100, head circle 60r above belly
    //   ear triangles on top of head, eye dots in head, mouth arc, optional arms

    // ===== Tail (drawn first so it sits behind body) =====
    const tail = scene.add.graphics();
    drawTail(tail);
    container.add(tail);

    // ===== Body =====
    const body = scene.add.ellipse(0, 30 * s, 90 * s, 100 * s, COLORS.body);
    body.setStrokeStyle(3, COLORS.bodyDark);
    container.add(body);
    const belly = scene.add.ellipse(0, 45 * s, 56 * s, 70 * s, COLORS.belly);
    container.add(belly);

    // ===== Optional arms (used in cheering / celebrating) =====
    const armLeft = scene.add.ellipse(-42 * s, 32 * s, 22 * s, 36 * s, COLORS.body);
    armLeft.setStrokeStyle(2, COLORS.bodyDark);
    armLeft.setVisible(false);
    container.add(armLeft);
    const armRight = scene.add.ellipse(42 * s, 32 * s, 22 * s, 36 * s, COLORS.body);
    armRight.setStrokeStyle(2, COLORS.bodyDark);
    armRight.setVisible(false);
    container.add(armRight);

    // ===== Head =====
    const headGroup = scene.add.container(0, -36 * s);
    container.add(headGroup);
    // Ear roots
    const earL = scene.add.triangle(-30 * s, -28 * s, -8 * s, 0, 8 * s, 0, 0, -28 * s, COLORS.body);
    const earR = scene.add.triangle(30 * s, -28 * s, -8 * s, 0, 8 * s, 0, 0, -28 * s, COLORS.body);
    earL.setStrokeStyle(2, COLORS.bodyDark);
    earR.setStrokeStyle(2, COLORS.bodyDark);
    const earInnerL = scene.add.triangle(-30 * s, -24 * s, -4 * s, 0, 4 * s, 0, 0, -16 * s, COLORS.ear);
    const earInnerR = scene.add.triangle(30 * s, -24 * s, -4 * s, 0, 4 * s, 0, 0, -16 * s, COLORS.ear);
    headGroup.add([earL, earR, earInnerL, earInnerR]);

    // Head circle (after ears so ears poke out behind)
    const head = scene.add.circle(0, 0, 38 * s, COLORS.body);
    head.setStrokeStyle(3, COLORS.bodyDark);
    headGroup.add(head);

    // Snout / muzzle (small light patch)
    const snout = scene.add.ellipse(0, 14 * s, 30 * s, 22 * s, COLORS.belly);
    headGroup.add(snout);

    // Nose
    const nose = scene.add.ellipse(0, 8 * s, 8 * s, 6 * s, COLORS.eye);
    headGroup.add(nose);

    // Eyes — two states are tracked: position + drawing primitive (circle or arc)
    const eyeL = scene.add.graphics();
    const eyeR = scene.add.graphics();
    headGroup.add([eyeL, eyeR]);

    // Mouth (graphics — arc/path)
    const mouth = scene.add.graphics();
    headGroup.add(mouth);

    // Cheeks (subtle blush, visible only on happy/celebrating)
    const cheekL = scene.add.ellipse(-22 * s, 10 * s, 12 * s, 6 * s, COLORS.cheek, 0.6);
    const cheekR = scene.add.ellipse(22 * s, 10 * s, 12 * s, 6 * s, COLORS.cheek, 0.6);
    cheekL.setVisible(false);
    cheekR.setVisible(false);
    headGroup.add([cheekL, cheekR]);

    // White tail tip (drawn on top of tail body — separate so we can layer it)
    function drawTail(g) {
      g.clear();
      g.fillStyle(COLORS.body, 1);
      g.lineStyle(2, COLORS.bodyDark, 1);
      g.beginPath();
      g.moveTo(36 * s, 40 * s);
      g.lineTo(58 * s, 18 * s);
      g.lineTo(68 * s, 30 * s);
      g.lineTo(72 * s, 48 * s);
      g.lineTo(62 * s, 60 * s);
      g.lineTo(50 * s, 56 * s);
      g.lineTo(40 * s, 56 * s);
      g.closePath();
      g.fillPath();
      g.strokePath();
      // White tip
      g.fillStyle(COLORS.tailTip, 1);
      g.beginPath();
      g.arc(64 * s, 30 * s, 10 * s, 0, Math.PI * 2);
      g.fillPath();
    }

    // ===== Expression drawing helpers =====
    function drawEyes(state) {
      eyeL.clear();
      eyeR.clear();
      const ex = 14 * s, ey = -4 * s;
      const drawSingle = (g, side) => {
        const sx = side * ex;
        switch (state) {
          case 'open':
            g.fillStyle(COLORS.eyeWhite, 1);
            g.fillCircle(sx, ey, 8 * s);
            g.fillStyle(COLORS.eye, 1);
            g.fillCircle(sx, ey, 5 * s);
            break;
          case 'wide':
            g.fillStyle(COLORS.eyeWhite, 1);
            g.fillCircle(sx, ey, 10 * s);
            g.fillStyle(COLORS.eye, 1);
            g.fillCircle(sx, ey, 4 * s);
            break;
          case 'crescent':
            // upturned smile-eye arc
            g.lineStyle(3 * s, COLORS.eye, 1);
            g.beginPath();
            g.arc(sx, ey + 1 * s, 8 * s, Math.PI * 0.05, Math.PI * 0.95);
            g.strokePath();
            break;
          case 'closed':
            g.lineStyle(3 * s, COLORS.eye, 1);
            g.beginPath();
            g.moveTo(sx - 7 * s, ey);
            g.lineTo(sx + 7 * s, ey);
            g.strokePath();
            break;
          case 'sideways':
            g.fillStyle(COLORS.eyeWhite, 1);
            g.fillCircle(sx, ey, 8 * s);
            g.fillStyle(COLORS.eye, 1);
            g.fillCircle(sx + (side > 0 ? 3 : -3) * s, ey, 5 * s);
            break;
          case 'droop':
            g.fillStyle(COLORS.eyeWhite, 1);
            g.fillCircle(sx, ey + 2 * s, 7 * s);
            g.fillStyle(COLORS.eye, 1);
            g.fillCircle(sx, ey + 4 * s, 4 * s);
            // droopy lid line
            g.lineStyle(2 * s, COLORS.bodyDark, 1);
            g.beginPath();
            g.moveTo(sx - 8 * s, ey - 2 * s);
            g.lineTo(sx + 6 * s, ey + 1 * s);
            g.strokePath();
            break;
          default:
            g.fillStyle(COLORS.eye, 1);
            g.fillCircle(sx, ey, 5 * s);
        }
      };
      drawSingle(eyeL, -1);
      drawSingle(eyeR, 1);
    }

    function drawMouth(state) {
      mouth.clear();
      mouth.lineStyle(3 * s, COLORS.mouth, 1);
      switch (state) {
        case 'softSmile':
          mouth.beginPath();
          mouth.arc(0, 16 * s, 8 * s, Math.PI * 0.1, Math.PI * 0.9);
          mouth.strokePath();
          break;
        case 'smile':
          mouth.beginPath();
          mouth.arc(0, 16 * s, 10 * s, Math.PI * 0.05, Math.PI * 0.95);
          mouth.strokePath();
          break;
        case 'openGrin':
          mouth.fillStyle(0x4A1C0F, 1);
          mouth.beginPath();
          mouth.arc(0, 16 * s, 11 * s, Math.PI * 0.05, Math.PI * 0.95);
          mouth.closePath();
          mouth.fillPath();
          mouth.strokePath();
          // tongue
          mouth.fillStyle(0xff8aa8, 1);
          mouth.beginPath();
          mouth.arc(0, 22 * s, 6 * s, 0, Math.PI);
          mouth.fillPath();
          break;
        case 'frown':
          mouth.beginPath();
          mouth.arc(0, 22 * s, 8 * s, Math.PI * 1.1, Math.PI * 1.9);
          mouth.strokePath();
          break;
        case 'pursed':
          mouth.fillStyle(COLORS.mouth, 1);
          mouth.fillCircle(0, 16 * s, 3 * s);
          break;
        case 'oh':
          mouth.fillStyle(0x4A1C0F, 1);
          mouth.fillCircle(0, 16 * s, 6 * s);
          break;
      }
    }

    function showCheeks(visible) {
      cheekL.setVisible(visible);
      cheekR.setVisible(visible);
    }

    let zzzSprite = null;
    function showZzz(visible) {
      if (visible) {
        if (zzzSprite) return;
        zzzSprite = scene.add.text(40 * s, -60 * s, 'Z', {
          fontFamily: 'system-ui, sans-serif',
          fontSize: (20 * s) + 'px',
          fontStyle: 'bold',
          color: '#AFAFAF',
        });
        zzzSprite.setOrigin(0.5);
        headGroup.add(zzzSprite);
        scene.tweens.add({
          targets: zzzSprite,
          y: zzzSprite.y - 30 * s,
          alpha: { from: 1, to: 0 },
          duration: 1400,
          repeat: -1,
        });
      } else if (zzzSprite) {
        zzzSprite.destroy();
        zzzSprite = null;
      }
    }

    let sparkleEvent = null;
    function showSparkle(active) {
      if (active && !sparkleEvent) {
        sparkleEvent = scene.time.addEvent({
          delay: 220, loop: true,
          callback: () => {
            if (global.GameFeel && global.GameFeel.sparkle) {
              global.GameFeel.sparkle(scene, container.x + (Math.random() - 0.5) * 80 * s, container.y - 20 * s, 2);
            }
          },
        });
      } else if (!active && sparkleEvent) {
        sparkleEvent.remove();
        sparkleEvent = null;
      }
    }

    // ===== Idle animation: gentle vertical bob + ear flick + blink =====
    const bobTween = scene.tweens.add({
      targets: container,
      y: y - 4 * s,
      duration: 1100,
      yoyo: true,
      repeat: -1,
      ease: 'sine.inOut',
    });

    let currentExpression = 'idle';
    let blinkEvent = null;
    function startBlinkLoop() {
      stopBlinkLoop();
      const schedule = () => {
        const delay = 4000 + Math.random() * 2500;
        blinkEvent = scene.time.delayedCall(delay, () => {
          if (currentExpression === 'sleeping' || currentExpression === 'closed') {
            schedule();
            return;
          }
          // brief blink — close → open
          const wasEyes = EXPRESSIONS[currentExpression]?.eyes || 'open';
          drawEyes('closed');
          scene.time.delayedCall(120, () => {
            drawEyes(wasEyes);
            schedule();
          });
        });
      };
      schedule();
    }
    function stopBlinkLoop() {
      if (blinkEvent) blinkEvent.remove();
      blinkEvent = null;
    }

    function setExpression(name) {
      const preset = EXPRESSIONS[name] || EXPRESSIONS.idle;
      currentExpression = name;
      drawEyes(preset.eyes);
      drawMouth(preset.mouth);
      // Ear tilt
      const t = (preset.earTilt || 0) * Math.PI / 180;
      earL.setRotation(-t);
      earR.setRotation(t);
      earInnerL.setRotation(-t);
      earInnerR.setRotation(t);
      // Head tilt
      headGroup.setRotation((preset.headTilt || 0) * Math.PI / 180);
      // Body scale (subtle)
      const bs = preset.bodyScale || 1;
      body.setScale(bs);
      belly.setScale(bs);
      // Arms
      const armsUp = preset.arms === 'up';
      armLeft.setVisible(armsUp);
      armRight.setVisible(armsUp);
      if (armsUp) {
        armLeft.setRotation(-0.6);
        armRight.setRotation(0.6);
      }
      // Cheeks
      showCheeks(name === 'happy' || name === 'cheering' || name === 'celebrating');
      // Z's
      showZzz(name === 'sleeping');
      // Sparkles
      showSparkle(name === 'celebrating');
    }

    setExpression('idle');
    startBlinkLoop();

    // ===== Event reactions: temporarily switch expression, then return to idle =====
    function react(event) {
      switch (event) {
        case 'correct':
          setExpression('happy');
          // Bounce up briefly
          scene.tweens.add({
            targets: container, y: y - 12 * s, duration: 160, yoyo: true, ease: 'back.out(2)',
          });
          scene.time.delayedCall(700, () => setExpression('idle'));
          break;
        case 'wrong':
          setExpression('sad');
          // Slight slump
          scene.tweens.add({
            targets: container, y: y + 4 * s, duration: 200, yoyo: true, ease: 'sine.out',
          });
          scene.time.delayedCall(1100, () => setExpression('idle'));
          break;
        case 'combo3':
          setExpression('cheering');
          scene.tweens.add({
            targets: container, y: y - 18 * s, duration: 220, yoyo: true, repeat: 1, ease: 'sine.out',
          });
          scene.time.delayedCall(1400, () => setExpression('idle'));
          break;
        case 'levelComplete':
        case 'streak':
          setExpression('celebrating');
          scene.tweens.add({
            targets: container, y: y - 16 * s, duration: 240, yoyo: true, repeat: 2, ease: 'sine.out',
          });
          scene.time.delayedCall(2200, () => setExpression('idle'));
          break;
        case 'idle':
        default:
          setExpression('idle');
          break;
      }
    }

    function destroy() {
      stopBlinkLoop();
      if (sparkleEvent) sparkleEvent.remove();
      if (bobTween) bobTween.remove();
      container.destroy();
    }

    return { container, setExpression, react, destroy };
  }

  global.Mascot = {
    create,
    EXPRESSIONS: Object.keys(EXPRESSIONS),
    EVENTS: ['correct', 'wrong', 'combo3', 'levelComplete', 'streak', 'idle'],
    version: '1.0.0',
  };
})(typeof window !== 'undefined' ? window : globalThis);
