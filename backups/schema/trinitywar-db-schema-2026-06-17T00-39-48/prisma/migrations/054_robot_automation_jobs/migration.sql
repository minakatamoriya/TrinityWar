CREATE TABLE "robot_automation_job" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "mode" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'RUNNING',
  "interval_seconds" INTEGER NOT NULL,
  "max_rounds" INTEGER NOT NULL,
  "hard_error_limit" INTEGER NOT NULL,
  "completed_rounds" INTEGER NOT NULL DEFAULT 0,
  "consecutive_hard_errors" INTEGER NOT NULL DEFAULT 0,
  "last_run_id" TEXT,
  "last_status" TEXT,
  "last_error" TEXT,
  "stop_reason" TEXT,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "stopped_at" TIMESTAMP(3),
  "last_run_at" TIMESTAMP(3),
  "next_run_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "robot_automation_job_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "robot_automation_job_mode_status_started_at_idx" ON "robot_automation_job"("mode", "status", "started_at");
CREATE INDEX "robot_automation_job_status_started_at_idx" ON "robot_automation_job"("status", "started_at");
