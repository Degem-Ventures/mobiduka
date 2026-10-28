import type { Metadata } from "next"
import { ThemeProvider } from "./context/ThemeContext"
import MarketingPage from "./marketing/MarketingPage"
import "./marketing/marketing.css"

export const metadata: Metadata = {
  title: "MobiDuka POS | Retail Management",
  description:
    "Manage sales, inventory, payments and business performance with MobiDuka POS.",
}

export default function HomePage() {
  const registrationEnabled =
    process.env.NODE_ENV !== "production" ||
    process.env.BUSINESS_REGISTRATION_ENABLED === "true"

  return (
    <ThemeProvider>
      <MarketingPage registrationEnabled={registrationEnabled} />
    </ThemeProvider>
  )
}
