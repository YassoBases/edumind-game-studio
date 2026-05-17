import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../api/client.dart';
import '../theme.dart';
import '../widgets/glass_card.dart';
import 'game_player_screen.dart';

class ComposerScreen extends StatefulWidget {
  final GameStudioApi api;
  final bool arabic;
  final String? prefilledPrompt;
  const ComposerScreen({super.key, required this.api, this.arabic = false, this.prefilledPrompt});

  @override
  State<ComposerScreen> createState() => _ComposerScreenState();
}

enum _Step { prompt, preferences, generating }

class _ComposerScreenState extends State<ComposerScreen> {
  _Step _step = _Step.prompt;
  final _promptCtrl = TextEditingController();
  String? _difficulty;
  String? _sessionLength;
  int? _grade;
  String? _focusArea;
  String? _error;
  Timer? _placeholderTimer;
  int _placeholderIdx = 0;

  // Streaming state
  StreamSubscription<ComposeStreamEvent>? _sub;
  final List<StageProgressEvent> _stageLog = [];
  int _runningCostMicroUsd = 0;
  String _currentLabel = '';
  double _progressFraction = 0;
  String? _clarifyingQuestion;
  Map<String, dynamic>? _normalized;

  static const _stageOrder = [
    'normalize', 'moderation_pre', 'spec', 'sprites', 'code', 'validators',
    'repair', 'playability', 'moderation_post', 'done',
  ];

  static const _placeholdersEn = [
    'A car racing game that teaches photosynthesis',
    'Football and the French Revolution',
    'A castle build for fractions',
    'A fantasy quest about linear equations',
    'A detective story about the water cycle',
  ];
  static const _placeholdersAr = [
    'سباق سيارات لتعلم التمثيل الضوئي',
    'كرة قدم والثورة الفرنسية',
    'بناء قلعة لتعلم الكسور',
    'مهمة خيالية عن المعادلات',
    'قصة محقق عن دورة الماء',
  ];

  @override
  void initState() {
    super.initState();
    if (widget.prefilledPrompt != null) _promptCtrl.text = widget.prefilledPrompt!;
    _placeholderTimer = Timer.periodic(const Duration(seconds: 3), (_) {
      if (mounted && _promptCtrl.text.isEmpty) setState(() => _placeholderIdx++);
    });
  }

  @override
  void dispose() {
    _placeholderTimer?.cancel();
    _sub?.cancel();
    _promptCtrl.dispose();
    super.dispose();
  }

  String _placeholder() {
    final list = widget.arabic ? _placeholdersAr : _placeholdersEn;
    return list[_placeholderIdx % list.length];
  }

  void _advance() {
    if (_step == _Step.prompt) {
      if (_promptCtrl.text.trim().isEmpty) {
        setState(() => _error = widget.arabic ? 'اكتب فكرتك أولًا' : 'Type your idea first');
        return;
      }
      setState(() {
        _step = _Step.preferences;
        _error = null;
      });
    } else if (_step == _Step.preferences) {
      _startGeneration();
    }
  }

  void _startGeneration() {
    setState(() {
      _step = _Step.generating;
      _stageLog.clear();
      _runningCostMicroUsd = 0;
      _currentLabel = widget.arabic ? 'بدء...' : 'Starting...';
      _progressFraction = 0;
      _clarifyingQuestion = null;
    });
    final prefs = <String, dynamic>{};
    if (_difficulty != null) prefs['difficulty'] = _difficulty;
    if (_sessionLength != null) prefs['sessionLength'] = _sessionLength;
    if (_grade != null) prefs['grade'] = _grade;
    if (_focusArea != null && _focusArea!.trim().isNotEmpty) prefs['focusArea'] = _focusArea;
    _sub = widget.api
        .composeStream(
          rawPrompt: _promptCtrl.text.trim(),
          language: widget.arabic ? 'ar' : 'en',
          preferences: prefs.isEmpty ? null : prefs,
        )
        .listen(_handleEvent, onError: (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    });
  }

  void _handleEvent(ComposeStreamEvent ev) {
    if (!mounted) return;
    if (ev is StageProgressEvent) {
      setState(() {
        _stageLog.add(ev);
        _runningCostMicroUsd = ev.costMicroUsd;
        _currentLabel = ev.label;
        final idx = _stageOrder.indexOf(ev.stage);
        if (idx >= 0) {
          _progressFraction = ((idx + (ev.status == 'end' ? 1 : 0.5)) / _stageOrder.length).clamp(0.0, 1.0);
        }
      });
    } else if (ev is ComposeClarifyEvent) {
      setState(() {
        _clarifyingQuestion = ev.clarifyingQuestion;
        _normalized = ev.normalized;
        _step = _Step.prompt;
      });
    } else if (ev is ComposeDoneEvent) {
      setState(() {
        _runningCostMicroUsd = ev.totalCostMicroUsd;
        _progressFraction = 1;
      });
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => GamePlayerScreen(api: widget.api, game: ev.game)),
      );
    } else if (ev is ComposeErrorEvent) {
      setState(() {
        _error = ev.message;
        _step = _Step.preferences;
      });
    }
  }

  String _costDisplay() {
    final c = _runningCostMicroUsd;
    if (c < 10000) return '${(c / 1000).toStringAsFixed(2)} m¢';
    final dollars = c / 1000000;
    return '\$${dollars.toStringAsFixed(4)}';
  }

  @override
  Widget build(BuildContext context) {
    final ar = widget.arabic;
    return Directionality(
      textDirection: ar ? TextDirection.rtl : TextDirection.ltr,
      child: Theme(
        data: EduTheme.themeData(arabic: ar),
        child: Scaffold(
          appBar: AppBar(
            leading: IconButton(
              icon: const Icon(Icons.close_rounded, color: EduTheme.textPrimary),
              onPressed: () => _step == _Step.prompt
                  ? Navigator.of(context).pop()
                  : setState(() => _step = _Step.values[_step.index - 1]),
            ),
            title: Text(ar ? 'اصنع لعبة' : 'New game'),
          ),
          body: Stack(
            children: [
              const Positioned.fill(child: GradientMesh(opacity: 0.4)),
              SafeArea(
                child: switch (_step) {
                  _Step.prompt => _buildPromptStep(ar),
                  _Step.preferences => _buildPreferencesStep(ar),
                  _Step.generating => _buildGeneratingStep(ar),
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildPromptStep(bool ar) => ListView(
        padding: const EdgeInsets.fromLTRB(20, 24, 20, 40),
        children: [
          _stepIndicator(0, ar),
          const SizedBox(height: 24),
          Text(
            ar ? 'اكتب ما تريد لعبه وتعلّمه' : 'Tell me what to play and learn',
            style: const TextStyle(color: EduTheme.textPrimary, fontSize: 26, fontWeight: FontWeight.w800, height: 1.2),
          ).animate().fadeIn().slideY(begin: -0.04),
          const SizedBox(height: 6),
          Text(ar ? 'بأي صياغة. سأفهم.' : 'Any wording. I\'ll figure it out.',
              style: const TextStyle(color: EduTheme.textMuted, fontSize: 14)),
          const SizedBox(height: 28),
          GlassCard(
            gradientBorder: EduTheme.heroGradient,
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 8),
            child: TextField(
              controller: _promptCtrl,
              maxLength: 200,
              maxLines: 3,
              minLines: 1,
              autofocus: true,
              style: const TextStyle(color: EduTheme.textPrimary, fontSize: 18, fontWeight: FontWeight.w600),
              decoration: InputDecoration(
                hintText: _placeholder(),
                hintStyle: const TextStyle(color: EduTheme.textMuted, fontSize: 16),
                border: InputBorder.none,
                filled: false,
                counterText: '',
              ),
              onChanged: (_) => setState(() {}),
            ),
          ),
          const SizedBox(height: 16),
          if (_clarifyingQuestion != null)
            GlassCard(
              backgroundGradient: EduTheme.violetGradient,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(ar ? 'أحتاج توضيح' : 'I need clarification',
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800)),
                  const SizedBox(height: 4),
                  Text(_clarifyingQuestion!, style: const TextStyle(color: Colors.white)),
                ],
              ),
            ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(_error!, style: const TextStyle(color: EduTheme.danger)),
            ),
          const SizedBox(height: 28),
          FilledButton(
            onPressed: _promptCtrl.text.trim().isEmpty ? null : _advance,
            child: Text(ar ? 'التالي' : 'Next'),
          ),
          const SizedBox(height: 20),
          Text(ar ? 'أمثلة سريعة' : 'Quick ideas',
              style: const TextStyle(color: EduTheme.textMuted, fontSize: 13, fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8, runSpacing: 8,
            children: (ar ? _placeholdersAr : _placeholdersEn)
                .take(4)
                .map((s) => _chip(s, () { _promptCtrl.text = s; setState(() {}); }))
                .toList(),
          ),
        ],
      );

  Widget _buildPreferencesStep(bool ar) => ListView(
        padding: const EdgeInsets.fromLTRB(20, 24, 20, 40),
        children: [
          _stepIndicator(1, ar),
          const SizedBox(height: 24),
          Text(ar ? 'كم تريدها أن تكون صعبة؟' : 'How hard do you want it?',
              style: const TextStyle(color: EduTheme.textPrimary, fontSize: 22, fontWeight: FontWeight.w800)),
          const SizedBox(height: 12),
          _radioGrid(
            options: ar
                ? const {'easy': 'سهل', 'medium': 'متوسط', 'hard': 'صعب', 'challenge': 'تحدي'}
                : const {'easy': 'Easy', 'medium': 'Medium', 'hard': 'Hard', 'challenge': 'Challenge me'},
            value: _difficulty,
            onChanged: (v) => setState(() => _difficulty = v),
          ),
          const SizedBox(height: 28),
          Text(ar ? 'كم من الوقت لديك؟' : 'How long do you have?',
              style: const TextStyle(color: EduTheme.textPrimary, fontSize: 22, fontWeight: FontWeight.w800)),
          const SizedBox(height: 12),
          _radioGrid(
            options: ar
                ? const {'quick': 'سريع 5 د', 'standard': 'عادي 15 د', 'long': 'طويل 30 د'}
                : const {'quick': 'Quick 5m', 'standard': 'Standard 15m', 'long': 'Long 30m'},
            value: _sessionLength,
            onChanged: (v) => setState(() => _sessionLength = v),
          ),
          const SizedBox(height: 28),
          Text(ar ? 'الصف الدراسي' : 'Grade',
              style: const TextStyle(color: EduTheme.textPrimary, fontSize: 22, fontWeight: FontWeight.w800)),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8, runSpacing: 8,
            children: [7, 8, 9, 10, 11, 12].map((g) {
              final selected = _grade == g;
              return InkWell(
                borderRadius: BorderRadius.circular(99),
                onTap: () => setState(() => _grade = selected ? null : g),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
                  decoration: BoxDecoration(
                    gradient: selected ? EduTheme.heroGradient : null,
                    color: selected ? null : EduTheme.surfaceElevated,
                    borderRadius: BorderRadius.circular(99),
                    border: Border.all(color: selected ? Colors.transparent : EduTheme.border),
                  ),
                  child: Text('$g', style: TextStyle(color: selected ? Colors.white : EduTheme.textPrimary, fontWeight: FontWeight.w800)),
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: 28),
          Text(ar ? 'شيء محدد تريد التركيز عليه؟ (اختياري)' : 'Anything specific to focus on? (optional)',
              style: const TextStyle(color: EduTheme.textPrimary, fontSize: 18, fontWeight: FontWeight.w800)),
          const SizedBox(height: 10),
          GlassCard(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            child: TextField(
              maxLength: 80,
              style: const TextStyle(color: EduTheme.textPrimary),
              decoration: InputDecoration(
                hintText: ar ? 'مثال: التركيز على المرحلة الضوئية' : 'e.g. focus on the light reactions',
                hintStyle: const TextStyle(color: EduTheme.textMuted, fontSize: 14),
                border: InputBorder.none,
                filled: false,
                counterText: '',
              ),
              onChanged: (v) => _focusArea = v,
            ),
          ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(top: 12),
              child: Text(_error!, style: const TextStyle(color: EduTheme.danger)),
            ),
          const SizedBox(height: 28),
          FilledButton(
            onPressed: _advance,
            child: Text(ar ? 'أنشئ اللعبة' : 'Generate game'),
          ),
        ],
      );

  Widget _buildGeneratingStep(bool ar) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 40),
      children: [
        _stepIndicator(2, ar),
        const SizedBox(height: 24),
        GlassCard(
          gradientBorder: EduTheme.heroGradient,
          padding: const EdgeInsets.all(22),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 56, height: 56,
                    decoration: const BoxDecoration(gradient: EduTheme.heroGradient, shape: BoxShape.circle),
                    alignment: Alignment.center,
                    child: const Text('🏎️', style: TextStyle(fontSize: 30)),
                  ).animate(onPlay: (c) => c.repeat()).rotate(duration: 3.seconds, curve: Curves.linear),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(_currentLabel, style: const TextStyle(color: EduTheme.textPrimary, fontSize: 18, fontWeight: FontWeight.w800)),
                        const SizedBox(height: 4),
                        Text(ar ? 'لحظات...' : 'Hang tight...',
                            style: const TextStyle(color: EduTheme.textMuted, fontSize: 13)),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 18),
              ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: LinearProgressIndicator(
                  value: _progressFraction,
                  minHeight: 8,
                  backgroundColor: Colors.white12,
                  valueColor: const AlwaysStoppedAnimation(EduTheme.accentCoral),
                ),
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  const Icon(Icons.attach_money_rounded, color: EduTheme.accentTeal, size: 18),
                  Text(_costDisplay(),
                      style: const TextStyle(color: EduTheme.accentTeal, fontWeight: FontWeight.w800, fontSize: 15)),
                  const SizedBox(width: 12),
                  Text('${(_progressFraction * 100).round()}%',
                      style: const TextStyle(color: EduTheme.textMuted, fontSize: 13)),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 18),
        ..._stageLog.where((e) => e.status == 'end').toList().reversed.take(8).map(
              (e) => _stageRow(e),
            ),
      ],
    );
  }

  Widget _stageRow(StageProgressEvent ev) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: GlassCard(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          child: Row(
            children: [
              const Icon(Icons.check_circle_rounded, color: EduTheme.success, size: 18),
              const SizedBox(width: 10),
              Expanded(
                child: Text(ev.label, style: const TextStyle(color: EduTheme.textPrimary, fontSize: 13, fontWeight: FontWeight.w700)),
              ),
              if (ev.latencyMs != null)
                Text('${(ev.latencyMs! / 1000).toStringAsFixed(1)}s',
                    style: const TextStyle(color: EduTheme.textMuted, fontSize: 12)),
            ],
          ),
        ),
      );

  Widget _stepIndicator(int active, bool ar) {
    return Row(
      children: List.generate(3, (i) {
        final isActive = i == active;
        return Expanded(
          child: Padding(
            padding: const EdgeInsetsDirectional.only(end: 6),
            child: Container(
              height: 6,
              decoration: BoxDecoration(
                gradient: i <= active ? EduTheme.heroGradient : null,
                color: i <= active ? null : EduTheme.surfaceElevated,
                borderRadius: BorderRadius.circular(3),
              ),
            ).animate(target: isActive ? 1 : 0).scaleY(begin: 1, end: 1.6, duration: 300.ms),
          ),
        );
      }),
    );
  }

  Widget _radioGrid({
    required Map<String, String> options,
    required String? value,
    required ValueChanged<String> onChanged,
  }) {
    return Wrap(
      spacing: 8, runSpacing: 8,
      children: options.entries.map((e) {
        final selected = value == e.key;
        return InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: () => onChanged(e.key),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 220),
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
            decoration: BoxDecoration(
              gradient: selected ? EduTheme.heroGradient : null,
              color: selected ? null : EduTheme.surfaceElevated,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: selected ? Colors.transparent : EduTheme.border),
            ),
            child: Text(e.value, style: TextStyle(color: selected ? Colors.white : EduTheme.textPrimary, fontWeight: FontWeight.w700)),
          ),
        );
      }).toList(),
    );
  }

  Widget _chip(String label, VoidCallback onTap) => InkWell(
        borderRadius: BorderRadius.circular(99),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            color: EduTheme.surfaceElevated,
            borderRadius: BorderRadius.circular(99),
            border: Border.all(color: EduTheme.border),
          ),
          child: Text(label, style: const TextStyle(color: EduTheme.textSecondary, fontSize: 12, fontWeight: FontWeight.w600)),
        ),
      );
}
