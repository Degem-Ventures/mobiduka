import type { Metadata } from "next";
import SignupPage from "./SignupPage";

export const metadata: Metadata = {
  title: "Start your MobiDuka trial",
  description: "Create a MobiDuka POS business workspace with a 14-day trial.",
};

export default function Page() {
  return <SignupPage />;
}
