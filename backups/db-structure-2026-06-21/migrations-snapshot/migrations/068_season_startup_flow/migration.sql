ALTER TABLE "player_season_state"
  ADD COLUMN "startup_intro_confirmed_season_number" INTEGER,
  ADD COLUMN "startup_completed_season_number" INTEGER,
  ADD COLUMN "faction_choice_required_season_number" INTEGER,
  ADD COLUMN "faction_choice_used_season_number" INTEGER,
  ADD COLUMN "faction_choice_used_at" TIMESTAMP(3);
