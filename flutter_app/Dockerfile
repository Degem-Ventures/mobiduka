FROM debian:bookworm-slim AS flutter-core

ENV DEBIAN_FRONTEND=noninteractive \
    FLUTTER_HOME=/flutter \
    PATH="/flutter/bin:${PATH}"

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    bash \
    ca-certificates \
    curl \
    git \
    unzip \
    xz-utils \
    zip \
    && git clone --depth 1 --branch stable https://github.com/flutter/flutter.git /flutter \
    && /flutter/bin/flutter --version \
    && rm -rf /var/lib/apt/lists/*

RUN /flutter/bin/flutter config --enable-web

FROM flutter-core AS mobiduka-flutter

COPY pubspec.yaml pubspec.lock ./

RUN --mount=type=cache,target=/root/.pub-cache \
    /flutter/bin/flutter pub get

COPY . /app

VOLUME ["/app"]

EXPOSE 8080

CMD ["bash", "-lc", "cd /app && /flutter/bin/flutter run --debug -d web-server --web-port 8080 --web-hostname 0.0.0.0"]
