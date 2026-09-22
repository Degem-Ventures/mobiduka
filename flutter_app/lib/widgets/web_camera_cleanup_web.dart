import 'dart:html' as html;

/// Explicitly releases browser video tracks retained by web barcode readers.
Future<void> releaseWebCameraTracks() async {
  for (final element in html.document.querySelectorAll('video')) {
    if (element is! html.VideoElement) continue;
    final stream = element.srcObject;
    if (stream is html.MediaStream) {
      for (final track in stream.getTracks()) {
        track.stop();
      }
    }
    element.pause();
    element.srcObject = null;
  }
}
