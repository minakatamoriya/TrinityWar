-- CreateTable
CREATE TABLE "faction" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "treasury_gold" INTEGER NOT NULL DEFAULT 0,
    "hourly_base_dividend" INTEGER NOT NULL DEFAULT 0,
    "hourly_contribution_dividend_per_ten" INTEGER NOT NULL DEFAULT 0,
    "contribution_score" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faction_member" (
    "id" TEXT NOT NULL,
    "faction_id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "contribution_score" INTEGER NOT NULL DEFAULT 0,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faction_member_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "faction_code_key" ON "faction"("code");

-- CreateIndex
CREATE UNIQUE INDEX "faction_name_key" ON "faction"("name");

-- CreateIndex
CREATE UNIQUE INDEX "faction_member_faction_id_player_id_key" ON "faction_member"("faction_id", "player_id");

-- CreateIndex
CREATE INDEX "faction_member_player_id_idx" ON "faction_member"("player_id");

-- AddForeignKey
ALTER TABLE "player" ADD CONSTRAINT "player_faction_id_fkey" FOREIGN KEY ("faction_id") REFERENCES "faction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faction_member" ADD CONSTRAINT "faction_member_faction_id_fkey" FOREIGN KEY ("faction_id") REFERENCES "faction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faction_member" ADD CONSTRAINT "faction_member_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
