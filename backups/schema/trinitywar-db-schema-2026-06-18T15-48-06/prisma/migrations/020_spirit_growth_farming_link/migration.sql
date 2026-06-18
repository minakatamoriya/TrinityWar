ALTER TABLE "player_spirit_resource"
  ADD COLUMN "spirit_root" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "spirit_marrow" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "spirit_jade" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "ordinary_soul" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "rare_soul" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "legendary_soul" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "player_spirit_slot"
  ADD COLUMN "breakthrough_stage" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "satiated_until" TIMESTAMP(3),
  ADD COLUMN "last_exp_settled_at" TIMESTAMP(3);

CREATE TABLE "player_spirit_trait" (
  "id" TEXT NOT NULL,
  "spirit_slot_id" TEXT NOT NULL,
  "slot_index" INTEGER NOT NULL,
  "trait_code" TEXT NOT NULL,
  "trait_value" INTEGER NOT NULL,
  "source_type" TEXT NOT NULL,
  "locked_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "player_spirit_trait_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "spirit_feed_log" (
  "id" TEXT NOT NULL,
  "player_id" TEXT NOT NULL,
  "spirit_slot_id" TEXT NOT NULL,
  "action_type" TEXT NOT NULL,
  "feed_count" INTEGER NOT NULL,
  "satiated_seconds_added" INTEGER NOT NULL,
  "immediate_exp_gain" INTEGER NOT NULL,
  "before_satiated_until" TIMESTAMP(3),
  "after_satiated_until" TIMESTAMP(3),
  "request_idempotency_key" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "spirit_feed_log_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "spirit_breakthrough_log" (
  "id" TEXT NOT NULL,
  "player_id" TEXT NOT NULL,
  "spirit_slot_id" TEXT NOT NULL,
  "from_stage" INTEGER NOT NULL,
  "to_stage" INTEGER NOT NULL,
  "consumed_soul_quality" TEXT NOT NULL,
  "consumed_soul_count" INTEGER NOT NULL,
  "request_idempotency_key" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "spirit_breakthrough_log_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "spirit_trait_roll_log" (
  "id" TEXT NOT NULL,
  "player_id" TEXT NOT NULL,
  "spirit_slot_id" TEXT NOT NULL,
  "mode" TEXT NOT NULL,
  "locked_slot_index" INTEGER,
  "target_slot_index" INTEGER,
  "target_trait_code" TEXT,
  "consumed_json" JSONB NOT NULL,
  "before_traits_json" JSONB NOT NULL,
  "result_traits_json" JSONB NOT NULL,
  "candidate_results_json" JSONB,
  "request_idempotency_key" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "spirit_trait_roll_log_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "player_spirit_trait_spirit_slot_id_slot_index_key" ON "player_spirit_trait"("spirit_slot_id", "slot_index");
CREATE INDEX "player_spirit_trait_spirit_slot_id_idx" ON "player_spirit_trait"("spirit_slot_id");
CREATE INDEX "player_spirit_trait_trait_code_idx" ON "player_spirit_trait"("trait_code");

CREATE INDEX "spirit_feed_log_player_id_created_at_idx" ON "spirit_feed_log"("player_id", "created_at");
CREATE INDEX "spirit_feed_log_spirit_slot_id_idx" ON "spirit_feed_log"("spirit_slot_id");
CREATE INDEX "spirit_feed_log_request_idempotency_key_idx" ON "spirit_feed_log"("request_idempotency_key");

CREATE INDEX "spirit_breakthrough_log_player_id_created_at_idx" ON "spirit_breakthrough_log"("player_id", "created_at");
CREATE INDEX "spirit_breakthrough_log_spirit_slot_id_idx" ON "spirit_breakthrough_log"("spirit_slot_id");
CREATE INDEX "spirit_breakthrough_log_request_idempotency_key_idx" ON "spirit_breakthrough_log"("request_idempotency_key");

CREATE INDEX "spirit_trait_roll_log_player_id_created_at_idx" ON "spirit_trait_roll_log"("player_id", "created_at");
CREATE INDEX "spirit_trait_roll_log_spirit_slot_id_idx" ON "spirit_trait_roll_log"("spirit_slot_id");
CREATE INDEX "spirit_trait_roll_log_request_idempotency_key_idx" ON "spirit_trait_roll_log"("request_idempotency_key");

ALTER TABLE "player_spirit_trait" ADD CONSTRAINT "player_spirit_trait_spirit_slot_id_fkey" FOREIGN KEY ("spirit_slot_id") REFERENCES "player_spirit_slot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "spirit_feed_log" ADD CONSTRAINT "spirit_feed_log_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "spirit_feed_log" ADD CONSTRAINT "spirit_feed_log_spirit_slot_id_fkey" FOREIGN KEY ("spirit_slot_id") REFERENCES "player_spirit_slot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "spirit_breakthrough_log" ADD CONSTRAINT "spirit_breakthrough_log_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "spirit_breakthrough_log" ADD CONSTRAINT "spirit_breakthrough_log_spirit_slot_id_fkey" FOREIGN KEY ("spirit_slot_id") REFERENCES "player_spirit_slot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "spirit_trait_roll_log" ADD CONSTRAINT "spirit_trait_roll_log_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "spirit_trait_roll_log" ADD CONSTRAINT "spirit_trait_roll_log_spirit_slot_id_fkey" FOREIGN KEY ("spirit_slot_id") REFERENCES "player_spirit_slot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
