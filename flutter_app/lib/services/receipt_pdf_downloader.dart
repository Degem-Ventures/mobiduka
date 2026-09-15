import 'dart:typed_data';

import 'receipt_pdf_downloader_stub.dart'
    if (dart.library.html) 'receipt_pdf_downloader_web.dart';

Future<void> downloadReceiptPdf(Uint8List bytes, String filename) =>
    downloadReceiptPdfImpl(bytes, filename);
