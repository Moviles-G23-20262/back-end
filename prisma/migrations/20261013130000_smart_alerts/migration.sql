-- CreateTable
CREATE TABLE "SmartAlert" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "keyword" TEXT NOT NULL DEFAULT '',
    "courseCode" TEXT,
    "category" "MaterialCategory",
    "maxPrice" DECIMAL(10,2) NOT NULL,
    "minCondition" "MaterialCondition",
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmartAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SmartAlert_userId_idx" ON "SmartAlert"("userId");

-- CreateIndex
CREATE INDEX "SmartAlert_enabled_idx" ON "SmartAlert"("enabled");

-- AddForeignKey
ALTER TABLE "SmartAlert" ADD CONSTRAINT "SmartAlert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

