CREATE TABLE "robot_test_run" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "mode" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'RUNNING',
  "planned_robot_count" INTEGER NOT NULL DEFAULT 0,
  "success_action_count" INTEGER NOT NULL DEFAULT 0,
  "failed_action_count" INTEGER NOT NULL DEFAULT 0,
  "summary" TEXT,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finished_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "robot_test_run_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "robot_action_log" (
  "id" TEXT NOT NULL,
  "run_id" TEXT NOT NULL,
  "robot_key" TEXT NOT NULL,
  "robot_role" TEXT NOT NULL,
  "player_id" TEXT NOT NULL,
  "action_name" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "duration_ms" INTEGER NOT NULL DEFAULT 0,
  "error_code" TEXT,
  "error_message" TEXT,
  "request_summary_json" JSONB,
  "result_summary_json" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "robot_action_log_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "robot_test_run_status_started_at_idx" ON "robot_test_run"("status", "started_at");
CREATE INDEX "robot_test_run_mode_started_at_idx" ON "robot_test_run"("mode", "started_at");
CREATE INDEX "robot_action_log_run_id_created_at_idx" ON "robot_action_log"("run_id", "created_at");
CREATE INDEX "robot_action_log_robot_key_created_at_idx" ON "robot_action_log"("robot_key", "created_at");
CREATE INDEX "robot_action_log_player_id_created_at_idx" ON "robot_action_log"("player_id", "created_at");
CREATE INDEX "robot_action_log_status_created_at_idx" ON "robot_action_log"("status", "created_at");

ALTER TABLE "robot_action_log"
  ADD CONSTRAINT "robot_action_log_run_id_fkey"
  FOREIGN KEY ("run_id") REFERENCES "robot_test_run"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "robot_action_log"
  ADD CONSTRAINT "robot_action_log_player_id_fkey"
  FOREIGN KEY ("player_id") REFERENCES "player"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
