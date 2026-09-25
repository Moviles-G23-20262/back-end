-- CreateEnum
CREATE TYPE "MeetingZoneType" AS ENUM ('LIBRARY', 'STUDENT_CENTER', 'BUILDING_LOBBY', 'PLAZA');

-- AlterTable
ALTER TABLE "Exchange" ADD COLUMN     "lat" DOUBLE PRECISION,
ADD COLUMN     "lng" DOUBLE PRECISION,
ADD COLUMN     "meetingPointId" UUID;

-- CreateTable
CREATE TABLE "MeetingPoint" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "detail" TEXT,
    "zoneType" "MeetingZoneType" NOT NULL,
    "isMonitored" BOOLEAN NOT NULL DEFAULT false,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeetingPoint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Exchange_meetingPointId_idx" ON "Exchange"("meetingPointId");

-- AddForeignKey
ALTER TABLE "Exchange" ADD CONSTRAINT "Exchange_meetingPointId_fkey" FOREIGN KEY ("meetingPointId") REFERENCES "MeetingPoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

