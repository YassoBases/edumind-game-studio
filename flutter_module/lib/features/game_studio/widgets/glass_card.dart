import 'dart:math' as math;
import 'dart:ui';
import 'package:flutter/material.dart';
import '../theme.dart';

class GlassCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;
  final double radius;
  final Gradient? gradientBorder;
  final Gradient? backgroundGradient;
  final VoidCallback? onTap;
  final double blur;

  const GlassCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(20),
    this.radius = 24,
    this.gradientBorder,
    this.backgroundGradient,
    this.onTap,
    this.blur = 20,
  });

  @override
  Widget build(BuildContext context) {
    final r = BorderRadius.circular(radius);
    final core = ClipRRect(
      borderRadius: r,
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: blur, sigmaY: blur),
        child: Container(
          decoration: BoxDecoration(
            gradient: backgroundGradient ??
                LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    Colors.white.withOpacity(0.08),
                    Colors.white.withOpacity(0.02),
                  ],
                ),
            borderRadius: r,
            border: Border.all(color: EduTheme.border, width: 1),
            boxShadow: const [
              BoxShadow(color: Color(0x88000000), blurRadius: 24, offset: Offset(0, 8)),
            ],
          ),
          padding: padding,
          child: child,
        ),
      ),
    );
    final wrapped = gradientBorder == null
        ? core
        : Container(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(radius + 1),
              gradient: gradientBorder,
            ),
            padding: const EdgeInsets.all(1.5),
            child: core,
          );
    if (onTap == null) return wrapped;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: r,
        splashColor: EduTheme.accentCoral.withOpacity(0.15),
        child: wrapped,
      ),
    );
  }
}

/// Animated gradient mesh blob used as scene backgrounds.
class GradientMesh extends StatefulWidget {
  final double opacity;
  const GradientMesh({super.key, this.opacity = 0.55});
  @override
  State<GradientMesh> createState() => _GradientMeshState();
}

class _GradientMeshState extends State<GradientMesh> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(seconds: 18),
  )..repeat();

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _c,
      builder: (_, __) {
        final t = _c.value * 2 * 3.1415;
        return Opacity(
          opacity: widget.opacity,
          child: Stack(
            children: [
              Positioned(
                left: 60 + 80 * _sin(t),
                top: 80 + 60 * _cos(t),
                child: _blob(220, EduTheme.accentCoral),
              ),
              Positioned(
                right: 40 + 60 * _cos(t * 0.8),
                top: 220 + 40 * _sin(t * 0.6),
                child: _blob(180, EduTheme.accentViolet),
              ),
              Positioned(
                left: 100 + 50 * _sin(t * 1.2),
                bottom: 120 + 40 * _cos(t * 0.9),
                child: _blob(260, EduTheme.accentTeal),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _blob(double size, Color color) => Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: RadialGradient(colors: [color.withOpacity(0.7), color.withOpacity(0)]),
        ),
      );

  double _sin(double x) => math.sin(x);
  double _cos(double x) => math.cos(x);
}
