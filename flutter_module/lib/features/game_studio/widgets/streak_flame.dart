import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../theme.dart';

/// Streak counter with a hand-drawn flame icon. Subtle idle flicker; big flare animation
/// is triggered manually via the `flareKey` ValueNotifier — call `.value = !.value` to
/// fire one. Greyed out when count == 0.
class StreakFlame extends StatefulWidget {
  final int count;
  final double size;
  final ValueNotifier<bool>? flareKey;
  const StreakFlame({
    super.key,
    required this.count,
    this.size = 28,
    this.flareKey,
  });

  @override
  State<StreakFlame> createState() => _StreakFlameState();
}

class _StreakFlameState extends State<StreakFlame> with TickerProviderStateMixin {
  late final AnimationController _idle;
  late final AnimationController _flare;

  @override
  void initState() {
    super.initState();
    _idle = AnimationController(vsync: this, duration: const Duration(milliseconds: 1400))..repeat();
    _flare = AnimationController(vsync: this, duration: const Duration(milliseconds: 700));
    widget.flareKey?.addListener(_onFlare);
  }

  void _onFlare() => _flare.forward(from: 0);

  @override
  void didUpdateWidget(StreakFlame old) {
    super.didUpdateWidget(old);
    if (old.flareKey != widget.flareKey) {
      old.flareKey?.removeListener(_onFlare);
      widget.flareKey?.addListener(_onFlare);
    }
  }

  @override
  void dispose() {
    widget.flareKey?.removeListener(_onFlare);
    _idle.dispose();
    _flare.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final muted = widget.count == 0;
    return AnimatedBuilder(
      animation: Listenable.merge([_idle, _flare]),
      builder: (_, __) {
        final flicker = 1 + math.sin(_idle.value * math.pi * 2) * 0.06;
        final flare = 1 + (1 - math.cos(_flare.value * math.pi)) * 0.4;
        final scale = flicker * flare;
        return Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Transform.scale(
              scale: scale,
              child: SizedBox(
                width: widget.size,
                height: widget.size * 1.2,
                child: CustomPaint(
                  painter: _FlamePainter(
                    muted: muted,
                    flareProgress: _flare.value,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 6),
            Text(
              widget.count.toString(),
              style: TextStyle(
                fontFamily: 'Nunito',
                fontWeight: FontWeight.w800,
                fontSize: widget.size * 0.7,
                color: muted ? EduPalette.midGrey : EduPalette.streakYellowDark,
              ),
            ),
          ],
        );
      },
    );
  }
}

class _FlamePainter extends CustomPainter {
  final bool muted;
  final double flareProgress;
  _FlamePainter({required this.muted, required this.flareProgress});

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width, h = size.height;
    final outer = Path()
      ..moveTo(w * 0.5, h * 0.05)
      ..cubicTo(w * 0.92, h * 0.35, w * 0.95, h * 0.65, w * 0.55, h * 0.95)
      ..cubicTo(w * 0.10, h * 0.85, w * 0.05, h * 0.55, w * 0.30, h * 0.30)
      ..cubicTo(w * 0.42, h * 0.55, w * 0.50, h * 0.22, w * 0.5, h * 0.05)
      ..close();
    final inner = Path()
      ..moveTo(w * 0.55, h * 0.40)
      ..cubicTo(w * 0.75, h * 0.55, w * 0.72, h * 0.78, w * 0.50, h * 0.88)
      ..cubicTo(w * 0.30, h * 0.80, w * 0.32, h * 0.62, w * 0.55, h * 0.40)
      ..close();
    final outerColor = muted ? const Color(0xFFD4D4D4) : EduPalette.streakYellow;
    final innerColor = muted ? const Color(0xFFE8E8E8) : EduPalette.heartRed;
    final flarePaint = Paint()..color = (muted ? Colors.transparent : EduPalette.streakYellow).withOpacity(flareProgress * 0.4);
    if (!muted) {
      canvas.drawCircle(Offset(w * 0.5, h * 0.55), w * 0.6 * (0.5 + flareProgress * 0.4), flarePaint);
    }
    canvas.drawPath(outer, Paint()..color = outerColor);
    canvas.drawPath(inner, Paint()..color = innerColor);
  }

  @override
  bool shouldRepaint(_FlamePainter old) => old.muted != muted || old.flareProgress != flareProgress;
}
