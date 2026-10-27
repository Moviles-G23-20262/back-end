-- AlterTable
ALTER TABLE "Material" ADD COLUMN     "clientId" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "Material_clientId_key" ON "Material"("clientId");
