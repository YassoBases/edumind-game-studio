// Web-only iframe player. Uses iframe.src pointing at the backend's /:id/play endpoint
// (more reliable than srcdoc for large HTML) and exposes the iframe's load state via a
// global callback so the host screen can show a visible diagnostic strip.
// ignore_for_file: avoid_web_libraries_in_flutter
import 'dart:html' as html;
import 'dart:ui_web' as ui_web;
import 'package:flutter/material.dart';

final Set<String> _registered = {};
final Map<String, _IframeState> _state = {};

class _IframeState {
  bool factoryCalled = false;
  int factoryCount = 0;
  bool loaded = false;
  DateTime? loadedAt;
  String? error;
  int? widthOnLoad;
  int? heightOnLoad;
}

void _log(String msg) {
  html.window.console.log('[EduMind Player] $msg');
}

// Tells the host screen what's happening so it can render the diagnostic strip.
typedef IframeStatusCallback = void Function(String label);
IframeStatusCallback? _statusCallback;
void registerStatusCallback(IframeStatusCallback cb) {
  _statusCallback = cb;
}

void _emit(String gameId, String msg) {
  final s = _state[gameId];
  final flags = s == null
      ? ''
      : ' [factory=${s.factoryCount} loaded=${s.loaded} err=${s.error ?? "-"}]';
  _log('$gameId $msg$flags');
  _statusCallback?.call(msg + flags);
}

String playUrl(String backendUrl, String gameId) => '$backendUrl/api/games/$gameId/play';

void registerGameIframe(String gameId, String backendUrl) {
  final viewType = _viewType(gameId);
  _state.putIfAbsent(gameId, _IframeState.new);
  if (_registered.contains(viewType)) {
    _emit(gameId, 'iframe factory already registered');
    return;
  }
  final url = playUrl(backendUrl, gameId);
  _emit(gameId, 'registering iframe factory for url=$url');
  ui_web.platformViewRegistry.registerViewFactory(viewType, (int viewId) {
    final s = _state[gameId]!;
    s.factoryCalled = true;
    s.factoryCount += 1;
    _emit(gameId, 'factory invoked viewId=$viewId');
    final iframe = html.IFrameElement()
      ..style.border = '0'
      ..style.margin = '0'
      ..style.padding = '0'
      ..style.display = 'block'
      ..style.position = 'absolute'
      ..style.top = '0'
      ..style.left = '0'
      ..style.width = '100%'
      ..style.height = '100%'
      ..style.background = '#0b1020'
      ..width = '100%'
      ..height = '100%'
      ..allow = 'autoplay; fullscreen'
      ..setAttribute('allowfullscreen', 'true')
      ..src = url;
    iframe.onLoad.listen((_) {
      s.loaded = true;
      s.loadedAt = DateTime.now();
      s.widthOnLoad = iframe.clientWidth;
      s.heightOnLoad = iframe.clientHeight;
      _emit(gameId,
          'iframe loaded (${iframe.clientWidth}x${iframe.clientHeight}) at ${s.loadedAt!.toIso8601String()}');
    });
    iframe.onError.listen((e) {
      s.error = e.toString();
      _emit(gameId, 'iframe error: ${e.toString()}');
    });
    return iframe;
  });
  _registered.add(viewType);
}

Widget buildGameIframe(String gameId) {
  return Stack(
    fit: StackFit.expand,
    children: [
      Positioned.fill(child: HtmlElementView(viewType: _viewType(gameId))),
    ],
  );
}

void openInNewTab(String backendUrl, String gameId) {
  html.window.open(playUrl(backendUrl, gameId), '_blank');
}

String _viewType(String gameId) => 'edumind-game-$gameId';
