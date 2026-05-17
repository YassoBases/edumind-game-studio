import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../api/client.dart';
import '../models/game_spec.dart';
import '../theme.dart';
import 'glass_card.dart';

class RefineModal extends StatefulWidget {
  final GameStudioApi api;
  final String gameId;
  final String language;
  const RefineModal({super.key, required this.api, required this.gameId, required this.language});

  static Future<GeneratedGame?> show(
    BuildContext context, {
    required GameStudioApi api,
    required String gameId,
    required String language,
  }) {
    return showModalBottomSheet<GeneratedGame>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => RefineModal(api: api, gameId: gameId, language: language),
    );
  }

  @override
  State<RefineModal> createState() => _RefineModalState();
}

class _RefineModalState extends State<RefineModal> {
  final _ctrl = TextEditingController();
  bool _loading = false;
  String? _error;

  static const _presetsEn = ['Different theme', 'Different sport', 'Harder', 'Easier', 'More questions'];
  static const _presetsAr = ['غيّر السمة', 'رياضة أخرى', 'أصعب', 'أسهل', 'مزيد من الأسئلة'];

  Future<void> _submit(String instruction) async {
    if (instruction.trim().isEmpty) return;
    setState(() { _loading = true; _error = null; });
    try {
      final game = await widget.api.refine(gameId: widget.gameId, instruction: instruction.trim());
      if (mounted) Navigator.of(context).pop(game);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final ar = widget.language == 'ar';
    final presets = ar ? _presetsAr : _presetsEn;
    return Directionality(
      textDirection: ar ? TextDirection.rtl : TextDirection.ltr,
      child: Padding(
        padding: EdgeInsets.only(
          left: 16, right: 16, top: 16,
          bottom: MediaQuery.of(context).viewInsets.bottom + 16,
        ),
        child: GlassCard(
          gradientBorder: EduTheme.heroGradient,
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(ar ? 'حسّن اللعبة' : 'Refine this game',
                  style: const TextStyle(color: EduTheme.textPrimary, fontSize: 20, fontWeight: FontWeight.w800)),
              const SizedBox(height: 14),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: presets
                    .map((p) => InkWell(
                          borderRadius: BorderRadius.circular(99),
                          onTap: _loading ? null : () => _submit(p),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                            decoration: BoxDecoration(
                              color: EduTheme.surfaceElevated,
                              borderRadius: BorderRadius.circular(99),
                              border: Border.all(color: EduTheme.border),
                            ),
                            child: Text(p, style: const TextStyle(color: EduTheme.textPrimary, fontWeight: FontWeight.w600, fontSize: 13)),
                          ),
                        ))
                    .toList(),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _ctrl,
                maxLines: 3,
                maxLength: 200,
                style: const TextStyle(color: EduTheme.textPrimary),
                decoration: InputDecoration(
                  hintText: ar ? 'أو اكتب طلبًا مخصصًا' : 'Or describe a custom change',
                  counterText: '',
                ),
              ),
              if (_error != null)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(_error!, style: const TextStyle(color: EduTheme.danger)),
                ),
              const SizedBox(height: 14),
              FilledButton(
                onPressed: _loading ? null : () => _submit(_ctrl.text),
                child: _loading
                    ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : Text(ar ? 'حسّن' : 'Refine'),
              ),
            ],
          ),
        ).animate().slideY(begin: 0.1, end: 0, duration: 300.ms, curve: EduCurves.spring),
      ),
    );
  }
}
