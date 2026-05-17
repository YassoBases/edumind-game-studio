import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../api/client.dart';
import '../models/summary.dart';
import '../theme.dart';
import '../widgets/glass_card.dart';

class SummaryScreen extends StatefulWidget {
  final GameStudioApi api;
  final String gameId;
  const SummaryScreen({super.key, required this.api, required this.gameId});

  @override
  State<SummaryScreen> createState() => _SummaryScreenState();
}

class _SummaryScreenState extends State<SummaryScreen> {
  SummaryPayload? _payload;
  SummaryEnrichment? _enrichment;
  bool _ready = false;
  Timer? _poll;
  int _attempts = 0;

  @override
  void initState() {
    super.initState();
    _initial();
  }

  Future<void> _initial() async {
    try {
      final r = await widget.api.fetchSummary(widget.gameId);
      if (!mounted) return;
      setState(() {
        _payload = r.$1;
        _enrichment = r.$2;
        _ready = r.$3;
      });
      if (!_ready) _startPolling();
    } catch (_) {}
  }

  void _startPolling() {
    _poll = Timer.periodic(const Duration(milliseconds: 1500), (t) async {
      _attempts += 1;
      try {
        final r = await widget.api.fetchSummary(widget.gameId);
        if (r.$3 || _attempts >= 4) {
          if (mounted) setState(() { _enrichment = r.$2; _ready = r.$3; });
          t.cancel();
        }
      } catch (_) { if (_attempts >= 4) t.cancel(); }
    });
  }

  @override
  void dispose() {
    _poll?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final p = _payload;
    if (p == null) {
      return Scaffold(
        backgroundColor: EduTheme.base,
        body: const Center(child: CircularProgressIndicator(color: EduTheme.accentCoral)),
      );
    }
    final ar = p.topic.runes.any((r) => r >= 0x600 && r <= 0x6FF);
    final strengths = _enrichment?.strengths.isNotEmpty == true ? _enrichment!.strengths : p.strengths;
    final growth = _enrichment?.growthAreas.isNotEmpty == true ? _enrichment!.growthAreas : p.growthAreas;
    final nextTopics = _enrichment?.recommendedNextTopics.isNotEmpty == true
        ? _enrichment!.recommendedNextTopics
        : p.recommendedNextTopics;
    return Directionality(
      textDirection: ar ? TextDirection.rtl : TextDirection.ltr,
      child: Theme(
        data: EduTheme.themeData(arabic: ar),
        child: Scaffold(
          body: Stack(
            children: [
              const Positioned.fill(child: GradientMesh(opacity: 0.55)),
              SafeArea(
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(20, 16, 20, 40),
                  children: [
                    _hero(p, ar),
                    const SizedBox(height: 16),
                    _quickStats(p, ar),
                    const SizedBox(height: 22),
                    Text(ar ? 'حسب المفهوم' : 'Per concept', style: _sectionTitle()),
                    const SizedBox(height: 10),
                    ...p.conceptMastery.asMap().entries.map((e) => Padding(
                          padding: const EdgeInsets.only(bottom: 10),
                          child: _conceptRow(e.value, e.key, ar),
                        )),
                    if (strengths.isNotEmpty) ...[
                      const SizedBox(height: 18),
                      Text(ar ? 'نقاط القوة' : 'Strengths', style: _sectionTitle()),
                      const SizedBox(height: 10),
                      _chipWrap(strengths, EduTheme.successGradient),
                    ],
                    if (growth.isNotEmpty) ...[
                      const SizedBox(height: 18),
                      Text(ar ? 'مجالات النمو' : 'Growth areas', style: _sectionTitle()),
                      const SizedBox(height: 10),
                      _chipWrap(growth, EduTheme.amberGradient),
                    ],
                    if (nextTopics.isNotEmpty) ...[
                      const SizedBox(height: 18),
                      Text(ar ? 'مواضيع مقترحة' : 'Try next', style: _sectionTitle()),
                      const SizedBox(height: 10),
                      ...nextTopics.asMap().entries.map((e) => Padding(
                            padding: const EdgeInsets.only(bottom: 10),
                            child: _nextTopicTile(e.value, e.key),
                          )),
                    ],
                    if (!_ready)
                      const Padding(
                        padding: EdgeInsets.only(top: 16),
                        child: LinearProgressIndicator(color: EduTheme.accentTeal),
                      ),
                    const SizedBox(height: 24),
                    Row(
                      children: [
                        Expanded(
                          child: FilledButton(
                            onPressed: () => Navigator.of(context).popUntil((r) => r.isFirst),
                            child: Text(ar ? 'تم' : 'Done'),
                          ),
                        ),
                      ],
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

  TextStyle _sectionTitle() => const TextStyle(color: EduTheme.textPrimary, fontSize: 18, fontWeight: FontWeight.w800);

  Widget _hero(SummaryPayload p, bool ar) => GlassCard(
        backgroundGradient: p.masteryAchieved ? EduTheme.successGradient : EduTheme.heroGradient,
        gradientBorder: EduTheme.heroGradient,
        padding: const EdgeInsets.all(22),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(p.masteryAchieved ? (ar ? 'إتقان مذهل' : 'Mastery achieved') : (ar ? 'جولة رائعة' : 'Round done'),
                style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w700)),
            const SizedBox(height: 8),
            Text(p.topic, style: const TextStyle(color: Colors.white, fontSize: 26, fontWeight: FontWeight.w800)),
            const SizedBox(height: 6),
            Text(p.subject, style: TextStyle(color: Colors.white.withOpacity(0.9), fontSize: 14)),
          ],
        ),
      ).animate().fadeIn(duration: 400.ms).slideY(begin: 0.04, curve: EduCurves.spring);

  Widget _quickStats(SummaryPayload p, bool ar) => Row(
        children: [
          Expanded(child: _statRing(ar ? 'الدقة' : 'Accuracy', p.overallAccuracy, EduTheme.successGradient, '${(p.overallAccuracy * 100).round()}%')),
          const SizedBox(width: 12),
          Expanded(child: _statRing(ar ? 'المستوى' : 'Level', p.highestLevelReached / 5, EduTheme.violetGradient, '${p.highestLevelReached}/5')),
          const SizedBox(width: 12),
          Expanded(child: _statRing(ar ? 'النقاط' : 'Score', math.min(1, p.totalScore / 500), EduTheme.amberGradient, '${p.totalScore}')),
        ],
      );

  Widget _statRing(String label, double value, Gradient g, String mid) => GlassCard(
        padding: const EdgeInsets.all(12),
        child: Column(
          children: [
            SizedBox(
              width: 70, height: 70,
              child: CustomPaint(
                painter: _RingPainter(value: value.clamp(0, 1).toDouble(), gradient: g),
                child: Center(
                  child: Text(mid, style: const TextStyle(color: EduTheme.textPrimary, fontSize: 13, fontWeight: FontWeight.w800)),
                ),
              ),
            ),
            const SizedBox(height: 6),
            Text(label, style: const TextStyle(color: EduTheme.textMuted, fontSize: 11, fontWeight: FontWeight.w700)),
          ],
        ),
      );

  Widget _conceptRow(ConceptMasteryEntry c, int idx, bool ar) => GlassCard(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            Container(
              width: 36, height: 36,
              decoration: BoxDecoration(
                gradient: c.mastered ? EduTheme.successGradient : EduTheme.amberGradient,
                shape: BoxShape.circle,
              ),
              alignment: Alignment.center,
              child: Icon(c.mastered ? Icons.check_rounded : Icons.trending_up_rounded, color: Colors.white, size: 20),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(c.conceptLabel, style: const TextStyle(color: EduTheme.textPrimary, fontSize: 14, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 4),
                  Text('${c.correct} / ${c.attempts} ${ar ? "صحيح" : "correct"}',
                      style: const TextStyle(color: EduTheme.textMuted, fontSize: 12)),
                ],
              ),
            ),
          ],
        ),
      ).animate(delay: (idx * 60).ms).fadeIn(duration: 280.ms).slideX(begin: 0.03, end: 0);

  Widget _chipWrap(List<String> items, Gradient g) => Wrap(
        spacing: 8,
        runSpacing: 8,
        children: items
            .map((s) => Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  decoration: BoxDecoration(gradient: g, borderRadius: BorderRadius.circular(99)),
                  child: Text(s, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 12)),
                ))
            .toList(),
      );

  Widget _nextTopicTile(String topic, int idx) => GlassCard(
        padding: const EdgeInsets.all(14),
        onTap: () => Navigator.of(context).popUntil((r) => r.isFirst),
        child: Row(
          children: [
            const Icon(Icons.bolt_rounded, color: EduTheme.accentTeal, size: 22),
            const SizedBox(width: 10),
            Expanded(child: Text(topic, style: const TextStyle(color: EduTheme.textPrimary, fontSize: 14, fontWeight: FontWeight.w700))),
            const Icon(Icons.arrow_forward_ios_rounded, size: 14, color: EduTheme.textMuted),
          ],
        ),
      ).animate(delay: (idx * 60).ms).fadeIn(duration: 260.ms);
}

class _RingPainter extends CustomPainter {
  final double value;
  final Gradient gradient;
  _RingPainter({required this.value, required this.gradient});
  @override
  void paint(Canvas canvas, Size size) {
    final r = size.shortestSide / 2 - 4;
    final c = Offset(size.width / 2, size.height / 2);
    final rect = Rect.fromCircle(center: c, radius: r);
    final bg = Paint()
      ..color = Colors.white12
      ..style = PaintingStyle.stroke
      ..strokeWidth = 8;
    canvas.drawCircle(c, r, bg);
    final fg = Paint()
      ..shader = gradient.createShader(rect)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 8
      ..strokeCap = StrokeCap.round;
    canvas.drawArc(rect, -math.pi / 2, 2 * math.pi * value, false, fg);
  }
  @override
  bool shouldRepaint(_RingPainter old) => old.value != value;
}
