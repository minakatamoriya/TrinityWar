CREATE TABLE "spirit_shop_purchase_log" (
  "id" TEXT NOT NULL,
  "player_id" TEXT NOT NULL,
  "item_id" TEXT NOT NULL,
  "period_key" TEXT,
  "consumed_tianji_talisman" INTEGER NOT NULL,
  "reward_json" JSONB NOT NULL,
  "request_idempotency_key" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "spirit_shop_purchase_log_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "spirit_shop_purchase_log_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "spirit_shop_purchase_log_player_id_item_id_period_key_idx"
  ON "spirit_shop_purchase_log"("player_id", "item_id", "period_key");

CREATE TABLE "spirit_ad_reward_log" (
  "id" TEXT NOT NULL,
  "player_id" TEXT NOT NULL,
  "date_key" TEXT NOT NULL,
  "tianji_talisman_reward" INTEGER NOT NULL,
  "bonus_reward_json" JSONB NOT NULL,
  "request_idempotency_key" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "spirit_ad_reward_log_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "spirit_ad_reward_log_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "spirit_ad_reward_log_player_id_date_key_idx"
  ON "spirit_ad_reward_log"("player_id", "date_key");
