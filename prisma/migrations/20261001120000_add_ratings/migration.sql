-- CreateTable
CREATE TABLE "Rating" (
    "id" UUID NOT NULL,
    "exchangeId" UUID NOT NULL,
    "raterId" UUID NOT NULL,
    "ratedId" UUID NOT NULL,
    "stars" INTEGER NOT NULL,
    "tags" TEXT[],
    "review" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Rating_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Rating_ratedId_idx" ON "Rating"("ratedId");

-- CreateIndex
CREATE UNIQUE INDEX "Rating_exchangeId_raterId_key" ON "Rating"("exchangeId", "raterId");

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_exchangeId_fkey" FOREIGN KEY ("exchangeId") REFERENCES "Exchange"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_raterId_fkey" FOREIGN KEY ("raterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_ratedId_fkey" FOREIGN KEY ("ratedId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;