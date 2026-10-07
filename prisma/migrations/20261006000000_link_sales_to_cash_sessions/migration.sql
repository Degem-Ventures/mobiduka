ALTER TABLE "Device"
ADD COLUMN "currentCashSessionId" TEXT;

ALTER TABLE "Sale"
ADD COLUMN "cashSessionId" TEXT;

CREATE INDEX "Device_currentCashSessionId_idx"
ON "Device"("currentCashSessionId");

CREATE INDEX "Sale_cashSessionId_idx"
ON "Sale"("cashSessionId");

ALTER TABLE "Device"
ADD CONSTRAINT "Device_currentCashSessionId_fkey"
FOREIGN KEY ("currentCashSessionId") REFERENCES "CashSession"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Sale"
ADD CONSTRAINT "Sale_cashSessionId_fkey"
FOREIGN KEY ("cashSessionId") REFERENCES "CashSession"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
