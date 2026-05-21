// EduMind brand foundation (v3 — Duolingo-style language).
// Bright candy palette, rounded everything, soft-but-confident motion.
// Nunito (EN) + Tajawal (AR) via google_fonts. ExtraBold for display, SemiBold for body.
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Brand palette — used by every screen, widget, and game UI overlay.
class EduPalette {
  static const Color primaryGreen = Color(0xFF58CC02);     // success / primary CTAs
  static const Color actionBlue = Color(0xFF1CB0F6);       // secondary actions, info
  static const Color streakYellow = Color(0xFFFFC800);     // XP / streak / achievements
  static const Color heartRed = Color(0xFFFF4B4B);         // lives / errors (soft)
  static const Color purple = Color(0xFFCE82FF);           // special, premium
  static const Color baseDark = Color(0xFF131F24);         // text, dark surfaces
  static const Color softWhite = Color(0xFFF7F7F7);        // light bg
  static const Color midGrey = Color(0xFFAFAFAF);          // disabled / muted

  // Helpful derived shades
  static const Color primaryGreenDark = Color(0xFF46A302);   // shadow under green button
  static const Color actionBlueDark = Color(0xFF188FCB);     // shadow under blue button
  static const Color streakYellowDark = Color(0xFFD1A500);   // shadow under yellow
  static const Color heartRedDark = Color(0xFFD13C3C);
  static const Color purpleDark = Color(0xFFA968D9);
  static const Color cardBg = Color(0xFFFFFFFF);
  static const Color stroke = Color(0xFFE5E5E5);
  static const Color textMuted = Color(0xFF777777);
}

/// Radius constants. No sharp corners anywhere.
class EduRadius {
  static const double card = 24;
  static const double button = 16;
  static const double input = 20;
  static const double pill = 999;
  static const double thumbnail = 18;
  static const double sheet = 28;
}

/// Motion curves — Duolingo motion is springy and confident.
class EduCurves {
  /// Card lift / hero entry — overshoots slightly, lands clean.
  static const Curve spring = Cubic(0.32, 1.56, 0.64, 1.0);
  /// Big celebrations.
  static const Curve bounce = Cubic(0.34, 1.8, 0.58, 1.0);
  /// Subtle hover / fade-in.
  static const Curve soft = Cubic(0.40, 0.0, 0.20, 1.0);
  /// Candy button press — sharp down, soft return.
  static const Curve candyPress = Cubic(0.50, 0.0, 0.50, 1.0);
}

/// Candy button shadow band (the dark slice that makes buttons look pressable).
class EduShadows {
  /// 5-pixel dark band beneath a candy button when at rest.
  static List<BoxShadow> candy(Color shadow) => [
        BoxShadow(
          color: shadow,
          offset: const Offset(0, 5),
          spreadRadius: 0,
          blurRadius: 0,
        ),
      ];

  /// Soft card shadow.
  static const List<BoxShadow> card = [
    BoxShadow(
      color: Color(0x14000000),
      offset: Offset(0, 4),
      blurRadius: 16,
    ),
  ];

  /// Floating popover / mascot speech bubble.
  static const List<BoxShadow> floating = [
    BoxShadow(
      color: Color(0x22000000),
      offset: Offset(0, 8),
      blurRadius: 24,
    ),
  ];
}

class EduTheme {
  static const Color base = EduPalette.softWhite;
  static const Color baseDark = EduPalette.baseDark;
  static const Color surface = EduPalette.cardBg;
  static const Color textPrimary = EduPalette.baseDark;
  static const Color textSecondary = Color(0xFF4A5A60);
  static const Color textMuted = EduPalette.textMuted;

  /// Builds a TextTheme using Nunito for English and Tajawal for Arabic.
  /// Nunito ExtraBold for display, SemiBold for body. Letter spacing -0.5 on display.
  static TextTheme textTheme({required bool arabic}) {
    final TextStyle base;
    final TextStyle display;
    if (arabic) {
      base = GoogleFonts.tajawal(fontWeight: FontWeight.w600, color: textPrimary, height: 1.3);
      display = GoogleFonts.tajawal(fontWeight: FontWeight.w800, color: textPrimary, letterSpacing: 0, height: 1.1);
    } else {
      base = GoogleFonts.nunito(fontWeight: FontWeight.w600, color: textPrimary, height: 1.3);
      display = GoogleFonts.nunito(fontWeight: FontWeight.w800, color: textPrimary, letterSpacing: -0.5, height: 1.1);
    }
    return TextTheme(
      displayLarge: display.copyWith(fontSize: 44),
      displayMedium: display.copyWith(fontSize: 36),
      displaySmall: display.copyWith(fontSize: 30),
      headlineLarge: display.copyWith(fontSize: 26),
      headlineMedium: display.copyWith(fontSize: 22),
      headlineSmall: display.copyWith(fontSize: 18),
      titleLarge: display.copyWith(fontSize: 20),
      titleMedium: display.copyWith(fontSize: 16),
      titleSmall: display.copyWith(fontSize: 14),
      bodyLarge: base.copyWith(fontSize: 17),
      bodyMedium: base.copyWith(fontSize: 15),
      bodySmall: base.copyWith(fontSize: 13, color: textMuted),
      labelLarge: display.copyWith(fontSize: 15, letterSpacing: 0.2),
      labelMedium: display.copyWith(fontSize: 13, letterSpacing: 0.2),
      labelSmall: display.copyWith(fontSize: 11, letterSpacing: 0.4, color: textMuted),
    );
  }

  /// Light theme — Duolingo's default surface treatment is light, not dark.
  static ThemeData light({required bool arabic}) {
    final tt = textTheme(arabic: arabic);
    return ThemeData(
      brightness: Brightness.light,
      scaffoldBackgroundColor: base,
      colorScheme: const ColorScheme.light(
        primary: EduPalette.primaryGreen,
        secondary: EduPalette.actionBlue,
        surface: EduPalette.cardBg,
        error: EduPalette.heartRed,
      ),
      textTheme: tt,
      appBarTheme: AppBarTheme(
        backgroundColor: base,
        scrolledUnderElevation: 0,
        elevation: 0,
        iconTheme: const IconThemeData(color: EduPalette.baseDark, size: 28),
        titleTextStyle: tt.titleLarge,
      ),
      cardTheme: CardTheme(
        color: EduPalette.cardBg,
        elevation: 0,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(EduRadius.card)),
        margin: EdgeInsets.zero,
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: EduPalette.cardBg,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(EduRadius.input),
          borderSide: const BorderSide(color: EduPalette.stroke, width: 2),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(EduRadius.input),
          borderSide: const BorderSide(color: EduPalette.stroke, width: 2),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(EduRadius.input),
          borderSide: const BorderSide(color: EduPalette.actionBlue, width: 2),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
        hintStyle: tt.bodyMedium?.copyWith(color: EduPalette.midGrey),
      ),
    );
  }

  /// Kept for compatibility with the v2 dark-mode dashboard. New screens use light().
  static ThemeData themeData({required bool arabic}) => light(arabic: arabic);

  // ===== v2 palette aliases (kept as constants so legacy widgets still compile) =====
  // These reference the new brand colors but preserve the names v2 widgets imported.
  static const Color accentCoral = EduPalette.heartRed;
  static const Color accentTeal = EduPalette.actionBlue;
  static const Color accentAmber = EduPalette.streakYellow;
  static const Color accentViolet = EduPalette.purple;
  static const Color success = EduPalette.primaryGreen;
  static const Color warning = EduPalette.streakYellow;
  static const Color danger = EduPalette.heartRed;
  static const Color surfaceElevated = EduPalette.cardBg;
  static const Color border = EduPalette.stroke;
  static const Color borderStrong = Color(0x33000000);

  static const LinearGradient heroGradient = LinearGradient(
    begin: Alignment.topLeft, end: Alignment.bottomRight,
    colors: [EduPalette.primaryGreen, EduPalette.actionBlue],
  );
  static const LinearGradient successGradient = LinearGradient(
    begin: Alignment.topLeft, end: Alignment.bottomRight,
    colors: [EduPalette.primaryGreen, Color(0xFF89D63E)],
  );
  static const LinearGradient violetGradient = LinearGradient(
    begin: Alignment.topLeft, end: Alignment.bottomRight,
    colors: [EduPalette.purple, EduPalette.actionBlue],
  );
  static const LinearGradient amberGradient = LinearGradient(
    begin: Alignment.topLeft, end: Alignment.bottomRight,
    colors: [EduPalette.streakYellow, EduPalette.heartRed],
  );
}
