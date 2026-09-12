import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface SyncRecord {
  id: string;
  entityName: "Category" | "Supplier" | "Product" | "Customer" | "Sale" | "Expense";
  operation: "CREATE" | "UPDATE" | "DELETE";
  payload: any;
  createdAt: string;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { businessId, deviceId, userId, records } = body as {
      businessId: string;
      deviceId: string;
      userId: string;
      records: SyncRecord[];
    };

    if (!businessId || !records || !Array.isArray(records)) {
      return NextResponse.json(
        { error: "Bad Request. Missing multi-tenant parameters or record entries." },
        { status: 400 },
      );
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { status: true },
    });

    if (!business || business.status === "SUSPENDED") {
      return NextResponse.json(
        { error: "Unauthorized access. Invalid or suspended store account license." },
        { status: 403 },
      );
    }

    const processedIds: string[] = [];

    await prisma.$transaction(async (tx) => {
      const sortedRecords = [...records].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );

      for (const record of sortedRecords) {
        const { entityName, operation, payload, id: clientRecordId } = record;
        const dataPayload = { ...payload, businessId };

        switch (entityName) {
          case "Product": {
            if (operation === "CREATE" || operation === "UPDATE") {
              await tx.product.upsert({
                where: { id: dataPayload.id },
                create: dataPayload,
                update: { ...dataPayload, updatedAt: new Date() },
              });
            } else if (operation === "DELETE") {
              await tx.product.update({
                where: { id: dataPayload.id },
                data: { deletedAt: new Date(), syncStatus: "SYNCED" },
              });
            }
            break;
          }

          case "Sale": {
            if (operation === "CREATE") {
              const { items, ...saleData } = dataPayload;
              const existingSale = await tx.sale.findUnique({ where: { id: saleData.id } });

              if (!existingSale) {
                const createdSale = await tx.sale.create({
                  data: {
                    ...saleData,
                    businessId,
                    saleStatus: saleData.saleStatus ?? "OPEN",
                    paymentStatus: saleData.paymentStatus ?? "PENDING",
                  },
                });

                if (items && Array.isArray(items)) {
                  await tx.saleItem.createMany({
                    data: items.map((item: any) => ({
                      saleId: createdSale.id,
                      productId: item.productId,
                      quantity: Number(item.quantity ?? 0),
                      unitPrice: Number(item.unitPrice ?? 0),
                      discount: Number(item.discount ?? 0),
                      tax: Number(item.tax ?? 0),
                      total: Number(item.total ?? 0),
                    })),
                  });

                  for (const item of items) {
                    await tx.inventory.upsert({
                      where: { productId: item.productId },
                      create: {
                        businessId,
                        productId: item.productId,
                        quantity: 0,
                        reservedQuantity: 0,
                      },
                      update: {
                        quantity: { decrement: Number(item.quantity ?? 0) },
                      },
                    });
                  }
                }
              }
            }
            break;
          }

          case "Customer": {
            if (operation === "CREATE" || operation === "UPDATE") {
              await tx.customer.upsert({
                where: { id: dataPayload.id },
                create: dataPayload,
                update: dataPayload,
              });
            }
            break;
          }

          case "Category": {
            if (operation === "CREATE" || operation === "UPDATE") {
              await tx.category.upsert({
                where: { id: dataPayload.id },
                create: dataPayload,
                update: dataPayload,
              });
            }
            break;
          }

          case "Supplier": {
            if (operation === "CREATE" || operation === "UPDATE") {
              await tx.supplier.upsert({
                where: { id: dataPayload.id },
                create: dataPayload,
                update: dataPayload,
              });
            }
            break;
          }

          case "Expense": {
            if (operation === "CREATE") {
              await tx.expense.create({ data: dataPayload });
            }
            break;
          }

          default:
            throw new Error(`Unsupported ledger entity: ${entityName}`);
        }

        await tx.syncQueue.create({
          data: {
            businessId,
            tableName: entityName,
            recordId: dataPayload.id,
            operation,
            status: "PROCESSED",
            deviceId: deviceId ?? null,
          },
        });

        processedIds.push(clientRecordId);
      }

      await tx.auditLog.create({
        data: {
          businessId,
          userId,
          action: "DEVICE_SYNC",
          tableName: "sync_queue",
          recordId: deviceId,
          deviceId,
          timestamp: new Date(),
        },
      });
    });

    return NextResponse.json(
      {
        success: true,
        timestamp: new Date().toISOString(),
        processedCount: processedIds.length,
        processedIds,
      },
      { status: 200 },
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "Atomic transaction batch synchronization processing failed.",
        details: error.message,
      },
      { status: 500 },
    );
  }
}
