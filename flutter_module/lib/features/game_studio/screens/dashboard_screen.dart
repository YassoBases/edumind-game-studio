import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../api/client.dart';
import '../db/game_database.dart';
import '../models/game_spec.dart';
import '../theme.dart';
import '../widgets/edu_bottom_nav.dart';
import '../widgets/glass_card.dart';
import 'composer_screen.dart';
import 'library_screen.dart';
import 'profile_screen.dart';

class DashboardScreen extends StatefulWidget {
  final GameStudioApi api;
  final GameDatabase db;
  final String studentName;
  final bool arabic;
  const DashboardScreen({
    super.key,
    required this.api,
    required this.db,
    this.studentName = '',
    this.arabic = false,
  });

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  EduTab _tab = EduTab.home;
  List<GameSummary> _recent = const [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final games = await widget.api.library();
      if (!mounted) return;
      setState(() => _recent = games.take(6).toList());
    } catch (_) {}
  }

  String _greeting() {
    final h = DateTime.now().hour;
    final ar = widget.arabic;
    if (h < 12) return ar ? 'صباح الخير' : 'Good morning';
    if (h < 18) return ar ? 'مساء الخير' : 'Good afternoon';
    return ar ? 'مساء الخير' : 'Good evening';
  }

  String _suggestion() {
    final ar = widget.arabic;
    if (_recent.isEmpty) {
      return ar ? 'ابدأ أول لعبة' : 'Build your first game';
    }
    return ar ? 'جاهز للجولة التالية؟' : 'Ready for round ${_recent.length + 1}?';
  }

  @override
  Widget build(BuildContext context) {
    return Directionality(
      textDirection: widget.arabic ? TextDirection.rtl : TextDirection.ltr,
      child: Theme(
        data: EduTheme.themeData(arabic: widget.arabic),
        child: Scaffold(
          extendBody: true,
          body: Stack(
            children: [
              const Positioned.fill(child: GradientMesh(opacity: 0.5)),
              SafeArea(child: _buildContent()),
              Align(
                alignment: Alignment.bottomCenter,
                child: EduBottomNav(
                  current: _tab,
                  rtl: widget.arabic,
                  onTap: (t) {
                    if (t == _tab) return;
                    setState(() => _tab = t);
                    if (t == EduTab.library) {
                      Navigator.of(context).push(MaterialPageRoute(
                        builder: (_) => LibraryScreen(api: widget.api, db: widget.db),
                      ));
                    } else if (t == EduTab.profile) {
                      Navigator.of(context).push(MaterialPageRoute(
                        builder: (_) => ProfileScreen(api: widget.api, arabic: widget.arabic),
                      ));
                    }
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildContent() {
    final ar = widget.arabic;
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 120),
      children: [
        Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(_greeting(), style: TextStyle(color: EduTheme.textMuted, fontSize: 14, fontWeight: FontWeight.w600)),
                  const SizedBox(height: 4),
                  Text(
                    _suggestion(),
                    style: const TextStyle(color: EduTheme.textPrimary, fontSize: 24, fontWeight: FontWeight.w800, height: 1.1),
                  ),
                ],
              ),
            ),
            Container(
              width: 48, height: 48,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: EduTheme.heroGradient,
              ),
              alignment: Alignment.center,
              child: Text(
                widget.studentName.isNotEmpty ? widget.studentName[0].toUpperCase() : 'Y',
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 18),
              ),
            ).animate().fadeIn(duration: 500.ms),
          ],
        ),
        const SizedBox(height: 24),
        _heroComposer(ar),
        const SizedBox(height: 28),
        if (_recent.isNotEmpty) ...[
          _sectionHeader(ar ? 'تابع اللعب' : 'Continue playing', null),
          const SizedBox(height: 12),
          SizedBox(
            height: 180,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: _recent.length,
              separatorBuilder: (_, __) => const SizedBox(width: 12),
              itemBuilder: (_, i) => _recentCard(_recent[i], i, ar),
            ),
          ),
          const SizedBox(height: 28),
        ],
        _sectionHeader(ar ? 'اقتراحات لك' : 'Suggested for you', null),
        const SizedBox(height: 12),
        ..._suggestions(ar)
            .asMap()
            .entries
            .map((e) => Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: _suggestionTile(e.value, e.key, ar),
                ))
            .toList(),
      ],
    );
  }

  Widget _heroComposer(bool ar) {
    return GlassCard(
      padding: const EdgeInsets.all(24),
      backgroundGradient: EduTheme.heroGradient,
      gradientBorder: EduTheme.amberGradient,
      onTap: () => Navigator.of(context).push(MaterialPageRoute(
        builder: (_) => ComposerScreen(api: widget.api, arabic: widget.arabic),
      )),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  ar ? 'ماذا تريد أن تتعلم؟' : 'What do you want to play and learn?',
                  style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w800, height: 1.25),
                ),
                const SizedBox(height: 10),
                Text(
                  ar ? 'لعبة جديدة في 30 ثانية' : 'A custom game in 30 seconds',
                  style: TextStyle(color: Colors.white.withOpacity(0.85), fontSize: 14),
                ),
              ],
            ),
          ),
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(18)),
            child: const Icon(Icons.arrow_forward_rounded, color: EduTheme.accentCoral, size: 30),
          ).animate(onPlay: (c) => c.repeat(reverse: true)).slideX(begin: 0, end: 0.04, duration: 1200.ms, curve: EduCurves.spring),
        ],
      ),
    ).animate().fadeIn(duration: 400.ms).slideY(begin: 0.05, end: 0, curve: EduCurves.spring);
  }

  Widget _sectionHeader(String title, VoidCallback? onSeeAll) {
    return Row(
      children: [
        Expanded(child: Text(title, style: const TextStyle(color: EduTheme.textPrimary, fontSize: 18, fontWeight: FontWeight.w800))),
        if (onSeeAll != null)
          TextButton(
            onPressed: onSeeAll,
            child: Text(widget.arabic ? 'الكل ←' : 'See all →', style: const TextStyle(color: EduTheme.accentTeal, fontWeight: FontWeight.w700)),
          ),
      ],
    );
  }

  Widget _recentCard(GameSummary g, int idx, bool ar) {
    return SizedBox(
      width: 220,
      child: GlassCard(
        padding: const EdgeInsets.all(16),
        onTap: () {},
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              height: 84,
              decoration: BoxDecoration(
                gradient: _gradientFor(idx),
                borderRadius: BorderRadius.circular(14),
              ),
              alignment: Alignment.center,
              child: Text(
                _emojiFor(g.templateId),
                style: const TextStyle(fontSize: 36),
              ),
            ),
            const SizedBox(height: 12),
            Text(g.topic, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: EduTheme.textPrimary, fontSize: 15, fontWeight: FontWeight.w700)),
            const SizedBox(height: 4),
            Text(g.subject, style: const TextStyle(color: EduTheme.textMuted, fontSize: 12)),
          ],
        ),
      ),
    ).animate(delay: (idx * 80).ms).fadeIn(duration: 380.ms).slideX(begin: 0.05, end: 0, curve: EduCurves.spring);
  }

  Widget _suggestionTile(_Suggestion s, int idx, bool ar) {
    return GlassCard(
      onTap: () => Navigator.of(context).push(MaterialPageRoute(
        builder: (_) => ComposerScreen(api: widget.api, arabic: widget.arabic, prefilledPrompt: s.prefill),
      )),
      child: Row(
        children: [
          Container(
            width: 56, height: 56,
            decoration: BoxDecoration(gradient: s.gradient, borderRadius: BorderRadius.circular(16)),
            alignment: Alignment.center,
            child: Text(s.emoji, style: const TextStyle(fontSize: 28)),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(s.title, style: const TextStyle(color: EduTheme.textPrimary, fontSize: 16, fontWeight: FontWeight.w700)),
                const SizedBox(height: 2),
                Text(s.subtitle, style: const TextStyle(color: EduTheme.textMuted, fontSize: 13)),
              ],
            ),
          ),
          const Icon(Icons.arrow_forward_ios_rounded, color: EduTheme.textMuted, size: 16),
        ],
      ),
    ).animate(delay: (idx * 100).ms).fadeIn(duration: 340.ms).slideY(begin: 0.04, end: 0);
  }

  List<_Suggestion> _suggestions(bool ar) {
    return [
      _Suggestion(
        emoji: '🏎️',
        title: ar ? 'سباق + التمثيل الضوئي' : 'Racing + photosynthesis',
        subtitle: ar ? 'لعبة سباق سيارات' : 'A car-racing game',
        gradient: EduTheme.heroGradient,
        prefill: ar ? 'سباق سيارات وعلم النبات' : 'A car racing game about photosynthesis',
      ),
      _Suggestion(
        emoji: '⚽',
        title: ar ? 'كرة قدم + عواصم' : 'Football + capitals',
        subtitle: ar ? 'تسديد للمرمى الصحيح' : 'Shoot at the right goal',
        gradient: EduTheme.successGradient,
        prefill: ar ? 'كرة قدم وعواصم العالم' : 'Football game about world capitals',
      ),
      _Suggestion(
        emoji: '🏰',
        title: ar ? 'بناء قلعة + كسور' : 'Castle build + fractions',
        subtitle: ar ? 'كل لبنة هي معادلة' : 'Each block is a fraction',
        gradient: EduTheme.violetGradient,
        prefill: ar ? 'بناء قلعة وتعلم الكسور' : 'Build a castle while learning fractions',
      ),
    ];
  }

  String _emojiFor(String templateId) {
    switch (templateId) {
      case 'target_practice': return '🎯';
      case 'build_combine': return '🧱';
      case 'quiz_quest': return '🗺️';
      case 'match_pairs': return '🃏';
      case 'sort_categorize': return '📦';
      case 'sequence': return '🔢';
      default: return '🎮';
    }
  }

  Gradient _gradientFor(int idx) {
    const gradients = [EduTheme.heroGradient, EduTheme.successGradient, EduTheme.violetGradient, EduTheme.amberGradient];
    return gradients[idx % gradients.length];
  }
}

class _Suggestion {
  final String emoji;
  final String title;
  final String subtitle;
  final Gradient gradient;
  final String prefill;
  _Suggestion({required this.emoji, required this.title, required this.subtitle, required this.gradient, required this.prefill});
}
