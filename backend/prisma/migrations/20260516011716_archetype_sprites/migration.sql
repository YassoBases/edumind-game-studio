-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "archetype" TEXT,
ADD COLUMN     "imageCostUsdMillicents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "themeId" TEXT;

-- CreateTable
CREATE TABLE "SpriteCache" (
    "cacheKey" TEXT NOT NULL,
    "archetype" TEXT NOT NULL,
    "themeId" TEXT NOT NULL,
    "conceptId" TEXT,
    "role" TEXT NOT NULL,
    "base64Data" TEXT NOT NULL,
    "promptUsed" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "hitCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpriteCache_pkey" PRIMARY KEY ("cacheKey")
);

-- CreateIndex
CREATE INDEX "SpriteCache_archetype_themeId_idx" ON "SpriteCache"("archetype", "themeId");

-- CreateIndex
CREATE INDEX "Game_archetype_themeId_idx" ON "Game"("archetype", "themeId");
