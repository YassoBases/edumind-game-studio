import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../api/client.dart';
import '../theme.dart';
import '../widgets/glass_card.dart';

class ProfileScreen extends StatelessWidget {
  final GameStudioApi api;
  final bool arabic;
  const ProfileScreen({super.key, required this.api, this.arabic = false});

  @override
  Widget build(BuildContext context) {
    return Directionality(
      textDirection: arabic ? TextDirection.rtl : TextDirection.ltr,
      child: Theme(
        data: EduTheme.themeData(arabic: arabic),
        child: Scaffold(
          appBar: AppBar(title: Text(arabic ? 'الملف الشخصي' : 'Profile')),
          body: Stack(
            children: [
              const Positioned.fill(child: GradientMesh(opacity: 0.35)),
              ListView(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 40),
                children: [
                  _identityCard(),
                  const SizedBox(height: 20),
                  Row(
                    children: [
                      Expanded(child: _statCard('🔥', arabic ? 'تتالي' : 'Streak', '4', EduTheme.heroGradient)),
                      const SizedBox(width: 12),
                      Expanded(child: _statCard('🎮', arabic ? 'الألعاب' : 'Games', '12', EduTheme.violetGradient)),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(child: _statCard('⭐', arabic ? 'الإتقان' : 'Mastered', '7', EduTheme.successGradient)),
                      const SizedBox(width: 12),
                      Expanded(child: _statCard('🎨', arabic ? 'الأسلوب' : 'Favorite', arabic ? 'سباق' : 'Racing', EduTheme.amberGradient)),
                    ],
                  ),
                  const SizedBox(height: 24),
                  Text(arabic ? 'خريطة الإتقان' : 'Mastery map',
                      style: const TextStyle(color: EduTheme.textPrimary, fontSize: 18, fontWeight: FontWeight.w800)),
                  const SizedBox(height: 12),
                  _masteryRow('Biology', ['Photosynthesis', 'Cell organelles'], [0.85, 0.55]),
                  _masteryRow('Math', ['Linear equations', 'Fractions'], [0.65, 0.40]),
                  _masteryRow('Geography', ['World capitals'], [0.75]),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _identityCard() => GlassCard(
        gradientBorder: EduTheme.heroGradient,
        padding: const EdgeInsets.all(24),
        child: Row(
          children: [
            Container(
              width: 72, height: 72,
              decoration: const BoxDecoration(shape: BoxShape.circle, gradient: EduTheme.heroGradient),
              alignment: Alignment.center,
              child: const Text('Y', style: TextStyle(color: Colors.white, fontSize: 30, fontWeight: FontWeight.w800)),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(arabic ? 'تلميذ EduMind' : 'EduMind learner',
                      style: const TextStyle(color: EduTheme.textPrimary, fontSize: 20, fontWeight: FontWeight.w800)),
                  const SizedBox(height: 4),
                  Text(arabic ? 'الصف 9 — منذ مايو 2026' : 'Grade 9 — since May 2026',
                      style: const TextStyle(color: EduTheme.textMuted, fontSize: 13)),
                ],
              ),
            ),
          ],
        ),
      ).animate().fadeIn(duration: 400.ms).slideY(begin: 0.05, curve: EduCurves.spring);

  Widget _statCard(String emoji, String label, String value, Gradient g) => GlassCard(
        padding: const EdgeInsets.all(16),
        backgroundGradient: g,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(emoji, style: const TextStyle(fontSize: 28)),
            const SizedBox(height: 8),
            Text(value, style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w800)),
            Text(label, style: TextStyle(color: Colors.white.withOpacity(0.85), fontSize: 12, fontWeight: FontWeight.w600)),
          ],
        ),
      );

  Widget _masteryRow(String subject, List<String> topics, List<double> levels) => Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: GlassCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(subject, style: const TextStyle(color: EduTheme.textPrimary, fontSize: 16, fontWeight: FontWeight.w800)),
              const SizedBox(height: 12),
              for (int i = 0; i < topics.length; i++)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Row(
                    children: [
                      Expanded(child: Text(topics[i], style: const TextStyle(color: EduTheme.textSecondary, fontSize: 13))),
                      const SizedBox(width: 12),
                      SizedBox(
                        width: 100,
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(8),
                          child: LinearProgressIndicator(
                            value: levels[i],
                            backgroundColor: Colors.white12,
                            valueColor: AlwaysStoppedAnimation(
                              levels[i] >= 0.75 ? EduTheme.success : EduTheme.accentAmber,
                            ),
                            minHeight: 8,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text('${(levels[i] * 100).round()}%',
                          style: const TextStyle(color: EduTheme.textPrimary, fontSize: 12, fontWeight: FontWeight.w700)),
                    ],
                  ),
                ),
            ],
          ),
        ),
      );
}
