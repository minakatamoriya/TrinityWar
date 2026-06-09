UPDATE "player_field_slot"
SET "status" = 'GROWING'
WHERE "status" = 'SEEDED';

UPDATE "seed_definition"
SET "grow_seconds" = COALESCE("seed_seconds", 0) + "grow_seconds"
WHERE "seed_seconds" IS NOT NULL;

ALTER TABLE "seed_definition" DROP COLUMN "seed_seconds";

ALTER TYPE "FieldStatus" RENAME TO "FieldStatus_old";
CREATE TYPE "FieldStatus" AS ENUM ('LOCKED', 'EMPTY', 'GROWING', 'MATURE', 'WITHERED');

ALTER TABLE "player_field_slot" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "player_field_slot"
  ALTER COLUMN "status" TYPE "FieldStatus"
  USING "status"::text::"FieldStatus";
ALTER TABLE "player_field_slot" ALTER COLUMN "status" SET DEFAULT 'LOCKED';

DROP TYPE "FieldStatus_old";
