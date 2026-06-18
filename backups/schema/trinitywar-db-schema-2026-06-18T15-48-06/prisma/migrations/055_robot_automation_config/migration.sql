CREATE TABLE "robot_automation_config" (
  "id" TEXT NOT NULL,
  "mode" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "interval_seconds" INTEGER NOT NULL DEFAULT 10,
  "max_rounds" INTEGER NOT NULL DEFAULT 20,
  "hard_error_limit" INTEGER NOT NULL DEFAULT 3,
  "auto_start_on_boot" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "robot_automation_config_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "robot_automation_config_mode_key" ON "robot_automation_config"("mode");
CREATE INDEX "robot_automation_config_enabled_mode_idx" ON "robot_automation_config"("enabled", "mode");

INSERT INTO "robot_automation_config" (
  "id",
  "mode",
  "enabled",
  "interval_seconds",
  "max_rounds",
  "hard_error_limit",
  "auto_start_on_boot",
  "updated_at"
) VALUES (
  'robot-automation-config-daily-3',
  'daily-3',
  false,
  10,
  20,
  3,
  false,
  CURRENT_TIMESTAMP
) ON CONFLICT ("mode") DO NOTHING;
