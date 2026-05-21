import 'package:flutter/material.dart';
import '../theme.dart';

/// Heart row with scale-out animation on loss. Hearts is `current` of `max`.
class HeartRow extends StatelessWidget {
  final int current;
  final int max;
  final double size;
  const HeartRow({super.key, required this.current, this.max = 5, this.size = 22});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(max, (i) {
        final alive = i < current;
        return Padding(
          padding: const EdgeInsets.symmetric(horizontal: 2),
          child: AnimatedScale(
            scale: alive ? 1.0 : 0.7,
            duration: const Duration(milliseconds: 240),
            curve: EduCurves.bounce,
            child: AnimatedOpacity(
              opacity: alive ? 1.0 : 0.35,
              duration: const Duration(milliseconds: 240),
              child: CustomPaint(
                size: Size(size, size),
                painter: _HeartPainter(filled: alive),
              ),
            ),
          ),
        );
      }),
    );
  }
}

class _HeartPainter extends CustomPainter {
  final bool filled;
  _HeartPainter({required this.filled});
  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width, h = size.height;
    final path = Path()
      ..moveTo(w * 0.5, h * 0.92)
      ..cubicTo(-w * 0.05, h * 0.55, w * 0.10, h * 0.10, w * 0.5, h * 0.30)
      ..cubicTo(w * 0.90, h * 0.10, w * 1.05, h * 0.55, w * 0.5, h * 0.92)
      ..close();
    final paint = Paint()
      ..color = filled ? EduPalette.heartRed : EduPalette.midGrey
      ..style = PaintingStyle.fill;
    canvas.drawPath(path, paint);
    if (filled) {
      final highlight = Paint()..color = Colors.white.withOpacity(0.35);
      canvas.drawOval(
        Rect.fromCenter(center: Offset(w * 0.32, h * 0.40), width: w * 0.18, height: h * 0.12),
        highlight,
      );
    }
  }

  @override
  bool shouldRepaint(_HeartPainter old) => old.filled != filled;
}
