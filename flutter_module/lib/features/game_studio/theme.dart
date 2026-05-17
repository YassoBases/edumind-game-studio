import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// EduMind Game Studio design system.
/// Dark navy/indigo base, electric coral accent, glassmorphism, gradient meshes.
/// Plus Jakarta Sans for display / body in English, Tajawal for Arabic display.
class EduTheme {
  // Base colors
  static const Color base = Color(0xFF0B1026);
  static const Color surface = Color(0xFF131A36);
  static const Color surfaceElevated = Color(0xFF1A2347);
  static const Color border = Color(0x33FFFFFF);
  static const Color borderStrong = Color(0x55FFFFFF);

  // Accent palette
  static const Color accentCoral = Color(0xFFFF4D6D);
  static const Color accentTeal = Color(0xFF5EEAD4);
  static const Color accentAmber = Color(0xFFFBBF24);
  static const Color accentViolet = Color(0xFFA78BFA);
  static const Color success = Color(0xFF34D399);
  static const Color warning = Color(0xFFFBBF24);
  static const Color danger = Color(0xFFF87171);

  // Text
  static const Color textPrimary = Color(0xFFFAFBFF);
  static const Color textSecondary = Color(0xFFB4BCD8);
  static const Color textMuted = Color(0xFF7280A5);

  // Gradient pairs used in cards / meshes
  static const LinearGradient heroGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFFFF4D6D), Color(0xFFA78BFA)],
  );
  static const LinearGradient successGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF34D399), Color(0xFF5EEAD4)],
  );
  static const LinearGradient violetGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF6366F1), Color(0xFFA78BFA)],
  );
  static const LinearGradient amberGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFFFBBF24), Color(0xFFFF4D6D)],
  );

  static TextTheme textTheme({required bool arabic}) {
    final display = arabic ? GoogleFonts.tajawalTextTheme() : GoogleFonts.plusJakartaSansTextTheme();
    return display.apply(bodyColor: textPrimary, displayColor: textPrimary);
  }

  static ThemeData themeData({required bool arabic}) {
    final tt = textTheme(arabic: arabic);
    return ThemeData(
      brightness: Brightness.dark,
      scaffoldBackgroundColor: base,
      colorScheme: const ColorScheme.dark(
        primary: accentCoral,
        secondary: accentTeal,
        surface: surface,
        error: danger,
      ),
      textTheme: tt,
      appBarTheme: AppBarTheme(
        backgroundColor: Colors.transparent,
        scrolledUnderElevation: 0,
        elevation: 0,
        titleTextStyle: tt.titleLarge?.copyWith(fontWeight: FontWeight.w700),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: accentCoral,
          foregroundColor: Colors.white,
          minimumSize: const Size(0, 56),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
          textStyle: tt.titleMedium?.copyWith(fontWeight: FontWeight.w700),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: surfaceElevated,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(18),
          borderSide: const BorderSide(color: border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(18),
          borderSide: const BorderSide(color: accentCoral, width: 2),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
        hintStyle: tt.bodyMedium?.copyWith(color: textMuted),
      ),
    );
  }
}

/// Spring-like curve used for card lifts and button presses.
class EduCurves {
  static const Curve spring = Cubic(0.32, 1.56, 0.64, 1.0);
  static const Curve emphasized = Cubic(0.20, 0.0, 0.0, 1.0);
}
