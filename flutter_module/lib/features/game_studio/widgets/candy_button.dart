// Candy button — the signature Duolingo-style button. Solid colour top, ~5px darker
// shadow band underneath, presses DOWN on tap (shadow disappears) and bounces back on
// release. Replace every primary CTA in the app with this primitive.
import 'package:flutter/material.dart';
import '../theme.dart';

enum CandyVariant { green, blue, yellow, red, purple, outline }
enum CandySize { small, medium, large }

class CandyButton extends StatefulWidget {
  final String label;
  final VoidCallback? onPressed;
  final CandyVariant variant;
  final CandySize size;
  final IconData? icon;
  final Widget? leading;
  final bool stretch; // full-width inside its parent

  const CandyButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.variant = CandyVariant.green,
    this.size = CandySize.medium,
    this.icon,
    this.leading,
    this.stretch = false,
  });

  bool get _enabled => onPressed != null;

  @override
  State<CandyButton> createState() => _CandyButtonState();
}

class _CandyButtonState extends State<CandyButton> with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 90),
    );
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  Color _topColor() {
    if (!widget._enabled) return EduPalette.midGrey;
    switch (widget.variant) {
      case CandyVariant.green: return EduPalette.primaryGreen;
      case CandyVariant.blue: return EduPalette.actionBlue;
      case CandyVariant.yellow: return EduPalette.streakYellow;
      case CandyVariant.red: return EduPalette.heartRed;
      case CandyVariant.purple: return EduPalette.purple;
      case CandyVariant.outline: return Colors.transparent;
    }
  }

  Color _shadowColor() {
    if (!widget._enabled) return const Color(0xFF8E8E8E);
    switch (widget.variant) {
      case CandyVariant.green: return EduPalette.primaryGreenDark;
      case CandyVariant.blue: return EduPalette.actionBlueDark;
      case CandyVariant.yellow: return EduPalette.streakYellowDark;
      case CandyVariant.red: return EduPalette.heartRedDark;
      case CandyVariant.purple: return EduPalette.purpleDark;
      case CandyVariant.outline: return EduPalette.stroke;
    }
  }

  Color _labelColor() {
    if (widget.variant == CandyVariant.outline) {
      return widget._enabled ? EduPalette.baseDark : EduPalette.midGrey;
    }
    if (widget.variant == CandyVariant.yellow) return EduPalette.baseDark;
    return Colors.white;
  }

  double _height() {
    switch (widget.size) {
      case CandySize.small: return 44;
      case CandySize.medium: return 56;
      case CandySize.large: return 68;
    }
  }

  double _fontSize() {
    switch (widget.size) {
      case CandySize.small: return 14;
      case CandySize.medium: return 16;
      case CandySize.large: return 18;
    }
  }

  EdgeInsets _padding() {
    switch (widget.size) {
      case CandySize.small: return const EdgeInsets.symmetric(horizontal: 16);
      case CandySize.medium: return const EdgeInsets.symmetric(horizontal: 24);
      case CandySize.large: return const EdgeInsets.symmetric(horizontal: 32);
    }
  }

  static const double _shadowBand = 5;

  @override
  Widget build(BuildContext context) {
    final top = _topColor();
    final shadow = _shadowColor();
    final label = _labelColor();
    final height = _height();
    final radius = BorderRadius.circular(EduRadius.button);

    final isOutline = widget.variant == CandyVariant.outline;

    final content = Row(
      mainAxisSize: widget.stretch ? MainAxisSize.max : MainAxisSize.min,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        if (widget.leading != null) ...[
          widget.leading!,
          const SizedBox(width: 8),
        ],
        if (widget.icon != null) ...[
          Icon(widget.icon, color: label, size: _fontSize() + 4),
          const SizedBox(width: 8),
        ],
        Flexible(
          child: Text(
            widget.label,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              color: label,
              fontFamily: 'Nunito',
              fontWeight: FontWeight.w800,
              fontSize: _fontSize(),
              letterSpacing: 0.5,
            ),
          ),
        ),
      ],
    );

    final button = AnimatedBuilder(
      animation: _ctrl,
      builder: (_, __) {
        final pressDepth = _ctrl.value * _shadowBand;
        return SizedBox(
          height: height + _shadowBand,
          width: widget.stretch ? double.infinity : null,
          child: Stack(
            children: [
              // Shadow band — the dark slice that gives the candy look.
              Positioned(
                left: 0, right: 0, top: _shadowBand, bottom: 0,
                child: Container(
                  decoration: BoxDecoration(
                    color: shadow,
                    borderRadius: radius,
                  ),
                ),
              ),
              // Top surface — shifts down by `pressDepth` while pressed.
              Positioned(
                left: 0, right: 0, top: pressDepth, height: height,
                child: Container(
                  padding: _padding(),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: isOutline ? EduPalette.cardBg : top,
                    borderRadius: radius,
                    border: isOutline
                        ? Border.all(color: EduPalette.stroke, width: 2)
                        : null,
                  ),
                  child: content,
                ),
              ),
            ],
          ),
        );
      },
    );

    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown: widget._enabled ? (_) => _ctrl.forward() : null,
      onTapCancel: widget._enabled ? () => _ctrl.reverse() : null,
      onTapUp: widget._enabled ? (_) {
        _ctrl.reverse();
        widget.onPressed?.call();
      } : null,
      child: Opacity(opacity: widget._enabled ? 1.0 : 0.7, child: button),
    );
  }
}
