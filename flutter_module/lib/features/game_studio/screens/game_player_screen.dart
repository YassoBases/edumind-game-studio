import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:webview_flutter/webview_flutter.dart';
import '../api/client.dart';
import '../models/game_spec.dart';
import 'summary_screen.dart';

// Conditional import: real implementation on web, stub on native.
import 'game_player_web_stub.dart' if (dart.library.html) 'game_player_web.dart' as web;

class GamePlayerScreen extends StatefulWidget {
  final GameStudioApi api;
  final GeneratedGame game;
  /// Optional offline-library handle so bridge events can record bestScore on session end.
  /// Pass through from the home/dashboard or library screen.
  // Untyped to keep this file independent of game_database.dart at the import level.
  final dynamic db;
  const GamePlayerScreen({super.key, required this.api, required this.game, this.db});

  @override
  State<GamePlayerScreen> createState() => _GamePlayerScreenState();
}

class _GamePlayerScreenState extends State<GamePlayerScreen> {
  WebViewController? _controller;
  Map<String, dynamic>? _summaryPayload;
  bool _shouldPop = false;
  String _iframeStatus = 'initializing';
  bool _iframeReady = false;

  @override
  void initState() {
    super.initState();
    if (!kIsWeb) {
      _lockOrientation();
      SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
      _controller = WebViewController()
        ..setJavaScriptMode(JavaScriptMode.unrestricted)
        ..setBackgroundColor(const Color(0xFF000000))
        ..addJavaScriptChannel('EduMind', onMessageReceived: _onBridge)
        ..loadHtmlString(widget.game.html);
    } else {
      // Stream iframe lifecycle into the visible diagnostic strip.
      web.registerStatusCallback((msg) {
        if (!mounted) return;
        setState(() => _iframeStatus = msg);
      });
      // Fade the loading overlay out the moment the iframe finishes loading.
      web.registerLoadedCallback(() {
        if (!mounted) return;
        setState(() => _iframeReady = true);
      });
      // Bridge: when the inner game calls window.parent.postMessage, route those events
      // through the SAME handler the native WebView channel uses. This is how level / summary
      // / complete writes back to the cloud library on web builds.
      web.registerBridge((jsonPayload) {
        _onBridge(JavaScriptMessage(message: jsonPayload));
      });
      // Point the iframe at the backend's /play endpoint so we get a real navigable URL
      // (way more reliable than srcdoc for large HTML).
      web.registerGameIframe(widget.game.gameId, widget.api.baseUrl);
    }
  }

  void _lockOrientation() {
    if (widget.game.orientation == 'landscape') {
      SystemChrome.setPreferredOrientations(
        [DeviceOrientation.landscapeLeft, DeviceOrientation.landscapeRight],
      );
    } else {
      SystemChrome.setPreferredOrientations(
        [DeviceOrientation.portraitUp, DeviceOrientation.portraitDown],
      );
    }
  }

  void _onBridge(JavaScriptMessage msg) {
    try {
      final m = jsonDecode(msg.message) as Map<String, dynamic>;
      final event = m['event'] as String?;
      final data = m['data'] as Map<String, dynamic>?;
      switch (event) {
        case 'level':
          if (data != null) {
            widget.api.reportLevel(
              gameId: widget.game.gameId,
              level: data['level'] as int,
              score: (data['score'] as num).toDouble(),
              accuracy: (data['accuracy'] as num).toDouble(),
              durationMs: data['durationMs'] as int,
            );
          }
          break;
        case 'summary':
          if (data != null) _summaryPayload = data;
          break;
        case 'complete':
          // Persist the final score into the offline library if a db handle was passed in.
          // The complete event payload is { score, won, time }.
          if (widget.db != null && data != null) {
            final scoreRaw = data['score'];
            final score = scoreRaw is num ? scoreRaw.round() : 0;
            try {
              // The Drift-or-stub database both expose `recordPlay(id, score)`.
              unawaited((widget.db.recordPlay(widget.game.gameId, score) as Future<void>?) ??
                  Future<void>.value());
            } catch (_) {/* db handle missing or wrong shape — ignore */}
          }
          if (_summaryPayload != null) {
            unawaited(widget.api.reportComplete(
              gameId: widget.game.gameId,
              summary: _summaryPayload!,
            ));
            if (mounted) {
              Navigator.of(context).pushReplacement(
                MaterialPageRoute(
                  builder: (_) => SummaryScreen(api: widget.api, gameId: widget.game.gameId),
                ),
              );
            }
          }
          break;
      }
    } catch (_) {/* swallow malformed frame */}
  }

  Future<bool> _confirmExit() async {
    final out = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(widget.game.language == 'ar' ? 'الخروج من اللعبة؟' : 'Exit game?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('No')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Yes')),
        ],
      ),
    );
    return out ?? false;
  }

  @override
  void dispose() {
    if (!kIsWeb) {
      SystemChrome.setPreferredOrientations(DeviceOrientation.values);
      SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    }
    super.dispose();
  }

  Future<void> _attemptExit() async {
    if (await _confirmExit() && mounted) {
      setState(() => _shouldPop = true);
      // Allow PopScope to release the route now that the user confirmed.
      Navigator.of(context).pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: _shouldPop,
      onPopInvoked: (didPop) async {
        if (didPop) return;
        await _attemptExit();
      },
      child: Scaffold(
        backgroundColor: Colors.black,
        appBar: AppBar(
          backgroundColor: Colors.black,
          iconTheme: const IconThemeData(color: Colors.white),
          leading: IconButton(
            icon: const Icon(Icons.close_rounded),
            onPressed: _attemptExit,
          ),
          title: Text(widget.game.gameId, style: const TextStyle(color: Colors.white, fontSize: 13)),
          actions: [
            if (kIsWeb)
              TextButton.icon(
                onPressed: () => web.openInNewTab(widget.api.baseUrl, widget.game.gameId),
                icon: const Icon(Icons.open_in_new_rounded, color: Colors.white, size: 18),
                label: const Text('Open in new tab', style: TextStyle(color: Colors.white, fontSize: 12)),
              ),
          ],
        ),
        body: Column(
          children: [
            if (kIsWeb)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                color: const Color(0xFF1A2347),
                child: Text(
                  'iframe: $_iframeStatus',
                  style: const TextStyle(color: Color(0xFFB4BCD8), fontSize: 11, fontFamily: 'monospace'),
                ),
              ),
            Expanded(
              child: SafeArea(
                top: false,
                // Force the iframe / WebView to take the entire remaining body space. Without
                // an explicit size, HtmlElementView's platform slot collapses to 0x0 on web.
                child: SizedBox.expand(
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      kIsWeb
                          ? web.buildGameIframe(widget.game.gameId)
                          : WebViewWidget(controller: _controller!),
                      if (kIsWeb && !_iframeReady)
                        Container(
                          color: const Color(0xFF0B1020),
                          alignment: Alignment.center,
                          child: const Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              SizedBox(
                                width: 48,
                                height: 48,
                                child: CircularProgressIndicator(
                                  color: Colors.white70,
                                  strokeWidth: 3,
                                ),
                              ),
                              SizedBox(height: 16),
                              Text(
                                'Loading game…',
                                style: TextStyle(color: Colors.white70, fontSize: 14),
                              ),
                              SizedBox(height: 6),
                              Text(
                                'First load can take 20–40 s (sprites + engine).',
                                style: TextStyle(color: Color(0xFF7C86A8), fontSize: 11),
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
