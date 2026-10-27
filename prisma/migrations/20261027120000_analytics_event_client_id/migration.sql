-- AlterTable
ALTER TABLE "AnalyticsEvent" ADD COLUMN     "clientCreatedAt" TIMESTAMP(3),
ADD COLUMN     "clientId" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "AnalyticsEvent_clientId_key" ON "AnalyticsEvent"("clientId");
