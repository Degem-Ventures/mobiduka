"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, saveClientSession, savePinLoginContext, type ClientSession } from "../../lib/client-api";

export default function SignupPage() {
  const router = useRouter();
  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [password, setPassword] = useState("");
  const [initialPin, setInitialPin] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const email = ownerEmail.trim().toLowerCase();
    try {
      const registration = await apiFetch<{ businessId: string }>("/api/auth/onboard", {
        method: "POST",
        body: JSON.stringify({
          businessName,
          ownerName,
          ownerEmail: email,
          phone,
          businessType,
          password,
          initialPin: initialPin || undefined,
        }),
      });
      const session = await apiFetch<ClientSession>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ identifier: email, password }),
      });
      saveClientSession(session);
      savePinLoginContext({
        identifier: email,
        businessId: registration.businessId,
        displayName: ownerName.trim(),
      });
      router.replace("/");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to create your trial account.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#f3f6fb", color: "#0d1b3d" }}>
      <form onSubmit={submit} style={{ width: "min(100%, 520px)", display: "grid", gap: 14, padding: 32, border: "1px solid #dce3ee", borderRadius: 18, background: "white", boxShadow: "0 20px 55px rgba(13,27,61,.1)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img src="/mobiduka_icon.svg" width="42" height="42" alt="MobiDuka"/>
          <div><strong style={{ display: "block", fontSize: 20 }}>Start your 14-day trial</strong><span style={{ color: "#65738b", fontSize: 12 }}>Create a business workspace for your team.</span></div>
        </div>
        <label style={fieldStyle}>Business name<input required value={businessName} onChange={event => setBusinessName(event.target.value)} autoComplete="organization"/></label>
        <label style={fieldStyle}>Owner full name<input required value={ownerName} onChange={event => setOwnerName(event.target.value)} autoComplete="name"/></label>
        <label style={fieldStyle}>Owner email<input required type="email" value={ownerEmail} onChange={event => setOwnerEmail(event.target.value)} autoComplete="email"/></label>
        <label style={fieldStyle}>Phone number<input type="tel" value={phone} onChange={event => setPhone(event.target.value)} autoComplete="tel"/></label>
        <label style={fieldStyle}>Business type
          <select value={businessType} onChange={event => setBusinessType(event.target.value)}>
            <option value="">Select a business type</option>
            <option value="duka">Duka or kiosk</option>
            <option value="mini-market">Mini-market</option>
            <option value="pharmacy">Pharmacy</option>
            <option value="agrovet">Agrovet</option>
            <option value="retail-chain">Retail chain</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label style={fieldStyle}>Password (at least 12 characters)<input required type="password" minLength={12} value={password} onChange={event => setPassword(event.target.value)} autoComplete="new-password"/></label>
        <label style={fieldStyle}>Optional cashier PIN (4 digits)<input type="password" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} value={initialPin} onChange={event => setInitialPin(event.target.value.replace(/\D/g, "").slice(0, 4))} autoComplete="off"/></label>
        {error && <div role="alert" style={{ padding: 11, borderRadius: 8, background: "#fff1f0", color: "#a52822", fontSize: 12 }}>{error}</div>}
        <button type="submit" disabled={submitting} style={{ minHeight: 46, border: 0, borderRadius: 9, background: "#123a8f", color: "white", fontWeight: 800, cursor: submitting ? "wait" : "pointer" }}>{submitting ? "Creating workspace…" : "Create workspace and start trial"}</button>
        <p style={{ margin: 0, color: "#65738b", fontSize: 11, lineHeight: 1.5 }}>Your business data is preserved if the trial ends. New sales and synchronization pause until an owner activates a subscription.</p>
      </form>
    </main>
  );
}

const fieldStyle = {
  display: "grid",
  gap: 6,
  color: "#44536c",
  fontSize: 12,
  fontWeight: 700,
} as const;
