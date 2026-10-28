import type { Metadata } from "next";
import SignupPage from "./SignupPage";

export const metadata: Metadata = {
  title: "Start your MobiDuka trial",
  description: "Create a MobiDuka POS business workspace with a 14-day trial.",
};

export default function Page() {
  const registrationEnabled =
    process.env.NODE_ENV !== "production" ||
    process.env.BUSINESS_REGISTRATION_ENABLED === "true";
  return <SignupPage registrationEnabled={registrationEnabled} />;
}
