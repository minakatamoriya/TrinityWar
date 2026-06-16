CREATE TABLE "admin_operation_audit_log" (
  "id" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "target_type" TEXT NOT NULL,
  "target_id" TEXT NOT NULL,
  "admin_actor" TEXT NOT NULL DEFAULT 'admin-console',
  "reason" TEXT NOT NULL,
  "confirm_text" TEXT NOT NULL,
  "metadata_json" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "admin_operation_audit_log_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "admin_operation_audit_log_action_created_at_idx"
ON "admin_operation_audit_log"("action", "created_at");

CREATE INDEX "admin_operation_audit_log_target_type_target_id_idx"
ON "admin_operation_audit_log"("target_type", "target_id");
