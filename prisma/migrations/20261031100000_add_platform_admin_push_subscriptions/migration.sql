CREATE TABLE "PlatformAdminNotificationSubscription" (
    "id" TEXT NOT NULL,
    "platformAdminId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformAdminNotificationSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlatformAdminNotificationSubscription_token_key"
    ON "PlatformAdminNotificationSubscription"("token");

CREATE INDEX "PlatformAdminNotificationSubscription_platformAdminId_idx"
    ON "PlatformAdminNotificationSubscription"("platformAdminId");

ALTER TABLE "PlatformAdminNotificationSubscription"
    ADD CONSTRAINT "PlatformAdminNotificationSubscription_platformAdminId_fkey"
    FOREIGN KEY ("platformAdminId") REFERENCES "PlatformAdmin"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;