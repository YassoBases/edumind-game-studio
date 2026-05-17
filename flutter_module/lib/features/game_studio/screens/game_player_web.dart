// Web-only iframe player. Registers a platform view backed by an IFrameElement so the
// generated HTML runs inside a sandboxed frame inside the Flutter web app.
// ignore_for_file: avoid_web_libraries_in_flutter
import 'dart:html' as html;
import 'dart:ui_web' as ui_web;
import 'package:flutter/material.dart';

final Set<String> _registered = {};

void registerGameIframe(String gameId, String htmlSource) {
  final viewType = _viewType(gameId);
  if (_registered.contains(viewType)) return;
  ui_web.platformViewRegistry.registerViewFactory(viewType, (int _) {
    final iframe = html.IFrameElement()
      ..style.border = '0'
      ..style.width = '100%'
      ..style.height = '100%'
      ..allow = 'autoplay; fullscreen'
      ..setAttribute('allowfullscreen', 'true')
      ..srcdoc = htmlSource;
    // Forward bridge messages from the inner game to the host page so the Dart side could
    // listen via window message events if it wanted to. For now we don't wire it back yet.
    html.window.addEventListener('message', (_) {});
    return iframe;
  });
  _registered.add(viewType);
}

Widget buildGameIframe(String gameId) {
  return HtmlElementView(viewType: _viewType(gameId));
}

String _viewType(String gameId) => 'edumind-game-$gameId';
