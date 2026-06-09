ALTER TABLE "player_season_reward_grant"
  ADD COLUMN "notification_id" TEXT;

CREATE INDEX "player_season_reward_grant_notification_id_idx"
  ON "player_season_reward_grant"("notification_id");

ALTER TABLE "player_season_reward_grant"
  ADD CONSTRAINT "player_season_reward_grant_notification_id_fkey"
  FOREIGN KEY ("notification_id") REFERENCES "player_notification"("id") ON DELETE SET NULL ON UPDATE CASCADE;
