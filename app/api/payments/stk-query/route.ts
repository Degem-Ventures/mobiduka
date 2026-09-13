import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const tokenUrl = "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials";
const queryUrl = "https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query";

function timestamp() {
  const now = new Date();
  return [
    now.getUTCFullYear(),
    now.getUTCMonth() + 1,
    now.getUTCDate(),
    now.getUTCHours(),
    now.getUTCMinutes(),
    now.getUTCSeconds(),
  ].map((part) => String(part).padStart(2, "0")).join("");
}

async function getMpesaToken() {
  const key = process.env.MPESA_CONSUMER_KEY;
  const secret = process.env.MPESA_CONSUMER_SECRET;
  if (!key || !secret) throw new Error("M-Pesa OAuth credentials are not configured.");

  const response = await fetch(tokenUrl, {
    headers: { Authorization: `Basic ${Buffer.from(`${key}:${secret}`).toString("base64")}` },
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) throw new Error(data.errorMessage || "Safaricom OAuth token request failed.");
  return data.access_token as string;
}

export async function POST(request: Request) {
  try {
    const { checkoutRequestId } = await request.json();
    if (!checkoutRequestId || typeof checkoutRequestId !== "string") {
      return NextResponse.json({ error: "Checkout Request ID is required." }, { status: 400 });
    }

    const transaction = await prisma.mpesaTransaction.findUnique({ where: { checkoutRequestId } });
    if (!transaction) return NextResponse.json({ error: "M-Pesa transaction was not found." }, { status: 404 });

    if (transaction.status === "COMPLETED") {
      return NextResponse.json({ source: "webhook_cache", status: "SUCCESS", receipt: transaction.receiptNumber });
    }
    if (transaction.status === "FAILED") {
      return NextResponse.json({ source: "webhook_cache", status: "FAILED", message: transaction.resultDescription });
    }

    const shortcode = process.env.MPESA_SHORTCODE || "174379";
    const passkey = process.env.MPESA_PASSKEY;
    if (!passkey) return NextResponse.json({ error: "M-Pesa configuration is incomplete." }, { status: 500 });

    const requestTimestamp = timestamp();
    const token = await getMpesaToken();
    const darajaResponse = await fetch(queryUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        BusinessShortCode: shortcode,
        Password: Buffer.from(`${shortcode}${passkey}${requestTimestamp}`).toString("base64"),
        Timestamp: requestTimestamp,
        CheckoutRequestID: checkoutRequestId,
      }),
    });
    const result = await darajaResponse.json();
    const resultCode = result.ResultCode?.toString();

    if (resultCode === "0") {
      await prisma.mpesaTransaction.update({
        where: { checkoutRequestId },
        data: { status: "COMPLETED", resultCode: 0, resultDescription: result.ResultDesc || "Success" },
      });
      return NextResponse.json({ source: "live_query", status: "SUCCESS", message: result.ResultDesc });
    }
    if (resultCode === "1032") {
      await prisma.mpesaTransaction.update({
        where: { checkoutRequestId },
        data: { status: "FAILED", resultCode: 1032, resultDescription: "User cancelled the request." },
      });
      return NextResponse.json({ source: "live_query", status: "CANCELLED", message: "User cancelled the request." });
    }
    if (result.ResponseCode === "0" && !result.ResultCode) {
      return NextResponse.json({ source: "live_query", status: "PENDING", message: "Awaiting user input on handset." });
    }

    return NextResponse.json({ source: "live_query", status: "FAILED", message: result.ResultDesc || "Transaction failed." });
  } catch (error) {
    return NextResponse.json(
      { error: "STK status query failed.", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
