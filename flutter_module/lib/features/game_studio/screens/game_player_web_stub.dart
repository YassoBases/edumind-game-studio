// Native stub. The matching web file (game_player_web.dart) is conditionally imported
// when dart:html is available.
import 'package:flutter/material.dart';

void registerGameIframe(String gameId, String html) {/* no-op on native */}

Widget buildGameIframe(String gameId) =>
    const ColoredBox(color: Colors.black, child: SizedBox.expand());
