// Pip the fox — Flutter mirror of backend/client/Mascot.js.
// Same character, same expressions. Draws via CustomPainter; no asset file.
import 'dart:math' as math;
import 'package:flutter/material.dart';

enum MascotExpression {
  idle, happy, cheering, thinking, sad, celebrating, sleeping, surprised,
}

class MascotController extends ChangeNotifier {
  MascotExpression _expression = MascotExpression.idle;
  MascotExpression get expression => _expression;
  void setExpression(MascotExpression e) {
    if (_expression == e) return;
    _expression = e;
    notifyListeners();
  }

  Future<void> react(String event) async {
    switch (event) {
      case 'correct':
        setExpression(MascotExpression.happy);
        await Future.delayed(const Duration(milliseconds: 700));
        setExpression(MascotExpression.idle);
        break;
      case 'wrong':
        setExpression(MascotExpression.sad);
        await Future.delayed(const Duration(milliseconds: 1100));
        setExpression(MascotExpression.idle);
        break;
      case 'combo3':
        setExpression(MascotExpression.cheering);
        await Future.delayed(const Duration(milliseconds: 1400));
        setExpression(MascotExpression.idle);
        break;
      case 'levelComplete':
      case 'streak':
        setExpression(MascotExpression.celebrating);
        await Future.delayed(const Duration(milliseconds: 2200));
        setExpression(MascotExpression.idle);
        break;
      case 'idle':
      default:
        setExpression(MascotExpression.idle);
    }
  }
}

class MascotWidget extends StatefulWidget {
  final MascotExpression expression;
  final MascotController? controller;
  final double size;
  const MascotWidget({
    super.key,
    this.expression = MascotExpression.idle,
    this.controller,
    this.size = 96,
  });

  @override
  State<MascotWidget> createState() => _MascotWidgetState();
}

class _MascotWidgetState extends State<MascotWidget> with TickerProviderStateMixin {
  late final AnimationController _bobCtrl;
  late final AnimationController _blinkCtrl;
  late MascotExpression _expression;
  bool _blinking = false;

  @override
  void initState() {
    super.initState();
    _expression = widget.controller?.expression ?? widget.expression;
    _bobCtrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 1100))
      ..repeat(reverse: true);
    _blinkCtrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 120));
    widget.controller?.addListener(_onCtrlChanged);
    _scheduleBlink();
  }

  void _scheduleBlink() {
    final delay = Duration(milliseconds: 4000 + math.Random().nextInt(2500));
    Future.delayed(delay, () async {
      if (!mounted) return;
      if (_expression == MascotExpression.sleeping) {
        _scheduleBlink();
        return;
      }
      setState(() => _blinking = true);
      await Future.delayed(const Duration(milliseconds: 120));
      if (!mounted) return;
      setState(() => _blinking = false);
      _scheduleBlink();
    });
  }

  void _onCtrlChanged() {
    if (!mounted) return;
    setState(() => _expression = widget.controller!.expression);
  }

  @override
  void didUpdateWidget(MascotWidget oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.controller == null && oldWidget.expression != widget.expression) {
      setState(() => _expression = widget.expression);
    }
  }

  @override
  void dispose() {
    widget.controller?.removeListener(_onCtrlChanged);
    _bobCtrl.dispose();
    _blinkCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _bobCtrl,
      builder: (_, __) {
        final bob = math.sin(_bobCtrl.value * math.pi) * 4 * (widget.size / 96);
        return SizedBox(
          width: widget.size,
          height: widget.size * 1.2,
          child: CustomPaint(
            painter: _PipPainter(
              expression: _expression,
              blinking: _blinking,
              bobOffset: bob,
              size: widget.size,
            ),
          ),
        );
      },
    );
  }
}

class _PipPainter extends CustomPainter {
  final MascotExpression expression;
  final bool blinking;
  final double bobOffset;
  final double size;

  static const _body = Color(0xFFE85D1E);
  static const _bodyDark = Color(0xFFB44415);
  static const _belly = Color(0xFFFFE7CE);
  static const _tailTip = Colors.white;
  static const _ear = Color(0xFFB44415);
  static const _eye = Color(0xFF131F24);
  static const _eyeWhite = Colors.white;
  static const _cheek = Color(0x99FFB28A);
  static const _mouth = Color(0xFF131F24);
  static const _muted = Color(0xFFAFAFAF);

  _PipPainter({
    required this.expression,
    required this.blinking,
    required this.bobOffset,
    required this.size,
  });

  @override
  void paint(Canvas canvas, Size cSize) {
    final scale = size / 96;
    canvas.save();
    canvas.translate(cSize.width / 2, cSize.height / 2 + bobOffset);

    final preset = _expressionPreset(expression);
    final fill = Paint()..style = PaintingStyle.fill;
    final stroke = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3 * scale;

    // ===== Tail (behind body) =====
    final tailPath = Path()
      ..moveTo(36 * scale, 40 * scale)
      ..lineTo(58 * scale, 18 * scale)
      ..lineTo(68 * scale, 30 * scale)
      ..lineTo(72 * scale, 48 * scale)
      ..lineTo(62 * scale, 60 * scale)
      ..lineTo(50 * scale, 56 * scale)
      ..lineTo(40 * scale, 56 * scale)
      ..close();
    fill.color = _body;
    canvas.drawPath(tailPath, fill);
    stroke.color = _bodyDark;
    canvas.drawPath(tailPath, stroke);
    fill.color = _tailTip;
    canvas.drawCircle(Offset(64 * scale, 30 * scale), 10 * scale, fill);

    // ===== Body =====
    final bodyScale = preset.bodyScale;
    final bodyRect = Rect.fromCenter(
      center: Offset(0, 30 * scale),
      width: 90 * scale * bodyScale,
      height: 100 * scale * bodyScale,
    );
    fill.color = _body;
    canvas.drawOval(bodyRect, fill);
    stroke.color = _bodyDark;
    canvas.drawOval(bodyRect, stroke);

    // Belly
    final bellyRect = Rect.fromCenter(
      center: Offset(0, 45 * scale),
      width: 56 * scale * bodyScale,
      height: 70 * scale * bodyScale,
    );
    fill.color = _belly;
    canvas.drawOval(bellyRect, fill);

    // ===== Arms (cheering / celebrating) =====
    if (preset.armsUp) {
      _drawArm(canvas, scale, fill, stroke, -42, 32, -0.6);
      _drawArm(canvas, scale, fill, stroke, 42, 32, 0.6);
    }

    // ===== Head (tilted, ears + face) =====
    canvas.save();
    canvas.translate(0, -36 * scale);
    canvas.rotate(preset.headTilt);

    _drawEar(canvas, scale, fill, stroke, -30, -28, -preset.earTilt);
    _drawEar(canvas, scale, fill, stroke, 30, -28, preset.earTilt);

    fill.color = _body;
    canvas.drawCircle(Offset.zero, 38 * scale, fill);
    stroke.color = _bodyDark;
    canvas.drawCircle(Offset.zero, 38 * scale, stroke);

    // Snout
    fill.color = _belly;
    canvas.drawOval(
      Rect.fromCenter(center: Offset(0, 14 * scale), width: 30 * scale, height: 22 * scale),
      fill,
    );

    // Nose
    fill.color = _eye;
    canvas.drawOval(
      Rect.fromCenter(center: Offset(0, 8 * scale), width: 8 * scale, height: 6 * scale),
      fill,
    );

    // Eyes — blink overrides expression eyes
    final eyeState = blinking ? _EyeState.closed : preset.eyes;
    _drawEye(canvas, scale, eyeState, -14, -4);
    _drawEye(canvas, scale, eyeState, 14, -4);

    // Mouth
    _drawMouth(canvas, scale, preset.mouth);

    // Cheeks
    if (preset.cheeks) {
      fill.color = _cheek;
      canvas.drawOval(
        Rect.fromCenter(center: Offset(-22 * scale, 10 * scale), width: 12 * scale, height: 6 * scale),
        fill,
      );
      canvas.drawOval(
        Rect.fromCenter(center: Offset(22 * scale, 10 * scale), width: 12 * scale, height: 6 * scale),
        fill,
      );
    }

    // Z's for sleeping
    if (preset.zzz) {
      final textPainter = TextPainter(
        text: TextSpan(
          text: 'Z',
          style: TextStyle(
            color: _muted,
            fontSize: 20 * scale,
            fontWeight: FontWeight.w800,
          ),
        ),
        textDirection: TextDirection.ltr,
      )..layout();
      textPainter.paint(canvas, Offset(40 * scale - textPainter.width / 2, -60 * scale));
    }

    canvas.restore(); // head
    canvas.restore(); // mascot
  }

  void _drawArm(Canvas canvas, double scale, Paint fill, Paint stroke, double x, double y, double rotation) {
    canvas.save();
    canvas.translate(x * scale, y * scale);
    canvas.rotate(rotation);
    fill.color = _body;
    final rect = Rect.fromCenter(center: Offset.zero, width: 22 * scale, height: 36 * scale);
    canvas.drawOval(rect, fill);
    stroke.color = _bodyDark;
    stroke.strokeWidth = 2 * scale;
    canvas.drawOval(rect, stroke);
    stroke.strokeWidth = 3 * scale;
    canvas.restore();
  }

  void _drawEar(Canvas canvas, double scale, Paint fill, Paint stroke, double cx, double cy, double rotation) {
    canvas.save();
    canvas.translate(cx * scale, cy * scale);
    canvas.rotate(rotation);
    fill.color = _body;
    final outer = Path()
      ..moveTo(-8 * scale, 0)
      ..lineTo(8 * scale, 0)
      ..lineTo(0, -28 * scale)
      ..close();
    canvas.drawPath(outer, fill);
    stroke.color = _bodyDark;
    stroke.strokeWidth = 2 * scale;
    canvas.drawPath(outer, stroke);
    fill.color = _ear;
    final inner = Path()
      ..moveTo(-4 * scale, 4 * scale)
      ..lineTo(4 * scale, 4 * scale)
      ..lineTo(0, -16 * scale)
      ..close();
    canvas.drawPath(inner, fill);
    canvas.restore();
  }

  void _drawEye(Canvas canvas, double scale, _EyeState state, double cx, double cy) {
    final fill = Paint()..style = PaintingStyle.fill;
    final stroke = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3 * scale
      ..strokeCap = StrokeCap.round;
    final c = Offset(cx * scale, cy * scale);

    switch (state) {
      case _EyeState.open:
        fill.color = _eyeWhite;
        canvas.drawCircle(c, 8 * scale, fill);
        fill.color = _eye;
        canvas.drawCircle(c, 5 * scale, fill);
        break;
      case _EyeState.wide:
        fill.color = _eyeWhite;
        canvas.drawCircle(c, 10 * scale, fill);
        fill.color = _eye;
        canvas.drawCircle(c, 4 * scale, fill);
        break;
      case _EyeState.crescent:
        stroke.color = _eye;
        final rect = Rect.fromCircle(center: c.translate(0, scale), radius: 8 * scale);
        canvas.drawArc(rect, math.pi * 0.05, math.pi * 0.9, false, stroke);
        break;
      case _EyeState.closed:
        stroke.color = _eye;
        canvas.drawLine(
          Offset(c.dx - 7 * scale, c.dy),
          Offset(c.dx + 7 * scale, c.dy),
          stroke,
        );
        break;
      case _EyeState.sideways:
        fill.color = _eyeWhite;
        canvas.drawCircle(c, 8 * scale, fill);
        fill.color = _eye;
        canvas.drawCircle(c.translate(cx > 0 ? 3 * scale : -3 * scale, 0), 5 * scale, fill);
        break;
      case _EyeState.droop:
        fill.color = _eyeWhite;
        canvas.drawCircle(c.translate(0, 2 * scale), 7 * scale, fill);
        fill.color = _eye;
        canvas.drawCircle(c.translate(0, 4 * scale), 4 * scale, fill);
        stroke.color = _bodyDark;
        stroke.strokeWidth = 2 * scale;
        canvas.drawLine(
          Offset(c.dx - 8 * scale, c.dy - 2 * scale),
          Offset(c.dx + 6 * scale, c.dy + 1 * scale),
          stroke,
        );
        break;
    }
  }

  void _drawMouth(Canvas canvas, double scale, _MouthState state) {
    final stroke = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3 * scale
      ..strokeCap = StrokeCap.round
      ..color = _mouth;
    final fill = Paint()..style = PaintingStyle.fill;

    switch (state) {
      case _MouthState.softSmile:
        canvas.drawArc(
          Rect.fromCircle(center: Offset(0, 16 * scale), radius: 8 * scale),
          math.pi * 0.1, math.pi * 0.8, false, stroke,
        );
        break;
      case _MouthState.smile:
        canvas.drawArc(
          Rect.fromCircle(center: Offset(0, 16 * scale), radius: 10 * scale),
          math.pi * 0.05, math.pi * 0.9, false, stroke,
        );
        break;
      case _MouthState.openGrin:
        fill.color = const Color(0xFF4A1C0F);
        final path = Path()
          ..addArc(
            Rect.fromCircle(center: Offset(0, 16 * scale), radius: 11 * scale),
            math.pi * 0.05, math.pi * 0.9,
          )
          ..close();
        canvas.drawPath(path, fill);
        canvas.drawPath(path, stroke);
        fill.color = const Color(0xFFFF8AA8);
        canvas.drawArc(
          Rect.fromCircle(center: Offset(0, 22 * scale), radius: 6 * scale),
          0, math.pi, false, fill,
        );
        break;
      case _MouthState.frown:
        canvas.drawArc(
          Rect.fromCircle(center: Offset(0, 22 * scale), radius: 8 * scale),
          math.pi * 1.1, math.pi * 0.8, false, stroke,
        );
        break;
      case _MouthState.pursed:
        fill.color = _mouth;
        canvas.drawCircle(Offset(0, 16 * scale), 3 * scale, fill);
        break;
      case _MouthState.oh:
        fill.color = const Color(0xFF4A1C0F);
        canvas.drawCircle(Offset(0, 16 * scale), 6 * scale, fill);
        break;
    }
  }

  _Preset _expressionPreset(MascotExpression e) {
    switch (e) {
      case MascotExpression.idle:
        return _Preset(eyes: _EyeState.open, mouth: _MouthState.softSmile, earTilt: 0, bodyScale: 1.00, headTilt: 0);
      case MascotExpression.happy:
        return _Preset(eyes: _EyeState.open, mouth: _MouthState.smile, earTilt: 0.07, bodyScale: 1.02, headTilt: 0, cheeks: true);
      case MascotExpression.cheering:
        return _Preset(eyes: _EyeState.crescent, mouth: _MouthState.openGrin, earTilt: 0.14, bodyScale: 1.05, headTilt: 0, armsUp: true, cheeks: true);
      case MascotExpression.thinking:
        return _Preset(eyes: _EyeState.sideways, mouth: _MouthState.pursed, earTilt: -0.04, bodyScale: 1.00, headTilt: 0.14);
      case MascotExpression.sad:
        return _Preset(eyes: _EyeState.droop, mouth: _MouthState.frown, earTilt: -0.17, bodyScale: 0.97, headTilt: -0.07);
      case MascotExpression.celebrating:
        return _Preset(eyes: _EyeState.crescent, mouth: _MouthState.openGrin, earTilt: 0.17, bodyScale: 1.08, headTilt: 0, armsUp: true, cheeks: true);
      case MascotExpression.sleeping:
        return _Preset(eyes: _EyeState.closed, mouth: _MouthState.softSmile, earTilt: -0.07, bodyScale: 1.00, headTilt: -0.1, zzz: true);
      case MascotExpression.surprised:
        return _Preset(eyes: _EyeState.wide, mouth: _MouthState.oh, earTilt: 0.21, bodyScale: 1.04, headTilt: 0);
    }
  }

  @override
  bool shouldRepaint(_PipPainter old) =>
      old.expression != expression || old.blinking != blinking || old.bobOffset != bobOffset || old.size != size;
}

enum _EyeState { open, wide, crescent, closed, sideways, droop }
enum _MouthState { softSmile, smile, openGrin, frown, pursed, oh }

class _Preset {
  final _EyeState eyes;
  final _MouthState mouth;
  final double earTilt;
  final double bodyScale;
  final double headTilt;
  final bool armsUp;
  final bool cheeks;
  final bool zzz;
  _Preset({
    required this.eyes,
    required this.mouth,
    required this.earTilt,
    required this.bodyScale,
    required this.headTilt,
    this.armsUp = false,
    this.cheeks = false,
    this.zzz = false,
  });
}
