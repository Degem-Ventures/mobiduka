import crypto from "node:crypto";
import { NextResponse } from "next/server.js";
import { prisma } from "@/lib/prisma";
import { requireBusinessAccess } from "@/lib/auth";
import { createSystemNotification } from "@/lib/notifications";

interface SyncRecord {
  id: string;
  entityName:
    | "Category"
    | "Supplier"
    | "Product"
    | "Customer"
    | "Sale"
    | "Expense"
    | "Credit"
    | "Employee"
    | "CashSession"
    | "PurchaseOrder"
    | "ScanEvent"
    | "MpesaSmsReceipt"
    | "SettingsProfile";
  operation: "CREATE" | "UPDATE" | "DELETE";
  payloadHash?: string;
  payload: any;
  externalId?: string;
  createdAt: string;
}

function computePayloadHash(payload: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(payload ?? {})).digest("hex");
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

    const resolvedBusinessId = requireBusinessAccess(request, businessId);

    if (!resolvedBusinessId || !records || !Array.isArray(records)) {
      return NextResponse.json(
        { error: "Authenticated business context is required." },
        { status: 401 },
      );
    }

    const business = await prisma.business.findUnique({
      where: { id: resolvedBusinessId },
      select: { status: true },
    });

    if (!business) {
      return NextResponse.json(
        { error: "Invalid businessId. The store account was not found." },
        { status: 400 },
      );
    }

    if (business.status === "SUSPENDED") {
      return NextResponse.json(
        { error: "Unauthorized access. Invalid or suspended store account license." },
        { status: 403 },
      );
    }

    const resolvedDeviceId = await prisma.device.findFirst({
      where: {
        OR: [{ id: deviceId }, { deviceUuid: deviceId }],
        businessId: resolvedBusinessId,
      },
      select: { id: true },
    });

    const resolvedUserId = userId
      ? await prisma.user.findFirst({
          where: {
            id: userId,
            businessId: resolvedBusinessId,
          },
          select: { id: true },
        }).then((user) => user?.id ?? null)
      : null;

    const effectiveDeviceId = resolvedDeviceId?.id ?? null;
    const processedIds: string[] = [];
    const syncedSales: Array<{ id: string; saleNumber: string; total: number }> = [];

    await prisma.$transaction(async (tx) => {
      const sortedRecords = [...records].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );

      for (const record of sortedRecords) {
        const entityName = record.entityName;
        const operation = record.operation;
        const payload = record.payload ?? {};
        const clientRecordId = record.id;
        const externalId = String(record.externalId ?? record.id ?? "").trim();
        const payloadHash = String(record.payloadHash ?? computePayloadHash(payload)).trim();

        if (!clientRecordId || !externalId) {
          throw new Error(`Record for ${entityName} is missing a valid externalId.`);
        }

        const receiptKey = {
          businessId: resolvedBusinessId,
          entityName,
          // A receipt represents one immutable outbox event. Keeping the
          // entity ID separate allows OPEN and CLOSE (or later edits) for the
          // same local entity to synchronize independently.
          externalId: clientRecordId,
        };

        const existingReceipt = await tx.syncReceipt.findUnique({
          where: {
            businessId_entityName_externalId: receiptKey,
          },
        });

        if (existingReceipt) {
          if (existingReceipt.payloadHash === payloadHash) {
            processedIds.push(clientRecordId);
            continue;
          }
          throw new Error(`Payload collision for sync record ${clientRecordId}. Duplicate outbox event with divergent payload.`);
        }

        await tx.syncReceipt.create({
          data: {
            businessId: resolvedBusinessId,
            entityName,
            externalId: clientRecordId,
            payloadHash,
            status: "RECEIVED",
            sourceDeviceId: effectiveDeviceId ?? deviceId ?? null,
          },
        });

        const dataPayload: Record<string, any> = { ...payload, businessId: resolvedBusinessId };

        switch (entityName) {
          case "Product": {
            if (operation === "CREATE" || operation === "UPDATE") {
              const productId = String(dataPayload.id ?? externalId);
              const productData = {
                name: String(dataPayload.name ?? "").trim(),
                categoryId: dataPayload.categoryId || null,
                supplierId: dataPayload.supplierId || null,
                barcode: dataPayload.barcode || null,
                sku: dataPayload.sku || null,
                description: dataPayload.description || null,
                unit: dataPayload.unit || null,
                emoji: dataPayload.emoji || null,
                costPrice: Number(dataPayload.costPrice ?? 0),
                sellingPrice: Number(dataPayload.sellingPrice ?? dataPayload.price ?? 0),
                minimumStock: Number(dataPayload.minimumStock ?? dataPayload.reorder ?? 0),
                trackStock: dataPayload.trackStock !== false,
                status: dataPayload.status ?? "ACTIVE",
                deletedAt: null,
                syncStatus: "SYNCED",
              };
              if (!productData.name) throw new Error("Invalid offline product payload.");
              await tx.product.upsert({
                where: { id: productId },
                create: { id: productId, businessId: resolvedBusinessId, ...productData },
                update: { ...productData, updatedAt: new Date() },
              });
              if (dataPayload.stock !== undefined && Number.isFinite(Number(dataPayload.stock))) {
                await tx.inventory.upsert({
                  where: { productId },
                  create: {
                    businessId: resolvedBusinessId,
                    productId,
                    quantity: Number(dataPayload.stock),
                    reservedQuantity: 0,
                  },
                  update: { quantity: Number(dataPayload.stock) },
                });
              }
            } else if (operation === "DELETE") {
              await tx.product.updateMany({
                where: { id: String(dataPayload.id ?? externalId), businessId: resolvedBusinessId },
                data: { deletedAt: new Date(), syncStatus: "SYNCED" },
              });
            }
            break;
          }

          case "Sale": {
            if (operation === "CREATE") {
              const { items } = dataPayload;
              const saleId = String(dataPayload.id ?? externalId);
              const existingSale = await tx.sale.findUnique({ where: { id: saleId } });

              if (!existingSale) {
                const createdSale = await tx.sale.create({
                  data: {
                    id: saleId,
                    businessId: resolvedBusinessId,
                    cashierId: dataPayload.cashierId ?? dataPayload.userId ?? null,
                    customerId: dataPayload.customerId ?? null,
                    saleNumber: dataPayload.saleNumber ?? null,
                    subtotal: Number(dataPayload.subtotal ?? 0),
                    discount: Number(dataPayload.discount ?? 0),
                    tax: Number(dataPayload.tax ?? 0),
                    total: Number(dataPayload.total ?? 0),
                    saleStatus: dataPayload.saleStatus ?? "OPEN",
                    paymentStatus: dataPayload.paymentStatus ?? "PENDING",
                    createdAt: dataPayload.createdAt ? new Date(dataPayload.createdAt) : new Date(record.createdAt),
                  },
                });

                if (items && Array.isArray(items)) {
                  const validItems = items
                    .filter((item: unknown): item is Record<string, unknown> => !!item && typeof item === "object")
                    .filter((item) => typeof item.productId === "string" && Number(item.quantity ?? item.qty) > 0);
                  if (validItems.length !== items.length) {
                    throw new Error("Offline sale contains an item without a product ID or quantity.");
                  }
                  await tx.saleItem.createMany({
                    data: validItems.map((item) => ({
                      saleId: createdSale.id,
                      productId: String(item.productId),
                      quantity: Number(item.quantity ?? item.qty ?? 0),
                      unitPrice: Number(item.unitPrice ?? 0),
                      discount: Number(item.discount ?? 0),
                      tax: Number(item.tax ?? 0),
                      total: Number(item.total ?? 0),
                    })),
                  });

                  for (const item of validItems) {
                    await tx.inventory.upsert({
                      where: { productId: String(item.productId) },
                      create: {
                        businessId: resolvedBusinessId,
                        productId: String(item.productId),
                        quantity: 0,
                        reservedQuantity: 0,
                      },
                      update: {
                        quantity: { decrement: Number(item.quantity ?? item.qty ?? 0) },
                      },
                    });
                  }
                }
                if (createdSale.saleStatus === "COMPLETED") {
                  syncedSales.push({
                    id: createdSale.id,
                    saleNumber: createdSale.saleNumber ?? createdSale.id,
                    total: Number(createdSale.total),
                  });
                }
              }
            }
            break;
          }

          case "Customer": {
            if (operation === "CREATE" || operation === "UPDATE") {
              const customer = await tx.customer.upsert({
                where: { id: externalId },
                create: {
                  id: externalId,
                  businessId: resolvedBusinessId,
                  name: String(dataPayload.name ?? "").trim(),
                  phone: dataPayload.phone || null,
                  email: dataPayload.email || null,
                  location: dataPayload.location || null,
                  creditLimit: Number(dataPayload.creditLimit ?? dataPayload.initialCreditLimit ?? 0),
                  status: dataPayload.status ?? "ACTIVE",
                },
                update: {
                  name: String(dataPayload.name ?? "").trim(),
                  phone: dataPayload.phone || null,
                  email: dataPayload.email || null,
                  location: dataPayload.location || null,
                  creditLimit: Number(dataPayload.creditLimit ?? dataPayload.initialCreditLimit ?? 0),
                  status: dataPayload.status ?? "ACTIVE",
                },
              });
              await tx.creditAccount.upsert({
                where: { customerId: customer.id },
                create: { customerId: customer.id, balance: 0, status: "ACTIVE" },
                update: {},
              });
            }
            break;
          }

          case "Category": {
            if (operation === "CREATE" || operation === "UPDATE") {
              await tx.category.upsert({
                where: { id: dataPayload.id },
                create: dataPayload as any,
                update: dataPayload as any,
              });
            }
            break;
          }

          case "Supplier": {
            if (operation === "CREATE" || operation === "UPDATE") {
              const supplierId = String(dataPayload.id ?? externalId);
              const supplierData = {
                businessId: resolvedBusinessId,
                name: String(dataPayload.name ?? "").trim(),
                category: dataPayload.category || null,
                phone: dataPayload.phone || null,
                email: dataPayload.email || null,
                location: dataPayload.location || null,
                contactPerson: dataPayload.contactPerson ?? dataPayload.contact ?? null,
                notes: dataPayload.notes || null,
              };
              if (!supplierData.name) throw new Error("Invalid offline supplier payload.");
              await tx.supplier.upsert({
                where: { id: supplierId },
                create: { id: supplierId, ...supplierData },
                update: supplierData,
              });
            }
            break;
          }

          case "Expense": {
            if (operation === "CREATE" || operation === "UPDATE") {
              const expenseData = {
                category: dataPayload.category || null,
                description: String(dataPayload.description ?? "").trim(),
                amount: Number(dataPayload.amount ?? 0),
                paymentMethod: dataPayload.paymentMethod || null,
                icon: dataPayload.icon || null,
                recurring: Boolean(dataPayload.recurring),
                paidTo: dataPayload.paidTo || null,
                recordedBy: dataPayload.userId || dataPayload.recordedBy || null,
                createdAt: dataPayload.date ? new Date(dataPayload.date) : new Date(record.createdAt),
              };
              if (!expenseData.description || !Number.isFinite(expenseData.amount) || expenseData.amount <= 0) {
                throw new Error("Invalid offline expense payload.");
              }
              await tx.expense.upsert({
                where: { id: externalId },
                create: { id: externalId, businessId: resolvedBusinessId, ...expenseData },
                update: expenseData,
              });
            }
            break;
          }

          case "Credit": {
            const creditCustomer = await tx.customer.findFirst({
              where: { id: dataPayload.customerId, businessId: resolvedBusinessId },
              select: { id: true },
            });

            if (!creditCustomer || !["RECORD_PAYMENT", "RECORD_SALE"].includes(dataPayload.action)) {
              throw new Error("Invalid credit repayment customer or action.");
            }

            const account = await tx.creditAccount.findUnique({
              where: { customerId: dataPayload.customerId },
            });
            const paymentAmount = Number(dataPayload.amount);

            if (dataPayload.action === "RECORD_SALE") {
              if (!account || !Number.isFinite(paymentAmount) || paymentAmount <= 0) {
                throw new Error("Invalid credit sale customer or amount.");
              }

              await tx.creditAccount.update({
                where: { customerId: dataPayload.customerId },
                data: {
                  balance: { increment: paymentAmount },
                  status: "ACTIVE",
                },
              });
              await tx.creditLedgerEntry.create({
                data: {
                  id: dataPayload.id,
                  businessId: resolvedBusinessId,
                  customerId: dataPayload.customerId,
                  type: "SALE",
                  amount: paymentAmount,
                  status: "PENDING",
                },
              });
              break;
            }

            if (!account || !Number.isFinite(paymentAmount) || paymentAmount <= 0 || paymentAmount > account.balance) {
              throw new Error("Credit repayment exceeds the outstanding balance.");
            }

            const nextBalance = account.balance - paymentAmount;
            await tx.creditAccount.update({
              where: { customerId: dataPayload.customerId },
              data: {
                balance: nextBalance,
                lastPayment: new Date(),
                status: nextBalance === 0 ? "CLEARED" : "ACTIVE",
              },
            });
            await tx.creditLedgerEntry.create({
              data: {
                id: dataPayload.id,
                businessId: resolvedBusinessId,
                customerId: dataPayload.customerId,
                type: "PAYMENT",
                amount: paymentAmount,
                status: "COMPLETED",
              },
            });
            break;
          }

          case "Employee": {
            if (operation !== "CREATE" && operation !== "UPDATE") break;
            const employeeRole = String(dataPayload.role ?? "CASHIER").toUpperCase();
            if (!["ADMIN", "OWNER", "SUPERVISOR", "CASHIER", "STOCK_KEEPER", "ACCOUNTANT"].includes(employeeRole)) {
              throw new Error("Invalid employee role.");
            }
            const role = await tx.role.upsert({
              where: { name: employeeRole },
              update: {},
              create: { name: employeeRole },
            });
            await tx.user.upsert({
              where: { id: externalId },
              create: {
                id: externalId,
                businessId: resolvedBusinessId,
                fullName: dataPayload.fullName,
                email: dataPayload.email || null,
                phone: dataPayload.phone || null,
                roleId: role.id,
                status: dataPayload.status ?? "ACTIVE",
              },
              update: {
                fullName: dataPayload.fullName,
                email: dataPayload.email || null,
                phone: dataPayload.phone || null,
                roleId: role.id,
                status: dataPayload.status ?? "ACTIVE",
                updatedAt: new Date(),
              },
            });
            break;
          }

          case "CashSession": {
            const action = String(dataPayload.action ?? "").toUpperCase();
            const sessionId: string = String(dataPayload.sessionId ?? dataPayload.id ?? externalId);
            if (!dataPayload.userId || !["OPEN", "CLOSE"].includes(action)) {
              throw new Error("Invalid offline cash session payload.");
            }
            const existingSession = await tx.cashSession.findUnique({
              where: { id: sessionId },
              select: { businessId: true },
            });
            if (existingSession && existingSession.businessId !== resolvedBusinessId) {
              throw new Error("Cash session belongs to another business.");
            }
            if (action === "OPEN") {
              await tx.cashSession.upsert({
                where: { id: sessionId },
                create: {
                  id: sessionId,
                  businessId: resolvedBusinessId,
                  cashierId: dataPayload.userId,
                  shiftTypeId: dataPayload.shiftTypeId || null,
                  openingBalance: Number(dataPayload.openingCash ?? 0),
                  openedAt: dataPayload.openedAt ? new Date(dataPayload.openedAt) : new Date(record.createdAt),
                },
                update: {},
              });
            } else {
              const closingCash = Number(dataPayload.closingCash);
              if (!Number.isFinite(closingCash)) throw new Error("Invalid offline closing cash amount.");
              const result = await tx.cashSession.updateMany({
                where: { id: sessionId, businessId: resolvedBusinessId },
                data: {
                  closingBalance: closingCash,
                  expectedBalance: dataPayload.expectedBalance == null ? undefined : Number(dataPayload.expectedBalance),
                  variance: dataPayload.variance == null ? undefined : Number(dataPayload.variance),
                  closedAt: dataPayload.closedAt ? new Date(dataPayload.closedAt) : new Date(record.createdAt),
                },
              });
              if (result.count !== 1) throw new Error("Offline cash session was not found.");
            }
            break;
          }

          case "MpesaSmsReceipt": {
            const receiptCode = String(dataPayload.receiptCode ?? dataPayload.id ?? externalId)
              .trim()
              .toUpperCase();
            const amount = Number(dataPayload.amount);
            if (!/^[A-Z0-9]{10}$/.test(receiptCode) || !Number.isFinite(amount) || amount <= 0) {
              throw new Error("Invalid offline M-Pesa receipt payload.");
            }
            await tx.mpesaSmsReceipt.upsert({
              where: {
                businessId_receiptCode: {
                  businessId: resolvedBusinessId,
                  receiptCode,
                },
              },
              create: {
                businessId: resolvedBusinessId,
                receiptCode,
                senderPhone: dataPayload.senderPhone || null,
                customerName: dataPayload.customerName || null,
                amount,
                customerId: dataPayload.customerId || null,
                isMatched: dataPayload.isMatched === true,
                createdAt: dataPayload.createdAt ? new Date(dataPayload.createdAt) : new Date(record.createdAt),
              },
              update: {},
            });
            break;
          }

          case "PurchaseOrder": {
            if (operation !== "CREATE" && operation !== "UPDATE") break;
            const receive = String(dataPayload.action ?? "").toUpperCase() === "RECEIVE";
            const purchaseOrder = await tx.purchaseOrder.upsert({
              where: { id: externalId },
              create: {
                id: externalId,
                businessId: resolvedBusinessId,
                supplierId: dataPayload.supplierId || null,
                orderNo: dataPayload.orderNo || null,
                status: receive ? "RECEIVED" : dataPayload.status ?? "REQUESTED",
                totalCost: Number(dataPayload.totalCost ?? 0),
                dueDate: dataPayload.dueDate ? new Date(dataPayload.dueDate) : null,
                createdAt: dataPayload.createdAt ? new Date(dataPayload.createdAt) : new Date(record.createdAt),
              },
              update: {
                supplierId: dataPayload.supplierId || null,
                orderNo: dataPayload.orderNo || null,
                status: receive ? "RECEIVED" : dataPayload.status ?? "REQUESTED",
                totalCost: Number(dataPayload.totalCost ?? 0),
                dueDate: dataPayload.dueDate ? new Date(dataPayload.dueDate) : null,
              },
            });
            if (Array.isArray(dataPayload.items)) {
              await tx.purchaseItem.deleteMany({ where: { purchaseOrderId: purchaseOrder.id } });
              const items = dataPayload.items
                .filter((item: unknown): item is Record<string, unknown> => !!item && typeof item === "object")
                .filter((item: Record<string, unknown>) => typeof item.productId === "string" && Number(item.quantity) > 0)
                .map((item: Record<string, unknown>) => ({
                  purchaseOrderId: purchaseOrder.id,
                  productId: item.productId as string,
                  quantity: Math.trunc(Number(item.quantity)),
                  costPrice: Number(item.costPrice ?? 0),
                }));
              if (items.length > 0) await tx.purchaseItem.createMany({ data: items });
              if (receive && items.length > 0) {
                for (const item of items) {
                  await tx.inventory.upsert({
                    where: { productId: item.productId },
                    create: { businessId: resolvedBusinessId, productId: item.productId, quantity: item.quantity, reservedQuantity: 0 },
                    update: { quantity: { increment: item.quantity } },
                  });
                }
              }
            }
            break;
          }

          case "SettingsProfile": {
            const allowedPreferences = ["receiptPrint", "lowStockAlerts", "salesNotifications", "dailyReport", "autoBackup", "mpesaEnabled"];
            const preferenceData = Object.fromEntries(
              allowedPreferences
                .filter((key) => typeof dataPayload[key] === "boolean")
                .map((key) => [key, dataPayload[key]]),
            );
            const settingsData = {
              ...preferenceData,
              ...(typeof dataPayload.themeMode === "string" && ["light", "dark", "auto"].includes(dataPayload.themeMode)
                ? { themeMode: dataPayload.themeMode }
                : {}),
              ...(dataPayload.paymentConfig !== undefined ? { paymentConfig: dataPayload.paymentConfig } : {}),
            };
            if (dataPayload.currency !== undefined || dataPayload.taxPin !== undefined) {
              await tx.business.update({
                where: { id: resolvedBusinessId },
                data: {
                  ...(dataPayload.currency !== undefined ? { currency: dataPayload.currency } : {}),
                  ...(dataPayload.taxPin !== undefined ? { kraPin: dataPayload.taxPin || null } : {}),
                },
              });
            }
            if (Object.keys(settingsData).length > 0) {
              await tx.businessSettings.upsert({
                where: { businessId: resolvedBusinessId },
                create: { businessId: resolvedBusinessId, ...settingsData },
                update: settingsData,
              });
            }
            break;
          }

          case "ScanEvent": {
            if (operation !== "CREATE") break;
            const barcode = String(dataPayload.barcode ?? "").trim();
            if (!barcode) throw new Error("Offline scan event is missing a barcode.");
            await tx.scanEvent.upsert({
              where: { id: externalId },
              create: {
                id: externalId,
                businessId: resolvedBusinessId,
                productId: dataPayload.productId || null,
                barcode,
                name: String(dataPayload.name ?? "Unknown product").trim(),
                status: String(dataPayload.status ?? "MANUAL").toUpperCase(),
                emoji: dataPayload.emoji || null,
                createdAt: dataPayload.createdAt ? new Date(dataPayload.createdAt) : new Date(record.createdAt),
              },
              update: {},
            });
            break;
          }

          default:
            throw new Error(`Unsupported ledger entity: ${entityName}`);
        }

        await tx.syncReceipt.update({
          where: {
            businessId_entityName_externalId: receiptKey,
          },
          data: { status: "APPLIED" },
        });

        await tx.syncQueue.create({
          data: {
            businessId: resolvedBusinessId,
            tableName: entityName,
            recordId: dataPayload.id,
            operation,
            status: "PROCESSED",
            deviceId: effectiveDeviceId ?? null,
          },
        });

        processedIds.push(clientRecordId);
      }

      await tx.auditLog.create({
        data: {
          businessId: resolvedBusinessId,
          userId: resolvedUserId,
          action: "DEVICE_SYNC",
          tableName: "sync_queue",
          recordId: deviceId,
          deviceId,
          timestamp: new Date(),
        },
      });
    });

    await Promise.all(syncedSales.map((sale) => createSystemNotification({
      businessId: resolvedBusinessId,
      type: "success",
      title: "Sale Completed",
      body: `Sale ${sale.saleNumber} was completed for KSh ${sale.total.toLocaleString("en-KE")}.`,
      eventKey: `sale:${sale.id}`,
      preference: "salesNotifications",
    })));

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
