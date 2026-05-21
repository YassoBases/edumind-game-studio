import 'package:flutter/material.dart';
import '../theme.dart';

enum LessonState { locked, available, mastered }

/// Duolingo-style mastery-tree node. Circular node with state-specific appearance.
/// Tappable when state == available (calls onTap).
class LessonNode extends StatelessWidget {
  final String label;
  final LessonState state;
  final IconData? icon;
  final VoidCallback? onTap;
  final double size;
  const LessonNode({
    super.key,
    required this.label,
    required this.state,
    this.icon,
    this.onTap,
    this.size = 72,
  });

  @override
  Widget build(BuildContext context) {
    final color = switch (state) {
      LessonState.mastered => EduPalette.streakYellow,
      LessonState.available => EduPalette.primaryGreen,
      LessonState.locked => EduPalette.midGrey,
    };
    final shadowColor = switch (state) {
      LessonState.mastered => EduPalette.streakYellowDark,
      LessonState.available => EduPalette.primaryGreenDark,
      LessonState.locked => const Color(0xFF8E8E8E),
    };
    final node = SizedBox(
      width: size,
      height: size + 8,
      child: Stack(
        children: [
          // Shadow band
          Positioned(
            left: 0, right: 0, top: 8, bottom: 0,
            child: Container(
              decoration: BoxDecoration(
                color: shadowColor,
                shape: BoxShape.circle,
              ),
            ),
          ),
          // Surface
          Positioned(
            left: 0, right: 0, top: 0, height: size,
            child: Container(
              decoration: BoxDecoration(
                color: color,
                shape: BoxShape.circle,
              ),
              alignment: Alignment.center,
              child: state == LessonState.locked
                  ? const Icon(Icons.lock_rounded, color: Colors.white, size: 28)
                  : state == LessonState.mastered
                      ? const Icon(Icons.emoji_events_rounded, color: Colors.white, size: 36)
                      : Icon(icon ?? Icons.play_arrow_rounded, color: Colors.white, size: 36),
            ),
          ),
        ],
      ),
    );

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        state == LessonState.available
            ? GestureDetector(onTap: onTap, child: node)
            : node,
        const SizedBox(height: 6),
        SizedBox(
          width: size + 20,
          child: Text(
            label,
            textAlign: TextAlign.center,
            overflow: TextOverflow.ellipsis,
            maxLines: 2,
            style: const TextStyle(
              fontFamily: 'Nunito',
              fontWeight: FontWeight.w800,
              fontSize: 12,
              color: EduPalette.baseDark,
            ),
          ),
        ),
      ],
    );
  }
}

