import type { Metadata } from "next"
import {
  getAndroidReleaseArchive,
  getLatestAndroidRelease,
} from "@/lib/android-release"
import { ThemeProvider } from "../context/ThemeContext"
import AndroidDownloadContent from "./AndroidDownloadContent"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export const metadata: Metadata = {
  title: "Download MobiDuka for Android",
  description: "Download the latest signed MobiDuka POS Android app.",
}

export default async function AndroidDownloadPage() {
  const release = await getLatestAndroidRelease()
  const previousReleases = await getAndroidReleaseArchive(release?.tag)

  return (
    <ThemeProvider>
      <AndroidDownloadContent
        release={release}
        previousReleases={previousReleases}
      />
    </ThemeProvider>
  )
}