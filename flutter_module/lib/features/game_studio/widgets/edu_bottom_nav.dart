import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../theme.dart';

enum EduTab { home, library, profile }

class EduBottomNav extends StatelessWidget {
  final EduTab current;
  final void Function(EduTab) onTap;
  final bool rtl;
  const EduBottomNav({super.key, required this.current, required this.onTap, this.rtl = false});

  @override
  Widget build(BuildContext context) {
    final items = [
      (EduTab.home, _iconHome, rtl ? 'الرئيسية' : 'Home'),
      (EduTab.library, _iconLibrary, rtl ? 'المكتبة' : 'Library'),
      (EduTab.profile, _iconProfile, rtl ? 'الملف' : 'Profile'),
    ];
    return Container(
      margin: const EdgeInsets.fromLTRB(20, 0, 20, 20),
      decoration: BoxDecoration(
        color: EduTheme.surfaceElevated.withOpacity(0.92),
        borderRadius: BorderRadius.circular(28),
        border: Border.all(color: EduTheme.border),
        boxShadow: const [BoxShadow(color: Color(0x66000000), blurRadius: 24, offset: Offset(0, 8))],
      ),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: items.map((it) {
          final selected = current == it.$1;
          return Expanded(
            child: InkWell(
              borderRadius: BorderRadius.circular(20),
              onTap: () => onTap(it.$1),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 300),
                curve: EduCurves.spring,
                padding: const EdgeInsets.symmetric(vertical: 10),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(20),
                  gradient: selected ? EduTheme.heroGradient : null,
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    SizedBox(
                      width: 28,
                      height: 28,
                      child: CustomPaint(
                        painter: _NavIconPainter(
                          path: it.$2,
                          color: selected ? Colors.white : EduTheme.textSecondary,
                          filled: selected,
                        ),
                      ),
                    ).animate(target: selected ? 1 : 0).scale(
                          duration: 300.ms,
                          begin: const Offset(1, 1),
                          end: const Offset(1.15, 1.15),
                          curve: EduCurves.spring,
                        ),
                    const SizedBox(height: 4),
                    Text(
                      it.$3,
                      style: TextStyle(
                        color: selected ? Colors.white : EduTheme.textSecondary,
                        fontSize: 11,
                        fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }
}

typedef _IconPath = void Function(Canvas canvas, Size size, Paint paint);

void _iconHome(Canvas canvas, Size size, Paint paint) {
  final p = Path()
    ..moveTo(size.width * 0.5, size.height * 0.10)
    ..lineTo(size.width * 0.05, size.height * 0.50)
    ..lineTo(size.width * 0.20, size.height * 0.50)
    ..lineTo(size.width * 0.20, size.height * 0.90)
    ..lineTo(size.width * 0.40, size.height * 0.90)
    ..lineTo(size.width * 0.40, size.height * 0.60)
    ..lineTo(size.width * 0.60, size.height * 0.60)
    ..lineTo(size.width * 0.60, size.height * 0.90)
    ..lineTo(size.width * 0.80, size.height * 0.90)
    ..lineTo(size.width * 0.80, size.height * 0.50)
    ..lineTo(size.width * 0.95, size.height * 0.50)
    ..close();
  canvas.drawPath(p, paint);
}

void _iconLibrary(Canvas canvas, Size size, Paint paint) {
  for (int i = 0; i < 4; i++) {
    final x = size.width * (0.15 + i * 0.18);
    canvas.drawRRect(
      RRect.fromLTRBR(x, size.height * 0.15, x + size.width * 0.12, size.height * 0.85, const Radius.circular(2)),
      paint,
    );
  }
}

void _iconProfile(Canvas canvas, Size size, Paint paint) {
  canvas.drawCircle(Offset(size.width * 0.5, size.height * 0.35), size.width * 0.18, paint);
  final body = Path()
    ..moveTo(size.width * 0.20, size.height * 0.85)
    ..quadraticBezierTo(size.width * 0.5, size.height * 0.55, size.width * 0.80, size.height * 0.85)
    ..lineTo(size.width * 0.20, size.height * 0.85)
    ..close();
  canvas.drawPath(body, paint);
}

class _NavIconPainter extends CustomPainter {
  final _IconPath path;
  final Color color;
  final bool filled;
  _NavIconPainter({required this.path, required this.color, required this.filled});
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = filled ? PaintingStyle.fill : PaintingStyle.stroke
      ..strokeWidth = 2
      ..strokeJoin = StrokeJoin.round
      ..strokeCap = StrokeCap.round;
    path(canvas, size, paint);
  }

  @override
  bool shouldRepaint(_NavIconPainter old) =>
      old.color != color || old.filled != filled || old.path != path;
}
