import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import App from "../app/page"
import NativePushRegistration from "../app/components/NativePushRegistration"
import "../app/global.css"

const root = document.getElementById("root")
if (!root) throw new Error("Capacitor app root element is missing.")

createRoot(root).render(
  <StrictMode>
    <App />
    <NativePushRegistration />
  </StrictMode>,
)
