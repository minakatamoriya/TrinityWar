CREATE TABLE "player_plant_research" (
  "id" TEXT NOT NULL,
  "player_id" TEXT NOT NULL,
  "seed_definition_id" TEXT NOT NULL,
  "discovered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "research_version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "player_plant_research_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "player_plant_research_player_id_seed_definition_id_key"
  ON "player_plant_research"("player_id", "seed_definition_id");

CREATE INDEX "player_plant_research_player_id_idx"
  ON "player_plant_research"("player_id");

ALTER TABLE "player_plant_research"
  ADD CONSTRAINT "player_plant_research_player_id_fkey"
  FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "player_plant_research"
  ADD CONSTRAINT "player_plant_research_seed_definition_id_fkey"
  FOREIGN KEY ("seed_definition_id") REFERENCES "seed_definition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "player_plant_research" (
  "id",
  "player_id",
  "seed_definition_id",
  "discovered_at",
  "research_version",
  "created_at",
  "updated_at"
)
SELECT
  'plant_research_' || psi."id",
  psi."player_id",
  psi."seed_definition_id",
  COALESCE(psi."unlocked_at", psi."created_at", CURRENT_TIMESTAMP),
  1,
  COALESCE(psi."created_at", CURRENT_TIMESTAMP),
  CURRENT_TIMESTAMP
FROM "player_seed_inventory" psi
WHERE psi."quantity" > 0 OR psi."unlocked_at" IS NOT NULL
ON CONFLICT ("player_id", "seed_definition_id") DO NOTHING;
