import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../theme.dart';

/// Daily-goal progress ring. `progress` in 0..1. Animates to the new value over 500ms.
/// Center renders an emoji + the current/goal text.
class ProgressRing extends StatelessWidget {
  final double progress;
  final int current;
  final int goal;
  final double size;
  final Color color;
  const ProgressRing({
    super.key,
    required this.progress,
    required this.current,
    required this.goal,
    this.size = 64,
    this.color = EduPalette.primaryGreen,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: TweenAnimationBuilder<double>(
        tween: Tween(begin: 0, end: progress.clamp(0.0, 1.0)),
        duration: const Duration(milliseconds: 500),
        curve: EduCurves.soft,
        builder: (_, v, __) => Stack(
          fit: StackFit.expand,
          children: [
            CustomPaint(painter: _RingPainter(progress: v, color: color)),
            Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text('🎯', style: TextStyle(fontSize: size * 0.30)),
                  Text(
                    '$current/$goal',
                    style: TextStyle(
                      fontFamily: 'Nunito',
                      fontWeight: FontWeight.w800,
                      fontSize: size * 0.18,
                      color: EduPalette.baseDark,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _RingPainter extends CustomPainter {
  final double progress;
  final Color color;
  _RingPainter({required this.progress, required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    final stroke = size.shortestSide * 0.10;
    final rect = Rect.fromCircle(
      center: Offset(size.width / 2, size.height / 2),
      radius: size.shortestSide / 2 - stroke / 2,
    );
    final bg = Paint()
      ..color = EduPalette.stroke
      ..strokeWidth = stroke
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;
    canvas.drawArc(rect, 0, math.pi * 2, false, bg);
    final fg = Paint()
      ..color = color
      ..strokeWidth = stroke
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;
    canvas.drawArc(rect, -math.pi / 2, math.pi * 2 * progress, false, fg);
  }

  @override
  bool shouldRepaint(_RingPainter old) => old.progress != progress || old.color != color;
}
