class ConceptMasteryEntry {
  final String conceptId;
  final String conceptLabel;
  final int attempts;
  final int correct;
  final bool mastered;

  ConceptMasteryEntry({
    required this.conceptId,
    required this.conceptLabel,
    required this.attempts,
    required this.correct,
    required this.mastered,
  });

  factory ConceptMasteryEntry.fromJson(Map<String, dynamic> j) => ConceptMasteryEntry(
        conceptId: j['conceptId'] as String,
        conceptLabel: j['conceptLabel'] as String,
        attempts: j['attempts'] as int,
        correct: j['correct'] as int,
        mastered: j['mastered'] as bool,
      );
}

class SummaryPayload {
  final String topic;
  final String subject;
  final int durationSeconds;
  final int levelsPlayed;
  final int highestLevelReached;
  final bool masteryAchieved;
  final int totalScore;
  final double overallAccuracy;
  final int averageResponseTimeMs;
  final List<ConceptMasteryEntry> conceptMastery;
  final List<String> strengths;
  final List<String> growthAreas;
  final List<String> recommendedNextTopics;

  SummaryPayload({
    required this.topic,
    required this.subject,
    required this.durationSeconds,
    required this.levelsPlayed,
    required this.highestLevelReached,
    required this.masteryAchieved,
    required this.totalScore,
    required this.overallAccuracy,
    required this.averageResponseTimeMs,
    required this.conceptMastery,
    required this.strengths,
    required this.growthAreas,
    required this.recommendedNextTopics,
  });

  factory SummaryPayload.fromJson(Map<String, dynamic> j) => SummaryPayload(
        topic: j['topic'] as String,
        subject: j['subject'] as String,
        durationSeconds: j['durationSeconds'] as int,
        levelsPlayed: j['levelsPlayed'] as int,
        highestLevelReached: j['highestLevelReached'] as int,
        masteryAchieved: j['masteryAchieved'] as bool,
        totalScore: j['totalScore'] as int,
        overallAccuracy: (j['overallAccuracy'] as num).toDouble(),
        averageResponseTimeMs: j['averageResponseTimeMs'] as int,
        conceptMastery: (j['conceptMastery'] as List<dynamic>)
            .map((e) => ConceptMasteryEntry.fromJson(e as Map<String, dynamic>))
            .toList(),
        strengths: (j['strengths'] as List<dynamic>).cast<String>(),
        growthAreas: (j['growthAreas'] as List<dynamic>).cast<String>(),
        recommendedNextTopics:
            (j['recommendedNextTopics'] as List<dynamic>).cast<String>(),
      );
}

class SummaryEnrichment {
  final List<String> recommendedNextTopics;
  final List<String> strengths;
  final List<String> growthAreas;

  SummaryEnrichment({
    required this.recommendedNextTopics,
    required this.strengths,
    required this.growthAreas,
  });

  factory SummaryEnrichment.fromJson(Map<String, dynamic> j) => SummaryEnrichment(
        recommendedNextTopics:
            (j['recommendedNextTopics'] as List<dynamic>).cast<String>(),
        strengths: (j['strengths'] as List<dynamic>).cast<String>(),
        growthAreas: (j['growthAreas'] as List<dynamic>).cast<String>(),
      );
}
