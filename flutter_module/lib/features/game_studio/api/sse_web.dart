// Web SSE transport — uses XMLHttpRequest with `onprogress`. dart2js exposes responseText
// as a growing String during the request, and `onProgress` fires for each chunk. This is
// simpler and more reliable than fetch + ReadableStream (which has interop hazards under
// dart2js / Dart 3.3). All steps log to the browser console for debugging.
// ignore_for_file: avoid_web_libraries_in_flutter
import 'dart:async';
import 'dart:convert';
import 'dart:html' as html;

void Function(String msg)? _externalLog;
void _log(String msg) {
  html.window.console.log('[EduMind SSE] $msg');
  _externalLog?.call(msg);
}

Stream<({String event, Map<String, dynamic> data})> openSse({
  required String url,
  required Map<String, String> headers,
  required String body,
  void Function(String msg)? onLog,
}) {
  _externalLog = onLog;
  final controller = StreamController<({String event, Map<String, dynamic> data})>();
  final xhr = html.HttpRequest();
  xhr.open('POST', url, async: true);
  // Accumulate text/event-stream as plain text; XHR exposes the running responseText.
  xhr.responseType = '';
  headers.forEach((k, v) => xhr.setRequestHeader(k, v));
  xhr.setRequestHeader('Accept', 'text/event-stream');

  int lastIndex = 0;
  String pending = '';
  String? event;
  final dataBuf = StringBuffer();
  int frameCount = 0;

  void parseAppend(String chunk) {
    pending += chunk;
    while (true) {
      final newlineIdx = pending.indexOf('\n');
      if (newlineIdx < 0) break;
      final rawLine = pending.substring(0, newlineIdx);
      pending = pending.substring(newlineIdx + 1);
      final line = rawLine.endsWith('\r') ? rawLine.substring(0, rawLine.length - 1) : rawLine;
      if (line.startsWith(':')) continue; // heartbeat
      if (line.isEmpty) {
        final ev = event;
        if (ev != null && dataBuf.isNotEmpty) {
          try {
            final data = jsonDecode(dataBuf.toString()) as Map<String, dynamic>;
            frameCount += 1;
            _log('frame #$frameCount event=$ev keys=${data.keys.join(",")}');
            controller.add((event: ev, data: data));
          } catch (e) {
            _log('frame parse FAILED: $e | raw=${dataBuf.toString().substring(0, dataBuf.length > 200 ? 200 : dataBuf.length)}');
          }
        }
        event = null;
        dataBuf.clear();
        continue;
      }
      if (line.startsWith('event: ')) {
        event = line.substring(7).trim();
      } else if (line.startsWith('data: ')) {
        dataBuf.write(line.substring(6));
      }
    }
  }

  xhr.onProgress.listen((_) {
    final txt = xhr.responseText ?? '';
    if (txt.length > lastIndex) {
      final delta = txt.substring(lastIndex);
      lastIndex = txt.length;
      _log('chunk +${delta.length}b (total ${txt.length}b)');
      parseAppend(delta);
    }
  });
  xhr.onLoadEnd.listen((_) {
    final txt = xhr.responseText ?? '';
    if (txt.length > lastIndex) {
      parseAppend(txt.substring(lastIndex));
      lastIndex = txt.length;
    }
    // Ensure any trailing event flushes.
    parseAppend('\n\n');
    _log('loadEnd status=${xhr.status} totalBytes=$lastIndex frames=$frameCount');
    if (!controller.isClosed) controller.close();
  });
  xhr.onError.listen((_) {
    _log('xhr ERROR status=${xhr.status}');
    if (!controller.isClosed) {
      controller.addError(Exception('XHR error ${xhr.status}'));
      controller.close();
    }
  });

  _log('opening SSE → $url (body=${body.length}b)');
  xhr.send(body);

  controller.onCancel = () {
    _log('stream canceled, aborting xhr');
    xhr.abort();
  };

  return controller.stream;
}
