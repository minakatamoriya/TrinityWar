-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('WECHAT', 'DEV_FAKE');

-- CreateTable
CREATE TABLE "player" (
    "id" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "avatar_url" TEXT,
    "faction_id" TEXT,
    "castle_level_cache" INTEGER NOT NULL DEFAULT 1,
    "last_login_at" TIMESTAMP(3),
    "state_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_auth_identity" (
    "id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "provider" "AuthProvider" NOT NULL,
    "provider_user_id" TEXT NOT NULL,
    "union_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_auth_identity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "player_faction_id_idx" ON "player"("faction_id");

-- CreateIndex
CREATE INDEX "player_last_login_at_idx" ON "player"("last_login_at");

-- CreateIndex
CREATE UNIQUE INDEX "player_auth_identity_provider_provider_user_id_key" ON "player_auth_identity"("provider", "provider_user_id");

-- CreateIndex
CREATE INDEX "player_auth_identity_player_id_idx" ON "player_auth_identity"("player_id");

-- AddForeignKey
ALTER TABLE "player_auth_identity" ADD CONSTRAINT "player_auth_identity_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
