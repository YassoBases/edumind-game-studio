import 'package:flutter/material.dart';
import '../theme.dart';

/// Animated XP progress bar. Tween smooths the fill on value change; an optional shimmer
/// sweeps after XP gain. Used in the dashboard top strip.
class XpBar extends StatefulWidget {
  final int xp;
  final int xpToNextLevel;
  final double width;
  final double height;
  const XpBar({
    super.key,
    required this.xp,
    this.xpToNextLevel = 500,
    this.width = 200,
    this.height = 16,
  });

  @override
  State<XpBar> createState() => _XpBarState();
}

class _XpBarState extends State<XpBar> with SingleTickerProviderStateMixin {
  late final AnimationController _shimmerCtrl;
  int _shownXp = 0;

  @override
  void initState() {
    super.initState();
    _shimmerCtrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 800));
    _shownXp = widget.xp;
  }

  @override
  void didUpdateWidget(XpBar old) {
    super.didUpdateWidget(old);
    if (old.xp != widget.xp) {
      _shownXp = widget.xp;
      _shimmerCtrl.forward(from: 0);
    }
  }

  @override
  void dispose() {
    _shimmerCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final progress = (_shownXp / widget.xpToNextLevel).clamp(0.0, 1.0).toDouble();
    return SizedBox(
      width: widget.width,
      height: widget.height,
      child: Stack(
        children: [
          // Track
          Container(
            decoration: BoxDecoration(
              color: EduPalette.stroke,
              borderRadius: BorderRadius.circular(EduRadius.pill),
            ),
          ),
          // Fill
          ClipRRect(
            borderRadius: BorderRadius.circular(EduRadius.pill),
            child: TweenAnimationBuilder<double>(
              tween: Tween(begin: 0, end: progress),
              duration: const Duration(milliseconds: 600),
              curve: EduCurves.spring,
              builder: (_, v, __) => Container(
                width: widget.width * v,
                decoration: BoxDecoration(
                  color: EduPalette.streakYellow,
                  borderRadius: BorderRadius.circular(EduRadius.pill),
                ),
              ),
            ),
          ),
          // Shimmer on gain
          AnimatedBuilder(
            animation: _shimmerCtrl,
            builder: (_, __) {
              if (_shimmerCtrl.value == 0) return const SizedBox.shrink();
              final x = widget.width * _shimmerCtrl.value;
              return Positioned(
                left: x - 30,
                top: 0,
                bottom: 0,
                width: 60,
                child: IgnorePointer(
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(EduRadius.pill),
                    child: Container(
                      decoration: const BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.centerLeft,
                          end: Alignment.centerRight,
                          colors: [Colors.transparent, Colors.white54, Colors.transparent],
                        ),
                      ),
                    ),
                  ),
                ),
              );
            },
          ),
        ],
      ),
    );
  }
}
