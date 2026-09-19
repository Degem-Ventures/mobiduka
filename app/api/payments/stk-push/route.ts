import { NextResponse } from "next/server.js";
import { prisma } from "@/lib/prisma";
import { requireBusinessAccess } from "@/lib/auth";

const tokenUrl = "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials";
const stkPushUrl = "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest";

function normalizePhone(value: unknown) {
  if (typeof value !== "string") return null;
  let phone = value.trim().replace(/^\+/, "");
  if (phone.startsWith("0")) phone = `254${phone.slice(1)}`;
  return /^254(?:7|1)\d{8}$/.test(phone) ? phone : null;
}

function timestamp() {
  const now = new Date();
  const parts = [
    now.getUTCFullYear(),
    now.getUTCMonth() + 1,
    now.getUTCDate(),
    now.getUTCHours(),
    now.getUTCMinutes(),
    now.getUTCSeconds(),
  ];
  return parts.map((part) => String(part).padStart(2, "0")).join("");
}

async function getMpesaToken() {
  const key = process.env.MPESA_CONSUMER_KEY;
  const secret = process.env.MPESA_CONSUMER_SECRET;
  if (!key || !secret) throw new Error("M-Pesa OAuth credentials are not configured.");

  const response = await fetch(tokenUrl, {
    headers: {
      Authorization: `Basic ${Buffer.from(`${key}:${secret}`).toString("base64")}`,
    },
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) {
    throw new Error(data.errorMessage || "Safaricom OAuth token request failed.");
  }
  return data.access_token as string;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { phoneNumber, amount, accountReference, businessId } = body;
    const resolvedBusinessId = requireBusinessAccess(request, businessId);
    const shortcode = process.env.MPESA_SHORTCODE || "174379";
    const transactionType = "CustomerPayBillOnline";
    const partyB = shortcode;
    const passkey = process.env.MPESA_PASSKEY;
    const callbackUrl = process.env.MPESA_CALLBACK_URL;
    const parsedAmount = Number(amount);
    const phone = normalizePhone(phoneNumber);

    if (!resolvedBusinessId || !phone || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json(
        { error: "Authenticated business context, a valid Kenyan phone number, and a positive amount are required." },
        { status: 401 },
      );
    }
    if (!passkey || !callbackUrl) {
      return NextResponse.json({ error: "M-Pesa configuration is incomplete." }, { status: 500 });
    }

    const business = await prisma.business.findUnique({ where: { id: resolvedBusinessId }, select: { id: true } });
    if (!business) return NextResponse.json({ error: "Business was not found." }, { status: 404 });

    const token = await getMpesaToken();
    const requestTimestamp = timestamp();
    const reference = String(accountReference || "MobiDuka POS Checkout").slice(0, 12);
    const password = Buffer.from(`${shortcode}${passkey}${requestTimestamp}`).toString("base64");
    const darajaResponse = await fetch(stkPushUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: requestTimestamp,
        TransactionType: transactionType,
        Amount: Math.round(parsedAmount),
        PartyA: phone,
        PartyB: partyB,
        PhoneNumber: phone,
        CallBackURL: callbackUrl,
        AccountReference: reference,
        TransactionDesc: "MobiDuka Retail Checkout Payment",
      }),
    });

    const result = await darajaResponse.json();
    if (!darajaResponse.ok || result.ResponseCode !== "0") {
      return NextResponse.json(
        {
          success: false,
          error: result.errorMessage || result.ResponseDescription || "Safaricom rejected the STK request.",
          darajaResult: result,
        },
        { status: 502 },
      );
    }

    const transaction = await prisma.mpesaTransaction.create({
      data: {
        businessId: resolvedBusinessId,
        phoneNumber: phone,
        amount: Math.round(parsedAmount),
        accountReference: reference,
        merchantRequestId: result.MerchantRequestID,
        checkoutRequestId: result.CheckoutRequestID,
      },
    });

    return NextResponse.json({
      success: true,
      transactionId: transaction.id,
      transactionType,
      darajaResult: result,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Safaricom integration failed.", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
