UPDATE "spirit_definition"
SET "role" = 'HEALTH'
WHERE "role" = 'DEFENSE';

ALTER TABLE "spirit_definition"
DROP COLUMN "base_defense",
DROP COLUMN "growth_defense";

ALTER TYPE "SpiritRole" RENAME TO "SpiritRole_old";
CREATE TYPE "SpiritRole" AS ENUM ('ATTACK', 'BALANCED', 'HEALTH');

ALTER TABLE "spirit_definition"
ALTER COLUMN "role" TYPE "SpiritRole"
USING "role"::text::"SpiritRole";

DROP TYPE "SpiritRole_old";
