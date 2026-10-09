import type { Metadata } from "next";
import { ThemeProvider } from "../context/ThemeContext";
import MarketingPage from "./MarketingPage";
import "./marketing.css";

export const metadata: Metadata = {
  title: "MobiDuka POS | Retail Management",
  description:
    "Manage sales, inventory, payments and business performance with MobiDuka POS.",
};

export default function Page() {
  return (
    <ThemeProvider>
      <MarketingPage />
    </ThemeProvider>
  );
}