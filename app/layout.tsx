import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./global.css";
import WebPushRegistration from "./components/WebPushRegistration";

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
        <WebPushRegistration />
        {children}
      </body>
    </html>
  );
}
