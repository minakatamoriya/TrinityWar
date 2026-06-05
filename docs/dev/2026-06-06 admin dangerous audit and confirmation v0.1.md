# 2026-06-06 Admin Dangerous Audit And Confirmation v0.1

## Scope

P1-5 has been closed for the current launch-hardening pass.

Covered operations:

- Delete player.
- Delete seed definition.
- Delete spirit definition.
- Send admin notification with resource attachments.

Deferred operations remain out of scope:

- Manual generation of specified season rewards.
- Backfill missing season rewards.
- Revoke unclaimed season rewards.

## Implementation

### Database

Added `admin_operation_audit_log`.

Migration:

```powershell
services/game-server/prisma/migrations/052_admin_operation_audit_log/migration.sql
```

Model:

```prisma
model AdminOperationAuditLog
```

The table records:

- `action`
- `target_type`
- `target_id`
- `admin_actor`
- `reason`
- `confirm_text`
- `metadata_json`
- `created_at`

### Backend Confirmation Rules

Delete operations require:

- `reason`: 4-200 characters.
- `confirmText`: exactly equal to the target id.

Attachment notification operations require:

- `reason`: 4-200 characters.
- `confirmText`: `SEND_ATTACHMENT_NOTIFICATION`.

Backend audited actions:

- `delete-player`
- `delete-seed-definition`
- `delete-spirit-definition`
- `create-global-notification-with-attachments`
- `create-player-notification-with-attachments`

### Frontend

The admin console now sends audit payloads for dangerous operations.

Existing browser confirmation dialogs remain in place for:

- Player deletion.
- Seed definition deletion.
- Spirit definition deletion.

Additional confirmation is now shown before sending notifications with attachments.

## Verification

Commands run on 2026-06-06:

```powershell
npm run prisma:generate --workspace @trinitywar/game-server
npm run build --workspace @trinitywar/shared
npm run prisma:validate --workspace @trinitywar/game-server
npx prisma migrate deploy --schema prisma/schema.prisma
npm run verify:admin-dangerous-audit --workspace @trinitywar/game-server
npm run build --workspace @trinitywar/game-admin
npm run build --workspace @trinitywar/game-server
```

Note: `npx prisma migrate deploy --schema prisma/schema.prisma` was run from `services/game-server` so the local `.env` was loaded.

Verification result:

```json
{
  "ok": true,
  "auditedActions": [
    "create-player-notification-with-attachments",
    "delete-player"
  ]
}
```

The verification script also checks:

- Attachment notification without confirmation is rejected with `400`.
- Player deletion with wrong confirmation is rejected with `400`.
- Seed and spirit delete confirmation guards reject mismatched confirmation text before mutation.

## Residual Risk

The current audit actor is fixed as `admin-console` because the project still uses debug-header admin access instead of a full operator identity system.

Future production admin auth should replace or supplement this with a real operator id.
