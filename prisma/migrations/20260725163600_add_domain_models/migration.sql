-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "telegramId" BIGINT NOT NULL,
    "isBot" BOOLEAN NOT NULL DEFAULT false,
    "firstName" TEXT,
    "username" TEXT,
    "languageCode" TEXT,
    "isPremium" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Tracking" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "channelUsername" TEXT,
    "channelTitle" TEXT,
    "intervalHours" INTEGER NOT NULL,
    "lastSeenMessageId" INTEGER NOT NULL,
    "lastCheckedAt" DATETIME,
    "nextCheckAt" DATETIME NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Tracking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Keyword" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trackingId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "normalizedValue" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Keyword_trackingId_fkey" FOREIGN KEY ("trackingId") REFERENCES "Tracking" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Delivery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trackingId" TEXT NOT NULL,
    "channelMessageId" INTEGER NOT NULL,
    "deliveredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveryType" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Delivery_trackingId_fkey" FOREIGN KEY ("trackingId") REFERENCES "Tracking" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_telegramId_key" ON "User"("telegramId");

-- CreateIndex
CREATE INDEX "Tracking_isActive_nextCheckAt_idx" ON "Tracking"("isActive", "nextCheckAt");

-- CreateIndex
CREATE UNIQUE INDEX "Tracking_userId_channelId_key" ON "Tracking"("userId", "channelId");

-- CreateIndex
CREATE UNIQUE INDEX "Keyword_trackingId_normalizedValue_key" ON "Keyword"("trackingId", "normalizedValue");

-- CreateIndex
CREATE UNIQUE INDEX "Delivery_trackingId_channelMessageId_key" ON "Delivery"("trackingId", "channelMessageId");
