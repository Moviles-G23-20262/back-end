-- AlterTable
ALTER TABLE "Exchange" ADD COLUMN     "buyerConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "sellerConfirmedAt" TIMESTAMP(3);
