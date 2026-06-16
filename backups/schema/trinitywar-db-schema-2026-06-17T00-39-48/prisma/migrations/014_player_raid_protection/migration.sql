ALTER TABLE "player"
ADD COLUMN "protected_until" TIMESTAMP(3);

CREATE INDEX "player_protected_until_idx" ON "player"("protected_until");
