"use client"

import Link from "next/link"
import { useColors } from "../utils/theme"
import type { AndroidRelease } from "@/lib/android-release"

function formatSize(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function AndroidDownloadContent({
  release,
}: {
  release: AndroidRelease | null
}) {
  const c = useColors()

  return (
    <main
      style={{
        minHeight: "100dvh",
        width: "100%",
        background: c.bg,
        color: c.text,
        padding: "clamp(24px, 5vw, 64px)",
        transition: "background-color 160ms ease, color 160ms ease",
      }}
    >
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        <header style={{ marginBottom: 52 }}>
          <Link
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              color: "inherit",
              textDecoration: "none",
              fontSize: 18,
              fontWeight: 750,
            }}
          >
            <img src="/mobiduka_icon.svg" alt="" width="34" height="34" />
            MobiDuka POS
          </Link>
        </header>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 56,
            alignItems: "center",
          }}
        >
          <div>
            <p
              style={{
                color: c.success,
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: 1.2,
                textTransform: "uppercase",
              }}
            >
              Android app
            </p>
            <h1
              style={{
                maxWidth: 560,
                margin: "10px 0 16px",
                fontSize: "clamp(36px, 6vw, 62px)",
                lineHeight: 1.04,
              }}
            >
              MobiDuka, ready for your counter.
            </h1>
            <p style={{ maxWidth: 500, color: c.muted, lineHeight: 1.65 }}>
              Install the latest signed Android app for sales, stock, shifts, and
              supported offline workflows.
            </p>

            {release ? (
              <>
                <a
                  href={release.downloadUrl}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: 50,
                    marginTop: 16,
                    padding: "0 22px",
                    borderRadius: 6,
                    background: c.primary,
                    color: c.primaryText,
                    fontWeight: 750,
                    textDecoration: "none",
                  }}
                >
                  Download Android APK · v{release.version}
                </a>
                <dl
                  style={{
                    display: "grid",
                    gridTemplateColumns: "max-content 1fr",
                    gap: "8px 18px",
                    marginTop: 28,
                    color: c.muted,
                    fontSize: 13,
                  }}
                >
                  <dt>File size</dt>
                  <dd style={{ margin: 0 }}>{formatSize(release.sizeBytes)}</dd>
                  <dt>Minimum Android</dt>
                  <dd style={{ margin: 0 }}>{release.minAndroidVersion}</dd>
                  <dt>SHA-256</dt>
                  <dd
                    style={{
                      maxWidth: "100%",
                      margin: 0,
                      overflowWrap: "anywhere",
                      fontFamily: "monospace",
                      fontSize: 11,
                    }}
                  >
                    {release.sha256}
                  </dd>
                </dl>
              </>
            ) : (
              <p
                role="status"
                style={{
                  marginTop: 24,
                  padding: 14,
                  borderRadius: 6,
                  background: c.warningBg,
                  color: c.warning,
                  lineHeight: 1.6,
                }}
              >
                The public APK download will appear here after the next release
                is published.
              </p>
            )}

            <p style={{ marginTop: 24, color: c.muted, fontSize: 12 }}>
              Android 6.0 or later. Installation may ask you to allow apps from
              your browser. Updates require the official signed APK.
            </p>
          </div>

          <div style={{ display: "flex", justifyContent: "center" }}>
            <img
              src="/mobiduka-dashboard.png"
              alt="MobiDuka POS business dashboard on a phone"
              style={{
                display: "block",
                width: "min(100%, 360px)",
                maxHeight: "72dvh",
                objectFit: "contain",
                objectPosition: "top",
              }}
            />
          </div>
        </section>
      </div>
    </main>
  )
}