import { NextResponse } from "next/server.js";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const callback = body?.Body?.stkCallback;
    const checkoutRequestId = callback?.CheckoutRequestID;
    const resultCode = Number(callback?.ResultCode);

    if (!callback || !checkoutRequestId || !Number.isInteger(resultCode)) {
      return NextResponse.json({ ResultCode: 0, ResultDesc: "Callback acknowledged." });
    }

    const transaction = await prisma.mpesaTransaction.findUnique({
      where: { checkoutRequestId },
    });

    if (!transaction) {
      return NextResponse.json({ ResultCode: 0, ResultDesc: "Unknown callback acknowledged." });
    }

    const items = Array.isArray(callback.CallbackMetadata?.Item) ? callback.CallbackMetadata.Item : [];
    const metadata = new Map(items.map((item: { Name: string; Value?: unknown }) => [item.Name, item.Value]));
    const succeeded = resultCode === 0;
    const receiptNumber = metadata.get("MpesaReceiptNumber");

    await prisma.$transaction(async (tx) => {
      await tx.mpesaTransaction.update({
        where: { checkoutRequestId },
        data: {
          status: succeeded ? "COMPLETED" : "FAILED",
          resultCode,
          resultDescription: callback.ResultDesc || null,
          receiptNumber: typeof receiptNumber === "string" ? receiptNumber : null,
        },
      });
      await tx.auditLog.create({
        data: {
          businessId: transaction.businessId,
          action: succeeded ? "MPESA_PAYMENT_COMPLETED" : "MPESA_PAYMENT_FAILED",
          tableName: "MpesaTransaction",
          recordId: transaction.id,
        },
      });
    });

    return NextResponse.json({ ResultCode: 0, ResultDesc: "Callback processed successfully." });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to process Safaricom callback.", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
