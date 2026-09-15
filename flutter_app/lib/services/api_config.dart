class ApiConfig {
  const ApiConfig._();

  static const String configuredOrigin = String.fromEnvironment(
    'MOBIDUKA_API_ORIGIN',
    defaultValue: 'https://mobiduka.vercel.app',
  );

  static String get origin {
    final configured = Uri.tryParse(configuredOrigin);
    final isFlutterPreviewHost = configured?.host.endsWith('-8080.app.github.dev') ?? false;
    if (configured == null || isFlutterPreviewHost || configured.host.isEmpty) {
      return 'https://mobiduka.vercel.app';
    }
    final scheme = configured.scheme.isEmpty ? 'https' : configured.scheme;
    return Uri(
      scheme: scheme,
      host: configured.host,
      port: configured.hasPort ? configured.port : null,
      path: configured.path.replaceFirst(RegExp(r'/$'), ''),
    ).toString().replaceFirst(RegExp(r'/$'), '');
  }

  static String get apiBase {
    final base = Uri.parse(origin);
    return base.replace(path: '/api', query: null, fragment: null).toString();
  }
}
