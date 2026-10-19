import { randomUUID } from "node:crypto"
import { prisma } from "@/lib/prisma"

export type MpesaIntegrationRecord = {
  id: string
  businessId: string
  environment: string
  accountType: string
  shortcode: string
  partyB: string | null
  accountReference: string | null
  credentialCiphertext: string
  updatedAt: Date
}

type MpesaIntegrationInput = Pick<
  MpesaIntegrationRecord,
  | "businessId"
  | "environment"
  | "accountType"
  | "shortcode"
  | "partyB"
  | "accountReference"
  | "credentialCiphertext"
>

type MpesaIntegrationDelegate = {
  findUnique: (args: unknown) => Promise<MpesaIntegrationRecord | null>
  findFirst: (args: unknown) => Promise<MpesaIntegrationRecord | null>
  upsert: (args: unknown) => Promise<MpesaIntegrationRecord>
}

type MpesaIntegrationDatabase = {
  mpesaIntegration?: MpesaIntegrationDelegate
  $queryRaw: <T,>(
    query: TemplateStringsArray,
    ...values: unknown[]
  ) => Promise<T>
  $executeRaw: (
    query: TemplateStringsArray,
    ...values: unknown[]
  ) => Promise<number>
}

function database(client: unknown): MpesaIntegrationDatabase {
  return client as MpesaIntegrationDatabase
}

/**
 * Uses the generated delegate when available, with a parameterized SQL fallback
 * for development servers that were started before `prisma generate` ran.
 */
export async function findMpesaIntegration(
  businessId: string,
  options: { environment?: string; integrationId?: string | null } = {},
  client: unknown = prisma,
): Promise<MpesaIntegrationRecord | null> {
  const db = database(client)
  if (db.mpesaIntegration) {
    if (options.integrationId) {
      return db.mpesaIntegration.findFirst({
        where: { id: options.integrationId, businessId },
      })
    }
    if (options.environment) {
      return db.mpesaIntegration.findUnique({
        where: {
          businessId_environment: {
            businessId,
            environment: options.environment,
          },
        },
      })
    }
    const sandbox = await db.mpesaIntegration.findFirst({
      where: { businessId, environment: "sandbox" },
    })
    if (sandbox) return sandbox
    const production = await db.mpesaIntegration.findFirst({
      where: { businessId, environment: "production" },
    })
    if (production) return production
    return db.mpesaIntegration.findFirst({ where: { businessId } })
  }

  const rows = options.integrationId
    ? await db.$queryRaw<MpesaIntegrationRecord[]>`
        SELECT "id", "businessId", "environment", "accountType", "shortcode", "partyB",
          "accountReference", "credentialCiphertext", "updatedAt"
        FROM "MpesaIntegration"
        WHERE "id" = ${options.integrationId} AND "businessId" = ${businessId}
        LIMIT 1
      `
    : options.environment
      ? await db.$queryRaw<MpesaIntegrationRecord[]>`
          SELECT "id", "businessId", "environment", "accountType", "shortcode", "partyB",
            "accountReference", "credentialCiphertext", "updatedAt"
          FROM "MpesaIntegration"
          WHERE "businessId" = ${businessId} AND "environment" = ${options.environment}
          LIMIT 1
        `
    : await db.$queryRaw<MpesaIntegrationRecord[]>`
        SELECT "id", "businessId", "environment", "accountType", "shortcode", "partyB",
          "accountReference", "credentialCiphertext", "updatedAt"
        FROM "MpesaIntegration"
        WHERE "businessId" = ${businessId}
        ORDER BY CASE WHEN "environment" = 'sandbox' THEN 0 ELSE 1 END
        LIMIT 1
      `
  return rows[0] ?? null
}

export async function upsertMpesaIntegration(
  input: MpesaIntegrationInput,
  client: unknown = prisma,
): Promise<MpesaIntegrationRecord> {
  const db = database(client)
  const normalizedInput = {
    ...input,
    partyB: input.partyB ?? input.shortcode,
  }

  if (db.mpesaIntegration) {
    return db.mpesaIntegration.upsert({
      where: {
        businessId_environment: {
          businessId: normalizedInput.businessId,
          environment: normalizedInput.environment,
        },
      },
      create: normalizedInput,
      update: {
        environment: normalizedInput.environment,
        accountType: normalizedInput.accountType,
        shortcode: normalizedInput.shortcode,
        partyB: normalizedInput.partyB,
        accountReference: normalizedInput.accountReference,
        credentialCiphertext: normalizedInput.credentialCiphertext,
      },
    })
  }

  const rows = await db.$queryRaw<MpesaIntegrationRecord[]>`
    INSERT INTO "MpesaIntegration" (
      "id", "businessId", "environment", "accountType", "shortcode", "partyB",
      "accountReference", "credentialCiphertext", "createdAt", "updatedAt"
    ) VALUES (
      ${randomUUID()}, ${normalizedInput.businessId}, ${normalizedInput.environment}, ${normalizedInput.accountType}, ${normalizedInput.shortcode},
      ${normalizedInput.partyB}, ${normalizedInput.accountReference}, ${normalizedInput.credentialCiphertext}, CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT ("businessId", "environment") DO UPDATE SET
      "environment" = EXCLUDED."environment",
      "accountType" = EXCLUDED."accountType",
      "shortcode" = EXCLUDED."shortcode",
      "partyB" = EXCLUDED."partyB",
      "accountReference" = EXCLUDED."accountReference",
      "credentialCiphertext" = EXCLUDED."credentialCiphertext",
      "updatedAt" = CURRENT_TIMESTAMP
    RETURNING "id", "businessId", "environment", "accountType", "shortcode", "partyB",
      "accountReference", "credentialCiphertext", "updatedAt"
  `
  const integration = rows[0]
  if (!integration) {
    throw new Error("Unable to persist the M-Pesa integration.")
  }
  return integration
}

export async function hasMpesaIntegration(
  businessId: string,
  client: unknown = prisma,
  environment?: string,
) {
  if (environment) {
    return Boolean(
      await findMpesaIntegration(businessId, { environment }, client),
    )
  }
  return Boolean(await findMpesaIntegration(businessId, {}, client))
}

export async function assignMpesaTransactionIntegration(
  transactionId: string,
  integrationId: string,
  client: unknown = prisma,
) {
  const count = await database(client).$executeRaw`
    UPDATE "MpesaTransaction"
    SET "mpesaIntegrationId" = ${integrationId}, "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${transactionId}
  `
  if (count !== 1) {
    throw new Error("Unable to attach M-Pesa configuration to the transaction.")
  }
}

export async function mpesaTransactionIntegrationId(
  transactionId: string,
  client: unknown = prisma,
) {
  const rows = await database(client).$queryRaw<{
    mpesaIntegrationId: string | null
  }[]>`
    SELECT "mpesaIntegrationId" FROM "MpesaTransaction"
    WHERE "id" = ${transactionId}
    LIMIT 1
  `
  return rows[0]?.mpesaIntegrationId ?? null
}

export function isMissingMpesaIntegrationSchema(error: unknown) {
  const details = error as {
    code?: unknown
    message?: unknown
    meta?: {
      code?: unknown
      message?: unknown
    }
  }
  const message = [details?.message, details?.meta?.message]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
  return (
    details?.code === "P2021" ||
    details?.code === "P2022" ||
    details?.meta?.code === "42P01" ||
    /(?:MpesaIntegration|mpesaIntegrationId).*(?:does not exist|no such table|missing)/i.test(
      message,
    )
  )
}
