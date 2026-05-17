import 'package:flutter/material.dart';
import 'features/game_studio/game_studio.dart';

void main() {
  runApp(const EduMindApp());
}

class EduMindApp extends StatelessWidget {
  const EduMindApp({super.key});

  @override
  Widget build(BuildContext context) {
    // Backend URL — override at run time with --dart-define=BACKEND_URL=...
    const backend = String.fromEnvironment('BACKEND_URL', defaultValue: 'http://localhost:8080');
    final api = GameStudioApi(
      baseUrl: backend,
      studentIdProvider: () => 'demo-student',
    );
    final db = GameDatabase();
    return MaterialApp(
      title: 'EduMind Game Studio',
      debugShowCheckedModeBanner: false,
      theme: EduTheme.themeData(arabic: false),
      darkTheme: EduTheme.themeData(arabic: false),
      themeMode: ThemeMode.dark,
      home: DashboardScreen(api: api, db: db),
    );
  }
}
