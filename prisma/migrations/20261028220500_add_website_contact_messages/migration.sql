CREATE TABLE "WebsiteContactMessage" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "businessType" TEXT,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "emailSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WebsiteContactMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WebsiteContactMessage_status_createdAt_idx"
ON "WebsiteContactMessage"("status", "createdAt");

CREATE INDEX "WebsiteContactMessage_createdAt_idx"
ON "WebsiteContactMessage"("createdAt");
