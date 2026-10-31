import { list } from "@vercel/blob"

export type AndroidRelease = {
  version: string
  tag: string
  versionCode: number
  downloadUrl: string
  sizeBytes: number
  sha256: string
  minAndroidVersion: string
  publishedAt: string
}

export type AndroidReleaseArchive = {
  version: string
  tag: string
  downloadUrl: string
  sizeBytes: number
  publishedAt: string
}

const latestManifestPath = "mobiduka/android/latest.json"
const releasePathPrefix = "mobiduka/android/releases/"
const releaseApkPathPattern =
  /^mobiduka\/android\/releases\/(v(\d+\.\d+\.\d+(?:[+-][0-9A-Za-z.-]+)?))\/[^/]+\/app-release\.apk$/

function parseAndroidRelease(value: unknown): AndroidRelease | null {
  if (!value || typeof value !== "object") return null
  const release = value as Partial<AndroidRelease>
  if (
    typeof release.version !== "string" ||
    typeof release.tag !== "string" ||
    typeof release.versionCode !== "number" ||
    typeof release.downloadUrl !== "string" ||
    typeof release.sizeBytes !== "number" ||
    typeof release.sha256 !== "string" ||
    !/^[a-f\d]{64}$/i.test(release.sha256) ||
    typeof release.minAndroidVersion !== "string" ||
    typeof release.publishedAt !== "string"
  ) {
    return null
  }

  try {
    const url = new URL(release.downloadUrl)
    if (
      url.protocol !== "https:" ||
      !url.hostname.endsWith(".blob.vercel-storage.com")
    ) {
      return null
    }
  } catch {
    return null
  }

  return release as AndroidRelease
}

export async function getLatestAndroidRelease(): Promise<AndroidRelease | null> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null

  try {
    const { blobs } = await list({
      prefix: latestManifestPath,
      limit: 10,
    })
    const manifestBlob = blobs.find(
      (blob) => blob.pathname === latestManifestPath,
    )
    if (!manifestBlob) return null

    const response = await fetch(manifestBlob.downloadUrl, {
      cache: "no-store",
    })
    if (!response.ok) return null
    return parseAndroidRelease(await response.json())
  } catch (error) {
    console.error("Unable to load the latest Android release.", error)
    return null
  }
}

export async function getAndroidReleaseArchive(
  latestTag?: string,
): Promise<AndroidReleaseArchive[]> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return []

  try {
    const { blobs } = await list({ prefix: releasePathPrefix, limit: 1000 })
    const releasesByTag = new Map<string, AndroidReleaseArchive>()

    for (const blob of blobs) {
      const match = releaseApkPathPattern.exec(blob.pathname)
      if (!match) continue
      const [, tag, version] = match
      if (tag === latestTag) continue

      try {
        const url = new URL(blob.downloadUrl)
        if (
          url.protocol !== "https:" ||
          !url.hostname.endsWith(".blob.vercel-storage.com")
        ) {
          continue
        }
      } catch {
        continue
      }

      const release: AndroidReleaseArchive = {
        tag,
        version,
        downloadUrl: blob.downloadUrl,
        sizeBytes: blob.size,
        publishedAt: blob.uploadedAt.toISOString(),
      }
      const existing = releasesByTag.get(tag)
      if (
        !existing ||
        Date.parse(release.publishedAt) > Date.parse(existing.publishedAt)
      ) {
        releasesByTag.set(tag, release)
      }
    }

    return [...releasesByTag.values()]
      .sort(
        (left, right) =>
          Date.parse(right.publishedAt) - Date.parse(left.publishedAt),
      )
      .slice(0, 20)
  } catch (error) {
    console.error("Unable to load previous Android releases.", error)
    return []
  }
}