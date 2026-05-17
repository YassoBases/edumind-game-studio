import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:intl/intl.dart' show DateFormat;
import '../api/client.dart';
import '../db/game_database.dart';
import '../models/game_spec.dart';
import '../theme.dart';
import '../widgets/glass_card.dart';
import 'game_player_screen.dart';

class LibraryScreen extends StatefulWidget {
  final GameStudioApi api;
  final GameDatabase db;
  final bool arabic;
  const LibraryScreen({super.key, required this.api, required this.db, this.arabic = false});

  @override
  State<LibraryScreen> createState() => _LibraryScreenState();
}

class _LibraryScreenState extends State<LibraryScreen> {
  List<GameSummary> _remote = const [];
  List<StoredGame> _offline = const [];
  String _filter = 'all';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final off = await widget.db.listGames();
    if (!mounted) return;
    setState(() => _offline = off);
    try {
      final rem = await widget.api.library();
      if (!mounted) return;
      setState(() => _remote = rem);
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final ar = widget.arabic;
    final filtered = _filter == 'all' ? _remote : _remote.where((g) => g.templateId == _filter).toList();
    final fmt = DateFormat.MMMd();
    return Directionality(
      textDirection: ar ? TextDirection.rtl : TextDirection.ltr,
      child: Theme(
        data: EduTheme.themeData(arabic: ar),
        child: Scaffold(
          appBar: AppBar(title: Text(ar ? 'مكتبتك' : 'Your library')),
          body: Stack(
            children: [
              const Positioned.fill(child: GradientMesh(opacity: 0.35)),
              RefreshIndicator(
                onRefresh: _load,
                color: EduTheme.accentCoral,
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(20, 8, 20, 40),
                  children: [
                    SizedBox(
                      height: 44,
                      child: ListView(
                        scrollDirection: Axis.horizontal,
                        children: [
                          _filterChip('all', ar ? 'الكل' : 'All'),
                          _filterChip('target_practice', ar ? 'سباق/هدف' : 'Racing/Goal'),
                          _filterChip('build_combine', ar ? 'بناء' : 'Build'),
                          _filterChip('quiz_quest', ar ? 'مغامرة' : 'Quest'),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                    if (_offline.isNotEmpty) ...[
                      Text(ar ? 'بدون اتصال' : 'Offline', style: const TextStyle(color: EduTheme.textMuted, fontSize: 13, fontWeight: FontWeight.w700)),
                      const SizedBox(height: 8),
                      ..._offline.asMap().entries.map((e) => _offlineRow(e.value, e.key)),
                      const SizedBox(height: 20),
                    ],
                    Text(ar ? 'سحابي' : 'Cloud', style: const TextStyle(color: EduTheme.textMuted, fontSize: 13, fontWeight: FontWeight.w700)),
                    const SizedBox(height: 8),
                    GridView.builder(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: 2,
                        mainAxisSpacing: 12,
                        crossAxisSpacing: 12,
                        childAspectRatio: 0.95,
                      ),
                      itemCount: filtered.length,
                      itemBuilder: (_, i) => _cloudCard(filtered[i], i, fmt),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _filterChip(String key, String label) {
    final selected = _filter == key;
    return Padding(
      padding: const EdgeInsetsDirectional.only(end: 8),
      child: InkWell(
        borderRadius: BorderRadius.circular(99),
        onTap: () => setState(() => _filter = key),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 240),
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
          decoration: BoxDecoration(
            color: selected ? null : EduTheme.surfaceElevated,
            gradient: selected ? EduTheme.heroGradient : null,
            borderRadius: BorderRadius.circular(99),
            border: Border.all(color: selected ? Colors.transparent : EduTheme.border),
          ),
          child: Text(label, style: TextStyle(color: selected ? Colors.white : EduTheme.textSecondary, fontWeight: FontWeight.w700)),
        ),
      ),
    );
  }

  Widget _cloudCard(GameSummary g, int idx, DateFormat fmt) {
    return GlassCard(
      padding: const EdgeInsets.all(14),
      onTap: () {},
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Container(
              width: double.infinity,
              decoration: BoxDecoration(gradient: _gradientFor(idx), borderRadius: BorderRadius.circular(12)),
              alignment: Alignment.center,
              child: Text(_emoji(g.templateId), style: const TextStyle(fontSize: 44)),
            ),
          ),
          const SizedBox(height: 10),
          Text(g.topic, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: EduTheme.textPrimary, fontSize: 14, fontWeight: FontWeight.w800)),
          const SizedBox(height: 2),
          Text('${g.subject} · ${fmt.format(g.createdAt)}', style: const TextStyle(color: EduTheme.textMuted, fontSize: 11)),
        ],
      ),
    ).animate(delay: (idx * 60).ms).fadeIn(duration: 260.ms).slideY(begin: 0.04, end: 0);
  }

  Widget _offlineRow(StoredGame g, int idx) => GlassCard(
        padding: const EdgeInsets.all(12),
        onTap: () {
          Navigator.of(context).push(MaterialPageRoute(
            builder: (_) => GamePlayerScreen(
              api: widget.api,
              game: GeneratedGame(gameId: g.id, orientation: 'portrait', language: g.language, html: g.html),
            ),
          ));
        },
        child: Row(
          children: [
            Container(
              width: 48, height: 48,
              decoration: BoxDecoration(gradient: _gradientFor(idx), borderRadius: BorderRadius.circular(12)),
              alignment: Alignment.center,
              child: Text(_emoji(g.templateId), style: const TextStyle(fontSize: 24)),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(g.topic, style: const TextStyle(color: EduTheme.textPrimary, fontSize: 14, fontWeight: FontWeight.w700)),
                  Text('${g.subject} · best ${g.bestScore}', style: const TextStyle(color: EduTheme.textMuted, fontSize: 11)),
                ],
              ),
            ),
            const Icon(Icons.play_arrow_rounded, color: EduTheme.accentTeal, size: 28),
          ],
        ),
      );

  String _emoji(String templateId) {
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
