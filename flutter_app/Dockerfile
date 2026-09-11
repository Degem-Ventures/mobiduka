FROM debian:bookworm-slim

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
    clang \
    cmake \
    ninja-build \
    pkg-config \
    libgtk-3-dev \
    mesa-utils \
    && git clone --depth 1 --branch stable https://github.com/flutter/flutter.git /flutter \
    && /flutter/bin/flutter --version

COPY . /app

RUN /flutter/bin/flutter config --enable-web && /flutter/bin/flutter pub get

VOLUME ["/app"]

EXPOSE 8080

CMD ["bash", "-lc", "cd /app && /flutter/bin/flutter pub get && /flutter/bin/flutter run --debug -d web-server --web-port 8080 --web-hostname 0.0.0.0"]
