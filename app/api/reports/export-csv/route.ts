import { NextResponse } from "next/server.js"
import { authenticatedBusinessId } from "@/lib/auth"
import { toCsvRow } from "@/lib/csv"
import { prisma } from "@/lib/prisma"
import { requireBusinessPermission } from "@/lib/permissions"

export const runtime = "nodejs"

const batchSize = 500
const headers = [
  "Transaction ID",
  "Order Reference",
  "Timestamp (UTC)",
  "Cashier",
  "Customer",
  "Customer Phone",
  "Subtotal",
  "Discount",
  "Tax",
  "Total",
  "Payment Status",
  "Sale Status",
  "Items",
  "Payments",
]

function parseDateParameter(value: string | null, parameterName: string) {
  if (value === null) return { date: null, error: null }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return { date: null, error: `${parameterName} must use YYYY-MM-DD format.` }
  }

  const date = new Date(`${value}T00:00:00.000Z`)
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    return {
      date: null,
      error: `${parameterName} is not a valid calendar date.`,
    }
  }
  return { date, error: null }
}

function saleCsvRow(
  sale: {
    id: string
    saleNumber: string | null
    createdAt: Date
    cashier: { businessId: string; fullName: string } | null
    customer: { businessId: string; name: string; phone: string | null } | null
    subtotal: number
    discount: number
    tax: number
    total: number
    paymentStatus: string
    saleStatus: string
    items: Array<{
      quantity: number
      unitPrice: number
      total: number
      product: { businessId: string; name: string }
    }>
    payments: Array<{
      amount: number
      reference: string | null
      receivedAt: Date
      paymentMethod: { name: string }
    }>
  },
  businessId: string,
) {
  const items = sale.items
    .filter((item) => item.product.businessId === businessId)
    .map(
      (item) =>
        `${item.product.name} x${item.quantity} @ ${item.unitPrice} = ${item.total}`,
    )
    .join("; ")
  const payments = sale.payments
    .map((payment) =>
      [
        payment.paymentMethod.name,
        payment.amount,
        payment.reference,
        payment.receivedAt.toISOString(),
      ]
        .filter((value) => value !== null && value !== "")
        .join(" | "),
    )
    .join("; ")

  return toCsvRow([
    sale.id,
    sale.saleNumber ?? "",
    sale.createdAt,
    sale.cashier?.businessId === businessId ? sale.cashier.fullName : "",
    sale.customer?.businessId === businessId ? sale.customer.name : "",
    sale.customer?.businessId === businessId ? (sale.customer.phone ?? "") : "",
    sale.subtotal,
    sale.discount,
    sale.tax,
    sale.total,
    sale.paymentStatus,
    sale.saleStatus,
    items,
    payments,
  ])
}

const saleSelect = {
  id: true,
  saleNumber: true,
  createdAt: true,
  subtotal: true,
  discount: true,
  tax: true,
  total: true,
  paymentStatus: true,
  saleStatus: true,
  cashier: { select: { businessId: true, fullName: true } },
  customer: { select: { businessId: true, name: true, phone: true } },
  items: {
    select: {
      quantity: true,
      unitPrice: true,
      total: true,
      product: { select: { businessId: true, name: true } },
    },
  },
  payments: {
    select: {
      amount: true,
      reference: true,
      receivedAt: true,
      paymentMethod: { select: { name: true } },
    },
  },
} as const

export async function GET(request: Request) {
  try {
    const businessId = authenticatedBusinessId(request)
    if (!businessId) {
      return NextResponse.json(
        { error: "Authenticated business context is required." },
        { status: 401 },
      )
    }
    const access = await requireBusinessPermission(
      request,
      businessId,
      "export",
    )
    if (!access) {
      return NextResponse.json(
        {
          error:
            "Business export permission is required to download the sales ledger.",
        },
        { status: 403 },
      )
    }

    const { searchParams } = new URL(request.url)
    const fromResult = parseDateParameter(searchParams.get("from"), "from")
    const toResult = parseDateParameter(searchParams.get("to"), "to")
    if (fromResult.error || toResult.error) {
      return NextResponse.json({ error: fromResult.error ?? toResult.error }, {
        status: 400,
      })
    }
    if (fromResult.date && toResult.date && fromResult.date > toResult.date) {
      return NextResponse.json(
        { error: "The from date must be on or before the to date." },
        { status: 400 },
      )
    }

    const where = {
      businessId,
      ...(fromResult.date || toResult.date
        ? {
            createdAt: {
              ...(fromResult.date ? { gte: fromResult.date } : {}),
              ...(toResult.date
                ? {
                    lt: new Date(toResult.date.getTime() + 24 * 60 * 60 * 1000),
                  }
                : {}),
            },
          }
        : {}),
    }

    const firstPage = await prisma.sale.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: batchSize,
      select: saleSelect,
    })
    if (firstPage.length === 0) {
      return NextResponse.json(
        {
          error:
            "No transaction entries were found for this business and date range.",
        },
        { status: 404 },
      )
    }

    const filename = `MobiDuka_Sales_Ledger_${new Date().toISOString().slice(0, 10)}.csv`
    const encoder = new TextEncoder()
    let page = firstPage
    let rowIndex = 0
    let cursor: string | undefined
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        controller.enqueue(encoder.encode(`\uFEFF${toCsvRow(headers)}`))
      },
      async pull(controller) {
        try {
          if (rowIndex >= page.length) {
            if (page.length < batchSize) {
              controller.close()
              return
            }
            cursor = page[page.length - 1].id
            page = await prisma.sale.findMany({
              where,
              orderBy: [{ createdAt: "desc" }, { id: "desc" }],
              take: batchSize,
              skip: 1,
              cursor: { id: cursor },
              select: saleSelect,
            })
            rowIndex = 0
            if (page.length === 0) {
              controller.close()
              return
            }
          }

          const end = Math.min(rowIndex + 50, page.length)
          while (rowIndex < end) {
            controller.enqueue(
              encoder.encode(saleCsvRow(page[rowIndex], businessId)),
            )
            rowIndex += 1
          }
          if (rowIndex === page.length && page.length < batchSize) {
            controller.close()
          }
        } catch (error) {
          console.error("Unable to stream the sales CSV export.", error)
          controller.error(
            new Error("The sales CSV export could not be completed."),
          )
        }
      },
    })

    return new Response(stream, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch (error) {
    console.error("Unable to generate the sales CSV export.", error)
    return NextResponse.json(
      { error: "Unable to generate the sales CSV export." },
      { status: 500 },
    )
  }
}
