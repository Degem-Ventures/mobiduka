import crypto from "node:crypto";

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const MESSAGING_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";

function base64Url(value: string | object) {
  const input = typeof value === "string" ? value : JSON.stringify(value);
  return Buffer.from(input).toString("base64url");
}

async function getFirebaseAccessToken(): Promise<string> {
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!clientEmail || !privateKey) return "";

  const issuedAt = Math.floor(Date.now() / 1000);
  const assertionHeader = base64Url({ alg: "RS256", typ: "JWT" });
  const assertionClaim = base64Url({
    iss: clientEmail,
    scope: MESSAGING_SCOPE,
    aud: TOKEN_ENDPOINT,
    iat: issuedAt,
    exp: issuedAt + 3600,
  });
  const unsignedAssertion = `${assertionHeader}.${assertionClaim}`;
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(unsignedAssertion);
  const assertion = `${unsignedAssertion}.${signer.sign(privateKey, "base64url")}`;

  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) return "";

  const data = (await response.json()) as { access_token?: string };
  return data.access_token ?? "";
}

export async function sendPushNotification(
  topic: string,
  title: string,
  body: string,
  dataPayload: Record<string, string> = {},
): Promise<void> {
  try {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    if (!projectId) {
      console.warn("Skipping Firebase push: FIREBASE_PROJECT_ID is not configured.");
      return;
    }

    const accessToken = await getFirebaseAccessToken();
    if (!accessToken) {
      console.warn("Skipping Firebase push: Firebase service-account credentials are not configured.");
      return;
    }

    const response = await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/messages:send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          topic,
          notification: { title, body },
          data: dataPayload,
          android: { priority: "HIGH", notification: { sound: "default" } },
          apns: { payload: { aps: { sound: "default", badge: 1 } } },
        },
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      console.error("Firebase push dispatch failed with status", response.status);
    }
  } catch (error) {
    console.error("Firebase push dispatch failed:", error instanceof Error ? error.message : error);
  }
}
