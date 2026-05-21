import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/game_spec.dart';
import '../models/summary.dart';
import 'sse_native.dart' if (dart.library.html) 'sse_web.dart' as sse;

class ComposeResult {
  final bool needsClarification;
  final String? clarifyingQuestion;
  final Map<String, dynamic>? normalized;
  final GeneratedGame? game;
  ComposeResult({
    required this.needsClarification,
    required this.clarifyingQuestion,
    required this.normalized,
    required this.game,
  });
}

/// One streamed event from /compose-stream. Either a stage update (progress + running cost),
/// a clarify request (low-confidence normalization), a final `done` payload, or an error.
sealed class ComposeStreamEvent {}
class StageProgressEvent extends ComposeStreamEvent {
  final String stage;
  final String label;
  final String status; // 'start' or 'end'
  final int? latencyMs;
  final int costMicroUsd;
  final Map<String, dynamic>? detail;
  StageProgressEvent({
    required this.stage,
    required this.label,
    required this.status,
    required this.costMicroUsd,
    this.latencyMs,
    this.detail,
  });
}
class ComposeClarifyEvent extends ComposeStreamEvent {
  final String? clarifyingQuestion;
  final String? suggestedArchetype;
  final String? suggestedTheme;
  final Map<String, dynamic>? normalized;
  ComposeClarifyEvent({this.clarifyingQuestion, this.suggestedArchetype, this.suggestedTheme, this.normalized});
}
class ComposeDoneEvent extends ComposeStreamEvent {
  final GeneratedGame game;
  final int totalCostMicroUsd;
  final Map<String, dynamic>? normalized;
  ComposeDoneEvent({required this.game, required this.totalCostMicroUsd, this.normalized});
}
class ComposeErrorEvent extends ComposeStreamEvent {
  final String message;
  ComposeErrorEvent(this.message);
}

class GameStudioApi {
  final String baseUrl;
  final String Function() studentIdProvider;
  final http.Client _client;

  GameStudioApi({
    required this.baseUrl,
    required this.studentIdProvider,
    http.Client? client,
  }) : _client = client ?? http.Client();

  Map<String, String> get _headers => {
        'content-type': 'application/json',
        'x-student-id': studentIdProvider(),
      };

  /// SSE compose stream: yields progress + running cost events, then a terminal done/error/clarify.
  /// Transport is platform-specific (native = package:http chunked; web = browser XHR
  /// onProgress so events arrive as written, not buffered until response close).
  /// Transport-level diagnostics flow through [onLog] for surfacing in the UI.
  Stream<ComposeStreamEvent> composeStream({
    required String rawPrompt,
    required String language,
    Map<String, dynamic>? preferences,
    void Function(String msg)? onLog,
  }) async* {
    final url = '$baseUrl/api/games/compose-stream';
    final body = jsonEncode({
      'rawPrompt': rawPrompt,
      'language': language,
      if (preferences != null) 'preferences': preferences,
    });
    try {
      await for (final frame
          in sse.openSse(url: url, headers: _headers, body: body, onLog: onLog)) {
        final parsed = _parseSseEvent(frame.event, frame.data);
        if (parsed != null) yield parsed;
        if (parsed is ComposeDoneEvent ||
            parsed is ComposeErrorEvent ||
            parsed is ComposeClarifyEvent) {
          return;
        }
      }
    } catch (e) {
      yield ComposeErrorEvent(e.toString());
    }
  }

  ComposeStreamEvent? _parseSseEvent(String event, Map<String, dynamic> data) {
    switch (event) {
      case 'open':
        return null;
      case 'stage':
        return StageProgressEvent(
          stage: data['stage'] as String,
          label: data['label'] as String,
          status: data['status'] as String,
          latencyMs: data['latencyMs'] as int?,
          costMicroUsd: (data['costMicroUsd'] as num).toInt(),
          detail: data['detail'] as Map<String, dynamic>?,
        );
      case 'clarify':
        return ComposeClarifyEvent(
          clarifyingQuestion: data['clarifyingQuestion'] as String?,
          suggestedArchetype: data['suggestedArchetype'] as String?,
          suggestedTheme: data['suggestedTheme'] as String?,
          normalized: data['normalized'] as Map<String, dynamic>?,
        );
      case 'done':
        return ComposeDoneEvent(
          game: GeneratedGame.fromJson(data),
          totalCostMicroUsd: (data['totalCostMicroUsd'] as num).toInt(),
          normalized: data['normalized'] as Map<String, dynamic>?,
        );
      case 'error':
        return ComposeErrorEvent(
          (data['message'] as String?) ?? (data['reason'] as String?) ?? 'unknown',
        );
      default:
        return null;
    }
  }

  Future<ComposeResult> compose({
    required String rawPrompt,
    required String language,
  }) async {
    final res = await _client.post(
      Uri.parse('$baseUrl/api/games/compose'),
      headers: _headers,
      body: jsonEncode({'rawPrompt': rawPrompt, 'language': language}),
    );
    if (res.statusCode >= 400) {
      throw Exception('Compose failed: ${res.statusCode} ${res.body}');
    }
    final j = jsonDecode(res.body) as Map<String, dynamic>;
    if (j['needsClarification'] == true) {
      return ComposeResult(
        needsClarification: true,
        clarifyingQuestion: j['clarifyingQuestion'] as String?,
        normalized: j['normalized'] as Map<String, dynamic>?,
        game: null,
      );
    }
    return ComposeResult(
      needsClarification: false,
      game: GeneratedGame.fromJson(j),
      normalized: j['normalized'] as Map<String, dynamic>?,
      clarifyingQuestion: null,
    );
  }

  Future<GeneratedGame> generate({
    required String language,
    required String subject,
    required String topic,
    required String style,
    String? theme,
    String? extra,
    required String idempotencyKey,
  }) async {
    final res = await _client.post(
      Uri.parse('$baseUrl/api/games/generate'),
      headers: {..._headers, 'idempotency-key': idempotencyKey},
      body: jsonEncode({
        'language': language,
        'subject': subject,
        'topic': topic,
        'style': style,
        if (theme != null) 'theme': theme,
        if (extra != null) 'extra': extra,
      }),
    );
    if (res.statusCode >= 400) {
      throw Exception('Generation failed: ${res.statusCode} ${res.body}');
    }
    return GeneratedGame.fromJson(jsonDecode(res.body) as Map<String, dynamic>);
  }

  Future<GeneratedGame> refine({
    required String gameId,
    required String instruction,
  }) async {
    final res = await _client.post(
      Uri.parse('$baseUrl/api/games/$gameId/refine'),
      headers: _headers,
      body: jsonEncode({'instruction': instruction}),
    );
    if (res.statusCode >= 400) {
      throw Exception('Refine failed: ${res.statusCode} ${res.body}');
    }
    return GeneratedGame.fromJson(jsonDecode(res.body) as Map<String, dynamic>);
  }

  Future<void> reportLevel({
    required String gameId,
    required int level,
    required double score,
    required double accuracy,
    required int durationMs,
  }) async {
    await _client.post(
      Uri.parse('$baseUrl/api/games/$gameId/level'),
      headers: _headers,
      body: jsonEncode({
        'level': level,
        'score': score,
        'accuracy': accuracy,
        'durationMs': durationMs,
      }),
    );
  }

  Future<void> reportComplete({
    required String gameId,
    required Map<String, dynamic> summary,
  }) async {
    await _client.post(
      Uri.parse('$baseUrl/api/games/$gameId/complete'),
      headers: _headers,
      body: jsonEncode(summary),
    );
  }

  Future<(SummaryPayload payload, SummaryEnrichment? enrichment, bool ready)>
      fetchSummary(String gameId) async {
    final res = await _client.get(
      Uri.parse('$baseUrl/api/games/$gameId/summary'),
      headers: _headers,
    );
    if (res.statusCode >= 400) {
      throw Exception('Summary fetch failed: ${res.statusCode}');
    }
    final j = jsonDecode(res.body) as Map<String, dynamic>;
    final payload = SummaryPayload.fromJson(j['payload'] as Map<String, dynamic>);
    final enrJson = j['enrichment'] as Map<String, dynamic>?;
    final ready = j['enrichmentReady'] as bool;
    return (payload, enrJson == null ? null : SummaryEnrichment.fromJson(enrJson), ready);
  }

  /// Fetch a single game (incl. HTML) from the cloud library so it can be replayed.
  Future<GeneratedGame> getGame(String gameId) async {
    final res = await _client.get(
      Uri.parse('$baseUrl/api/games/$gameId'),
      headers: _headers,
    );
    if (res.statusCode >= 400) {
      throw Exception('Game fetch failed: ${res.statusCode} ${res.body}');
    }
    final j = jsonDecode(res.body) as Map<String, dynamic>;
    return GeneratedGame(
      gameId: j['gameId'] as String,
      orientation: (j['orientation'] as String?) ?? 'portrait',
      language: (j['language'] as String?) ?? 'en',
      html: j['html'] as String,
    );
  }

  Future<List<GameSummary>> library() async {
    final res = await _client.get(
      Uri.parse('$baseUrl/api/games/library'),
      headers: _headers,
    );
    if (res.statusCode >= 400) return const [];
    final j = jsonDecode(res.body) as Map<String, dynamic>;
    return (j['games'] as List<dynamic>)
        .map((e) => GameSummary.fromJson(e as Map<String, dynamic>))
        .toList();
  }
}
