-- CreateEnum
CREATE TYPE "ExchangeStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('TEXT', 'MEETING');

-- CreateEnum
CREATE TYPE "MeetingProposalStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED');

-- DropIndex
DROP INDEX "Exchange_materialId_key";

-- AlterTable
ALTER TABLE "Exchange" ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "meetingEndsAt" TIMESTAMP(3),
ADD COLUMN     "meetingStartsAt" TIMESTAMP(3),
ADD COLUMN     "orderNumber" SERIAL NOT NULL,
ADD COLUMN     "receivedCondition" "MaterialCondition",
ADD COLUMN     "status" "ExchangeStatus" NOT NULL DEFAULT 'PENDING',
ALTER COLUMN "completedAt" DROP NOT NULL,
ALTER COLUMN "completedAt" DROP DEFAULT;

-- Exchanges recorded before orders existed were already finished sales.
UPDATE "Exchange" SET "status" = 'COMPLETED', "createdAt" = "completedAt";

-- Order numbers start at 1001 so they read like "CSW-1001".
UPDATE "Exchange" SET "orderNumber" = "orderNumber" + 1000;
SELECT setval(pg_get_serial_sequence('"Exchange"', 'orderNumber'), GREATEST((SELECT MAX("orderNumber") FROM "Exchange"), 1000));

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "meetingProposalId" UUID,
ADD COLUMN     "type" "MessageType" NOT NULL DEFAULT 'TEXT';

-- CreateTable
CREATE TABLE "MeetingProposal" (
    "id" UUID NOT NULL,
    "chatRoomId" UUID NOT NULL,
    "proposerId" UUID NOT NULL,
    "meetingPointId" UUID NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" "MeetingProposalStatus" NOT NULL DEFAULT 'PENDING',
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeetingProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleBlock" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduleBlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MeetingProposal_chatRoomId_createdAt_idx" ON "MeetingProposal"("chatRoomId", "createdAt");

-- CreateIndex
CREATE INDEX "MeetingProposal_meetingPointId_idx" ON "MeetingProposal"("meetingPointId");

-- CreateIndex
CREATE INDEX "ScheduleBlock_userId_dayOfWeek_idx" ON "ScheduleBlock"("userId", "dayOfWeek");

-- CreateIndex
CREATE UNIQUE INDEX "Exchange_orderNumber_key" ON "Exchange"("orderNumber");

-- CreateIndex
CREATE INDEX "Exchange_materialId_idx" ON "Exchange"("materialId");

-- CreateIndex
CREATE INDEX "Exchange_status_idx" ON "Exchange"("status");

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_meetingProposalId_fkey" FOREIGN KEY ("meetingProposalId") REFERENCES "MeetingProposal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingProposal" ADD CONSTRAINT "MeetingProposal_chatRoomId_fkey" FOREIGN KEY ("chatRoomId") REFERENCES "ChatRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingProposal" ADD CONSTRAINT "MeetingProposal_proposerId_fkey" FOREIGN KEY ("proposerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingProposal" ADD CONSTRAINT "MeetingProposal_meetingPointId_fkey" FOREIGN KEY ("meetingPointId") REFERENCES "MeetingPoint"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleBlock" ADD CONSTRAINT "ScheduleBlock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

