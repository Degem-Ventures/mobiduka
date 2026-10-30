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

const latestManifestPath = "mobiduka/android/latest.json"

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