// Native (non-web) SSE transport — uses package:http chunked streaming, which works fine
// on Android/iOS/desktop.
import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;

Stream<({String event, Map<String, dynamic> data})> openSse({
  required String url,
  required Map<String, String> headers,
  required String body,
  void Function(String msg)? onLog,
}) async* {
  onLog?.call('opening native SSE');
  final req = http.Request('POST', Uri.parse(url))
    ..headers.addAll({...headers, 'accept': 'text/event-stream'})
    ..body = body;
  final res = await http.Client().send(req);
  if (res.statusCode >= 400) {
    throw Exception('SSE HTTP ${res.statusCode}');
  }
  final lines = res.stream.transform(utf8.decoder).transform(const LineSplitter());
  String? event;
  final buf = StringBuffer();
  await for (final line in lines) {
    if (line.startsWith(':')) continue;
    if (line.isEmpty) {
      if (event != null && buf.isNotEmpty) {
        try {
          final data = jsonDecode(buf.toString()) as Map<String, dynamic>;
          yield (event: event, data: data);
        } catch (_) {/* swallow malformed frame */}
      }
      event = null;
      buf.clear();
      continue;
    }
    if (line.startsWith('event: ')) event = line.substring(7).trim();
    else if (line.startsWith('data: ')) buf.write(line.substring(6));
  }
}
