// Native stub. The matching web file (game_player_web.dart) is conditionally imported
// when dart:html is available.
import 'package:flutter/material.dart';

typedef IframeStatusCallback = void Function(String label);
typedef IframeBridgeCallback = void Function(String jsonPayload);
void registerStatusCallback(IframeStatusCallback cb) {/* no-op on native */}
void registerBridge(IframeBridgeCallback cb) {/* no-op on native */}
void registerGameIframe(String gameId, String backendUrl) {/* no-op */}
void openInNewTab(String backendUrl, String gameId) {/* no-op */}

Widget buildGameIframe(String gameId) =>
    const ColoredBox(color: Colors.black, child: SizedBox.expand());
