"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";

type AdminAuthGateProps = { children: ReactNode };

export default function AdminAuthGate({ children }: AdminAuthGateProps) {
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const checkSession = async () => {
    const response = await fetch("/api/admin/session", { cache: "no-store" });
    setAuthenticated(response.ok);
    setChecking(false);
  };

  useEffect(() => {
    void checkSession().catch(error => {
      console.error("Platform admin session check failed.", error);
      setChecking(false);
    });
  }, []);

  const signIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/platform-admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to sign in.");
      await checkSession();
      setPassword("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to sign in.");
    } finally {
      setSubmitting(false);
    }
  };

  const signOut = async () => {
    const response = await fetch("/api/admin/session", { method: "DELETE" });
    if (!response.ok) {
      setError("Unable to sign out. Please reload this page.");
      return;
    }
    setAuthenticated(false);
  };

  if (checking) {
    return <div className="admin-auth-loading">Verifying platform administrator access…</div>;
  }
  if (!authenticated) {
    return (
      <main className="admin-auth-page">
        <form className="admin-auth-card" onSubmit={signIn}>
          <div className="admin-brand-mark"><img src="/mobiduka_icon.svg" alt=""/></div>
          <span className="admin-auth-eyebrow">GLOBAL ADMINISTRATION</span>
          <h1>Platform sign in</h1>
          <p>This control plane is restricted to authorized SUPER_ADMIN accounts.</p>
          <label>Email address<input type="email" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)}/></label>
          <label>Password<input type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)}/></label>
          {error && <div role="alert" className="admin-auth-error">{error}</div>}
          <button type="submit" disabled={submitting}>{submitting ? "Verifying…" : "Sign in securely"}</button>
        </form>
      </main>
    );
  }

  return (
    <>
      <div className="admin-auth-session">
        <span>SUPER_ADMIN session</span>
        <button onClick={() => void signOut()}>Sign out</button>
      </div>
      {children}
    </>
  );
}
