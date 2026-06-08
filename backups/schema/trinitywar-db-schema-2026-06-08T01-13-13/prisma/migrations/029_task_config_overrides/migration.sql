CREATE TABLE "task_config_override" (
  "id" TEXT NOT NULL,
  "task_group" TEXT NOT NULL,
  "task_id" TEXT NOT NULL,
  "title" TEXT,
  "description" TEXT,
  "target_count" INTEGER,
  "reward_gold" INTEGER,
  "reward_contribution" INTEGER,
  "is_enabled" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "task_config_override_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "task_config_override_task_group_task_id_key"
  ON "task_config_override"("task_group", "task_id");

CREATE INDEX "task_config_override_task_group_is_enabled_idx"
  ON "task_config_override"("task_group", "is_enabled");
