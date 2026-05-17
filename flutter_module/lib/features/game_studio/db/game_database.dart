// In-memory stub of the Drift offline library. Used for the web demo, where SQLite isn't
// available without drift_flutter (which requires a newer Dart SDK than the local install).
// Native builds can swap this back to drift — interface stays the same.

class StoredGame {
  final String id;
  final String spec;
  final String html;
  final String language;
  final String topic;
  final String subject;
  final String templateId;
  final int bestScore;
  final DateTime? lastPlayedAt;
  final DateTime createdAt;

  StoredGame({
    required this.id,
    required this.spec,
    required this.html,
    required this.language,
    required this.topic,
    required this.subject,
    required this.templateId,
    this.bestScore = 0,
    this.lastPlayedAt,
    DateTime? createdAt,
  }) : createdAt = createdAt ?? DateTime.now();
}

class StoredGamesCompanion {
  // No-op placeholder so existing call sites don't break.
  const StoredGamesCompanion();
}

class GameDatabase {
  final List<StoredGame> _games = [];

  Future<List<StoredGame>> listGames() async => List.unmodifiable(_games);

  Future<StoredGame?> findById(String id) async {
    for (final g in _games) {
      if (g.id == id) return g;
    }
    return null;
  }

  Future<void> upsertGame(StoredGame entry) async {
    _games.removeWhere((g) => g.id == entry.id);
    _games.insert(0, entry);
  }

  Future<void> recordPlay(String id, int score) async {
    final i = _games.indexWhere((g) => g.id == id);
    if (i < 0) return;
    final old = _games[i];
    _games[i] = StoredGame(
      id: old.id,
      spec: old.spec,
      html: old.html,
      language: old.language,
      topic: old.topic,
      subject: old.subject,
      templateId: old.templateId,
      bestScore: score > old.bestScore ? score : old.bestScore,
      lastPlayedAt: DateTime.now(),
      createdAt: old.createdAt,
    );
  }
}
