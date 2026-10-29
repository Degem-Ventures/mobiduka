import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./global.css";
import WebPushRegistration from "./components/WebPushRegistration";
import NativePushRegistration from "./components/NativePushRegistration";
import OfflineServiceWorker from "./components/OfflineServiceWorker";

export const metadata: Metadata = {
  title: "MobiDuka POS",
  description: "Next-generation Point of Sale Terminal",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
        <OfflineServiceWorker />
        <WebPushRegistration />
        <NativePushRegistration />
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
