// Lightweight DTOs that match the backend Zod schemas. Only the fields Flutter needs.

class GameSummary {
  final String id;
  final String topic;
  final String subject;
  final String language;
  final String templateId;
  final DateTime createdAt;

  GameSummary({
    required this.id,
    required this.topic,
    required this.subject,
    required this.language,
    required this.templateId,
    required this.createdAt,
  });

  factory GameSummary.fromJson(Map<String, dynamic> j) => GameSummary(
        id: j['id'] as String,
        topic: j['topic'] as String,
        subject: j['subject'] as String,
        language: j['language'] as String,
        templateId: j['templateId'] as String,
        createdAt: DateTime.parse(j['createdAt'] as String),
      );
}

class GeneratedGame {
  final String gameId;
  final String orientation; // portrait | landscape
  final String language; // en | ar
  final String html;

  GeneratedGame({
    required this.gameId,
    required this.orientation,
    required this.language,
    required this.html,
  });

  factory GeneratedGame.fromJson(Map<String, dynamic> j) => GeneratedGame(
        gameId: j['gameId'] as String,
        orientation: j['orientation'] as String,
        language: j['language'] as String,
        html: j['html'] as String,
      );
}
