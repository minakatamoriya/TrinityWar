-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('WECHAT', 'DEV_FAKE');

-- CreateEnum
CREATE TYPE "ArmyTrainingStatus" AS ENUM ('QUEUED', 'FINISHED', 'CLAIMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FieldStatus" AS ENUM ('LOCKED', 'EMPTY', 'GROWING', 'MATURE', 'WITHERED');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'CLAIMED');

-- CreateEnum
CREATE TYPE "DailyFactionTaskType" AS ENUM ('ESSENCE_SUBMIT_BASIC', 'ESSENCE_SUBMIT_FOCUS', 'CONFLICT_RAID');

-- CreateEnum
CREATE TYPE "RaidOrderMode" AS ENUM ('SINGLE', 'BOUNTY');

-- CreateEnum
CREATE TYPE "RaidOrderStatus" AS ENUM ('CREATED', 'LOCKED', 'SETTLING', 'SETTLED', 'SETTLEMENT_FAILED', 'CANCELLED', 'BOUNTY_CREATED', 'BOUNTY_WAITING_PARTNER', 'BOUNTY_ACCEPTED', 'BOUNTY_EXPIRED');

-- CreateEnum
CREATE TYPE "RaidAssetLockMode" AS ENUM ('SOFT', 'HARD');

-- CreateEnum
CREATE TYPE "RaidAssetLockStatus" AS ENUM ('ACTIVE', 'RELEASED', 'CONSUMED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "RaidSettlementResult" AS ENUM ('WIN', 'LOSS', 'DRAW', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BattleReportType" AS ENUM ('ATTACK', 'DEFENSE', 'BOUNTY');

-- CreateEnum
CREATE TYPE "SpiritRarity" AS ENUM ('COMMON', 'RARE', 'LEGENDARY');

-- CreateEnum
CREATE TYPE "SpiritRole" AS ENUM ('ATTACK', 'BALANCED', 'HEALTH');

-- CreateEnum
CREATE TYPE "SpiritElement" AS ENUM ('METAL', 'WOOD', 'WATER', 'FIRE', 'EARTH');

-- CreateEnum
CREATE TYPE "NotificationAudience" AS ENUM ('GLOBAL', 'PLAYER');

-- CreateEnum
CREATE TYPE "NotificationCategory" AS ENUM ('SYSTEM', 'ANNOUNCEMENT', 'MAINTENANCE', 'REWARD', 'COMPENSATION');

-- CreateEnum
CREATE TYPE "PlayerNotificationClaimStatus" AS ENUM ('NONE', 'UNCLAIMED', 'CLAIMED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SocialRelationType" AS ENUM ('FRIEND', 'FOLLOWING', 'ENEMY', 'BLOCKED');

-- CreateEnum
CREATE TYPE "SocialRelationStatus" AS ENUM ('ACTIVE', 'PENDING', 'MUTED');

-- CreateEnum
CREATE TYPE "SocialFeedType" AS ENUM ('FRIEND_WATERED_FIELD', 'FRIEND_REVIVED_FIELD', 'FRIEND_GUARDED_FIELD', 'FRIEND_REQUESTED', 'FRIEND_ACCEPTED', 'FRIEND_REJECTED', 'FRIEND_DELETED', 'TEAM_CHALLENGE_INVITED', 'TEAM_CHALLENGE_ACCEPTED', 'ENEMY_RAIDED', 'REVENGE_AVAILABLE', 'FACTION_HELP_REQUESTED');

-- CreateEnum
CREATE TYPE "SocialAssistType" AS ENUM ('WATER_FIELD', 'REVIVE_FIELD', 'HARVEST_FIELD', 'GUARD_FIELD', 'RECOVER_SPIRIT', 'FACTION_TASK_HELP');

-- CreateEnum
CREATE TYPE "TeamChallengeStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'SETTLED');

-- CreateEnum
CREATE TYPE "ShareAssistCampaignType" AS ENUM ('WATER', 'FRIEND_INVITE');

-- CreateEnum
CREATE TYPE "ShareAssistCampaignStatus" AS ENUM ('ACTIVE', 'FULL', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ShareAssistRecordAudience" AS ENUM ('GUEST', 'PLAYER');

-- CreateEnum
CREATE TYPE "ShareAssistRecordStatus" AS ENUM ('CONFIRMED', 'BOUND', 'REWARDED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PlayerInviteRelationStatus" AS ENUM ('PENDING_BIND', 'BOUND', 'TUTORIAL_COMPLETED', 'REWARDED', 'INVALID');

-- CreateTable
CREATE TABLE "player" (
    "id" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "avatar_url" TEXT,
    "faction_id" TEXT,
    "castle_level_cache" INTEGER NOT NULL DEFAULT 1,
    "last_login_at" TIMESTAMP(3),
    "protected_until" TIMESTAMP(3),
    "state_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_season" (
    "season_number" INTEGER NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "game_season_pkey" PRIMARY KEY ("season_number")
);

-- CreateTable
CREATE TABLE "player_season_state" (
    "player_id" TEXT NOT NULL,
    "current_season_number" INTEGER NOT NULL,
    "last_reset_season_number" INTEGER NOT NULL DEFAULT 1,
    "startup_intro_confirmed_season_number" INTEGER,
    "startup_completed_season_number" INTEGER,
    "faction_choice_required_season_number" INTEGER,
    "faction_choice_used_season_number" INTEGER,
    "faction_choice_used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_season_state_pkey" PRIMARY KEY ("player_id")
);

-- CreateTable
CREATE TABLE "player_season_snapshot" (
    "id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "season_number" INTEGER NOT NULL,
    "faction_id" TEXT,
    "contribution_score" INTEGER NOT NULL DEFAULT 0,
    "sign_in_days" INTEGER NOT NULL DEFAULT 0,
    "login_days" INTEGER NOT NULL DEFAULT 0,
    "harvest_count" INTEGER NOT NULL DEFAULT 0,
    "raid_count" INTEGER NOT NULL DEFAULT 0,
    "final_rank" INTEGER,
    "reward_tier" TEXT,
    "snapshot_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_season_snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_season_sign_in" (
    "id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "season_number" INTEGER NOT NULL,
    "day_index" INTEGER NOT NULL,
    "reward_tianji_talisman" INTEGER NOT NULL,
    "claimed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_season_sign_in_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_season_activity" (
    "id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "season_number" INTEGER NOT NULL,
    "date_key" TEXT NOT NULL,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_season_activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_season_reward_grant" (
    "id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "season_number" INTEGER NOT NULL,
    "reward_type" TEXT NOT NULL,
    "reward_tier" TEXT,
    "status" TEXT NOT NULL DEFAULT 'generated',
    "notification_id" TEXT,
    "contribution_snapshot" INTEGER NOT NULL DEFAULT 0,
    "sign_in_days" INTEGER NOT NULL DEFAULT 0,
    "login_days" INTEGER NOT NULL DEFAULT 0,
    "harvest_count" INTEGER NOT NULL DEFAULT 0,
    "raid_count" INTEGER NOT NULL DEFAULT 0,
    "reward_json" JSONB NOT NULL,
    "claimed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_season_reward_grant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_season_achievement" (
    "id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "season_number" INTEGER NOT NULL,
    "domain" TEXT NOT NULL,
    "achievement_key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "contribution_snapshot" INTEGER NOT NULL DEFAULT 0,
    "stat_snapshot_json" JSONB NOT NULL,
    "reward_grant_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_season_achievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faction_season_snapshot" (
    "id" TEXT NOT NULL,
    "faction_id" TEXT NOT NULL,
    "season_number" INTEGER NOT NULL,
    "contribution_score" INTEGER NOT NULL DEFAULT 0,
    "member_count" INTEGER NOT NULL DEFAULT 0,
    "final_rank" INTEGER,
    "snapshot_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faction_season_snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_auth_identity" (
    "id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "provider" "AuthProvider" NOT NULL,
    "provider_user_id" TEXT NOT NULL,
    "union_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_auth_identity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faction" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "treasury_gold" INTEGER NOT NULL DEFAULT 0,
    "hourly_base_dividend" INTEGER NOT NULL DEFAULT 0,
    "hourly_contribution_dividend_per_ten" INTEGER NOT NULL DEFAULT 0,
    "contribution_score" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faction_member" (
    "id" TEXT NOT NULL,
    "faction_id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "contribution_score" INTEGER NOT NULL DEFAULT 0,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faction_member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_land_deed_progress" (
    "id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "deed_key" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "progress_json" JSONB NOT NULL,
    "claimed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_land_deed_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_faction_stipend_state" (
    "id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "date_key" TEXT NOT NULL,
    "contribution_snapshot" INTEGER NOT NULL,
    "tier_key" TEXT NOT NULL,
    "reward_json" JSONB NOT NULL,
    "claimed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_faction_stipend_state_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_wallet" (
    "player_id" TEXT NOT NULL,
    "vault_gold" INTEGER NOT NULL DEFAULT 0,
    "vault_capacity" INTEGER NOT NULL DEFAULT 0,
    "wallet_gold" INTEGER NOT NULL DEFAULT 0,
    "wallet_capacity" INTEGER NOT NULL DEFAULT 0,
    "wallet_protected_ratio" INTEGER NOT NULL DEFAULT 0,
    "pending_tax_gold" INTEGER NOT NULL DEFAULT 0,
    "pending_dividend_gold" INTEGER NOT NULL DEFAULT 0,
    "pending_raid_overflow_gold" INTEGER NOT NULL DEFAULT 0,
    "pending_raid_overflow_expires_at" TIMESTAMP(3),
    "passive_settled_at" TIMESTAMP(3),
    "balance_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_wallet_pkey" PRIMARY KEY ("player_id")
);

-- CreateTable
CREATE TABLE "player_building" (
    "player_id" TEXT NOT NULL,
    "castle_level" INTEGER NOT NULL DEFAULT 1,
    "vault_level" INTEGER NOT NULL DEFAULT 1,
    "field_slot_level" INTEGER NOT NULL DEFAULT 1,
    "population_level" INTEGER NOT NULL DEFAULT 1,
    "watchtower_level" INTEGER NOT NULL DEFAULT 1,
    "protection_tech_level" INTEGER NOT NULL DEFAULT 0,
    "farm_yield_tech_level" INTEGER NOT NULL DEFAULT 0,
    "collect_window_tech_level" INTEGER NOT NULL DEFAULT 0,
    "pending_claim_tech_level" INTEGER NOT NULL DEFAULT 0,
    "building_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_building_pkey" PRIMARY KEY ("player_id")
);

-- CreateTable
CREATE TABLE "player_army" (
    "player_id" TEXT NOT NULL,
    "total_count" INTEGER NOT NULL DEFAULT 0,
    "available_count" INTEGER NOT NULL DEFAULT 0,
    "frozen_count" INTEGER NOT NULL DEFAULT 0,
    "wounded_count" INTEGER NOT NULL DEFAULT 0,
    "capacity" INTEGER NOT NULL DEFAULT 0,
    "army_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_army_pkey" PRIMARY KEY ("player_id")
);

-- CreateTable
CREATE TABLE "army_training_queue" (
    "id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "queued_count" INTEGER NOT NULL,
    "unit_cost_gold" INTEGER NOT NULL,
    "total_cost_gold" INTEGER NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "finish_at" TIMESTAMP(3) NOT NULL,
    "status" "ArmyTrainingStatus" NOT NULL DEFAULT 'QUEUED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "army_training_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seed_definition" (
    "id" TEXT NOT NULL,
    "seed_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "rarity" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "grow_seconds" INTEGER NOT NULL,
    "mature_seconds" INTEGER NOT NULL,
    "collect_window_seconds" INTEGER NOT NULL,
    "base_yield_gold" INTEGER NOT NULL,
    "harvest_seed_return" INTEGER NOT NULL DEFAULT 0,
    "strategy_note" TEXT,
    "lore" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seed_definition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "spirit_definition" (
    "id" TEXT NOT NULL,
    "spirit_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "rarity" "SpiritRarity" NOT NULL,
    "faction_affinity" TEXT NOT NULL,
    "role" "SpiritRole" NOT NULL,
    "shard_name" TEXT NOT NULL,
    "shard_unlock_required" INTEGER NOT NULL,
    "base_attack" INTEGER NOT NULL,
    "base_hp" INTEGER NOT NULL,
    "growth_attack" INTEGER NOT NULL,
    "growth_hp" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "lore" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "spirit_definition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_spirit_resource" (
    "player_id" TEXT NOT NULL,
    "spirit_soul" INTEGER NOT NULL DEFAULT 0,
    "spirit_root" INTEGER NOT NULL DEFAULT 0,
    "spirit_marrow" INTEGER NOT NULL DEFAULT 0,
    "spirit_jade" INTEGER NOT NULL DEFAULT 0,
    "ordinary_soul" INTEGER NOT NULL DEFAULT 0,
    "rare_soul" INTEGER NOT NULL DEFAULT 0,
    "legendary_soul" INTEGER NOT NULL DEFAULT 0,
    "tianji_talisman" INTEGER NOT NULL DEFAULT 0,
    "daily_starter_seed_claim_date_key" TEXT,
    "daily_tianji_claim_date_key" TEXT,
    "daily_spirit_soul_claim_date_key" TEXT,
    "daily_intel_free_used" INTEGER NOT NULL DEFAULT 0,
    "daily_intel_talisman_used" INTEGER NOT NULL DEFAULT 0,
    "daily_intel_date_key" TEXT,
    "resource_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_spirit_resource_pkey" PRIMARY KEY ("player_id")
);

-- CreateTable
CREATE TABLE "player_spirit_slot" (
    "id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "slot_index" INTEGER NOT NULL,
    "spirit_definition_id" TEXT,
    "is_main" BOOLEAN NOT NULL DEFAULT false,
    "level" INTEGER NOT NULL DEFAULT 1,
    "exp" INTEGER NOT NULL DEFAULT 0,
    "breakthrough_stage" INTEGER NOT NULL DEFAULT 0,
    "satiated_until" TIMESTAMP(3),
    "last_exp_settled_at" TIMESTAMP(3),
    "element" "SpiritElement",
    "max_hp" INTEGER NOT NULL DEFAULT 0,
    "acquired_at" TIMESTAMP(3),
    "dissolved_at" TIMESTAMP(3),
    "slot_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_spirit_slot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_spirit_trait" (
    "id" TEXT NOT NULL,
    "spirit_slot_id" TEXT NOT NULL,
    "slot_index" INTEGER NOT NULL,
    "trait_code" TEXT NOT NULL,
    "trait_value" INTEGER NOT NULL,
    "source_type" TEXT NOT NULL,
    "locked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_spirit_trait_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "spirit_feed_log" (
    "id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "spirit_slot_id" TEXT NOT NULL,
    "action_type" TEXT NOT NULL,
    "feed_count" INTEGER NOT NULL,
    "satiated_seconds_added" INTEGER NOT NULL,
    "immediate_exp_gain" INTEGER NOT NULL,
    "before_satiated_until" TIMESTAMP(3),
    "after_satiated_until" TIMESTAMP(3),
    "request_idempotency_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "spirit_feed_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "spirit_breakthrough_log" (
    "id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "spirit_slot_id" TEXT NOT NULL,
    "from_stage" INTEGER NOT NULL,
    "to_stage" INTEGER NOT NULL,
    "consumed_soul_quality" TEXT NOT NULL,
    "consumed_soul_count" INTEGER NOT NULL,
    "request_idempotency_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "spirit_breakthrough_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "spirit_trait_roll_log" (
    "id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "spirit_slot_id" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "locked_slot_index" INTEGER,
    "target_slot_index" INTEGER,
    "target_trait_code" TEXT,
    "consumed_json" JSONB NOT NULL,
    "before_traits_json" JSONB NOT NULL,
    "result_traits_json" JSONB NOT NULL,
    "candidate_results_json" JSONB,
    "status" TEXT NOT NULL DEFAULT 'APPLIED',
    "selected_trait_code" TEXT,
    "resolved_at" TIMESTAMP(3),
    "request_idempotency_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "spirit_trait_roll_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "spirit_shop_purchase_log" (
    "id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "period_key" TEXT,
    "consumed_tianji_talisman" INTEGER NOT NULL,
    "reward_json" JSONB NOT NULL,
    "request_idempotency_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "spirit_shop_purchase_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "spirit_ad_reward_log" (
    "id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "date_key" TEXT NOT NULL,
    "tianji_talisman_reward" INTEGER NOT NULL,
    "bonus_reward_json" JSONB NOT NULL,
    "request_idempotency_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "spirit_ad_reward_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_spirit_codex" (
    "id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "spirit_definition_id" TEXT NOT NULL,
    "has_seen" BOOLEAN NOT NULL DEFAULT false,
    "shard_count" INTEGER NOT NULL DEFAULT 0,
    "ready_to_compose" BOOLEAN NOT NULL DEFAULT false,
    "owned_current" BOOLEAN NOT NULL DEFAULT false,
    "owned_ever" BOOLEAN NOT NULL DEFAULT false,
    "first_seen_at" TIMESTAMP(3),
    "ready_at" TIMESTAMP(3),
    "last_owned_at" TIMESTAMP(3),
    "codex_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_spirit_codex_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_farm_board" (
    "player_id" TEXT NOT NULL,
    "message" TEXT NOT NULL DEFAULT '',
    "board_version" INTEGER NOT NULL DEFAULT 1,
    "hidden_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_farm_board_pkey" PRIMARY KEY ("player_id")
);

-- CreateTable
CREATE TABLE "raid_message_template" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "raid_message_template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "raid_order_message" (
    "id" TEXT NOT NULL,
    "raid_order_id" TEXT NOT NULL,
    "author_player_id" TEXT NOT NULL,
    "receiver_player_id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "text_snapshot" TEXT NOT NULL,
    "is_hidden" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "raid_order_message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_notification" (
    "id" TEXT NOT NULL,
    "audience" "NotificationAudience" NOT NULL,
    "category" "NotificationCategory" NOT NULL DEFAULT 'SYSTEM',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_by_admin" TEXT,
    "starts_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_notification" (
    "id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "system_notification_id" TEXT,
    "category" "NotificationCategory" NOT NULL DEFAULT 'SYSTEM',
    "title_snapshot" TEXT NOT NULL,
    "body_snapshot" TEXT NOT NULL,
    "attachment_json" JSONB,
    "claim_status" "PlayerNotificationClaimStatus" NOT NULL DEFAULT 'NONE',
    "read_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "claimed_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_social_relation" (
    "id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "target_player_id" TEXT NOT NULL,
    "relation_type" "SocialRelationType" NOT NULL,
    "status" "SocialRelationStatus" NOT NULL DEFAULT 'ACTIVE',
    "source_type" TEXT NOT NULL DEFAULT 'manual',
    "intimacy" INTEGER NOT NULL DEFAULT 0,
    "last_interacted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_social_relation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_social_feed" (
    "id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "actor_player_id" TEXT,
    "feed_type" "SocialFeedType" NOT NULL,
    "related_entity_type" TEXT,
    "related_entity_id" TEXT,
    "summary" TEXT NOT NULL,
    "metadata_json" JSONB,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_social_feed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_assist_record" (
    "id" TEXT NOT NULL,
    "helper_player_id" TEXT NOT NULL,
    "target_player_id" TEXT NOT NULL,
    "assist_type" "SocialAssistType" NOT NULL,
    "target_entity_type" TEXT,
    "target_entity_id" TEXT,
    "effect_value" INTEGER NOT NULL DEFAULT 0,
    "intimacy_gain" INTEGER NOT NULL DEFAULT 0,
    "date_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_assist_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_challenge" (
    "id" TEXT NOT NULL,
    "initiator_player_id" TEXT NOT NULL,
    "ally_player_id" TEXT NOT NULL,
    "target_player_id" TEXT NOT NULL,
    "status" "TeamChallengeStatus" NOT NULL DEFAULT 'PENDING',
    "initiator_power_snapshot" INTEGER NOT NULL DEFAULT 0,
    "ally_power_snapshot" INTEGER NOT NULL DEFAULT 0,
    "target_power_snapshot" INTEGER NOT NULL DEFAULT 0,
    "assist_efficiency_bps" INTEGER NOT NULL DEFAULT 6000,
    "result" TEXT,
    "reward_json" JSONB,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settled_at" TIMESTAMP(3),

    CONSTRAINT "team_challenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "share_assist_campaign" (
    "id" TEXT NOT NULL,
    "owner_player_id" TEXT NOT NULL,
    "campaign_type" "ShareAssistCampaignType" NOT NULL,
    "target_entity_type" TEXT,
    "target_entity_id" TEXT,
    "status" "ShareAssistCampaignStatus" NOT NULL DEFAULT 'ACTIVE',
    "max_assist_count" INTEGER NOT NULL DEFAULT 3,
    "current_assist_count" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "share_assist_campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "share_assist_record" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "helper_player_id" TEXT,
    "helper_openid_hash" TEXT,
    "helper_device_hash" TEXT,
    "helper_audience" "ShareAssistRecordAudience" NOT NULL,
    "status" "ShareAssistRecordStatus" NOT NULL DEFAULT 'CONFIRMED',
    "assist_record_id" TEXT,
    "reward_claimed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bound_at" TIMESTAMP(3),

    CONSTRAINT "share_assist_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_invite_relation" (
    "id" TEXT NOT NULL,
    "inviter_player_id" TEXT NOT NULL,
    "invited_player_id" TEXT,
    "invited_openid_hash" TEXT,
    "source_campaign_id" TEXT,
    "status" "PlayerInviteRelationStatus" NOT NULL DEFAULT 'PENDING_BIND',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bound_at" TIMESTAMP(3),
    "rewarded_at" TIMESTAMP(3),

    CONSTRAINT "player_invite_relation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_seed_inventory" (
    "id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "seed_definition_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "inventory_version" INTEGER NOT NULL DEFAULT 1,
    "unlocked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_seed_inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
CREATE TABLE "player_field_slot" (
    "id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "slot_index" INTEGER NOT NULL,
    "is_unlocked" BOOLEAN NOT NULL DEFAULT false,
    "unlock_castle_level" INTEGER NOT NULL,
    "status" "FieldStatus" NOT NULL DEFAULT 'LOCKED',
    "seed_definition_id" TEXT,
    "expected_essence_yield" INTEGER NOT NULL DEFAULT 0,
    "stolen_essence_yield" INTEGER NOT NULL DEFAULT 0,
    "harvested_essence_yield" INTEGER NOT NULL DEFAULT 0,
    "last_stolen_at" TIMESTAMP(3),
    "invested_gold" INTEGER NOT NULL DEFAULT 0,
    "current_claimable_gold" INTEGER NOT NULL DEFAULT 0,
    "harvested_gold_total" INTEGER NOT NULL DEFAULT 0,
    "raided_gold_total" INTEGER NOT NULL DEFAULT 0,
    "seed_at" TIMESTAMP(3),
    "mature_at" TIMESTAMP(3),
    "ready_at" TIMESTAMP(3),
    "overripe_at" TIMESTAMP(3),
    "last_calculated_at" TIMESTAMP(3),
    "status_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_field_slot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_daily_task_state" (
    "id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "date_key" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "target" INTEGER NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "reward_gold" INTEGER NOT NULL,
    "action_scene" TEXT NOT NULL,
    "claimed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_daily_task_state_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
CREATE TABLE "wallet_change_log" (
    "id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "wallet_bucket" TEXT NOT NULL,
    "change_type" TEXT NOT NULL,
    "delta_gold" INTEGER NOT NULL,
    "before_gold" INTEGER NOT NULL,
    "after_gold" INTEGER NOT NULL,
    "related_entity_type" TEXT,
    "related_entity_id" TEXT,
    "request_idempotency_key" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_change_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
CREATE TABLE "robot_sim_snapshot" (
    "id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "robot_key" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "faction_code" TEXT,
    "vault_gold" INTEGER NOT NULL DEFAULT 0,
    "wallet_gold" INTEGER NOT NULL DEFAULT 0,
    "contribution_score" INTEGER NOT NULL DEFAULT 0,
    "spirit_soul" INTEGER NOT NULL DEFAULT 0,
    "ordinary_soul" INTEGER NOT NULL DEFAULT 0,
    "rare_soul" INTEGER NOT NULL DEFAULT 0,
    "legendary_soul" INTEGER NOT NULL DEFAULT 0,
    "main_spirit_level" INTEGER,
    "main_spirit_stage" INTEGER,
    "army_total" INTEGER NOT NULL DEFAULT 0,
    "army_available" INTEGER NOT NULL DEFAULT 0,
    "army_capacity" INTEGER NOT NULL DEFAULT 0,
    "queued_army" INTEGER NOT NULL DEFAULT 0,
    "mature_fields" INTEGER NOT NULL DEFAULT 0,
    "growing_fields" INTEGER NOT NULL DEFAULT 0,
    "empty_fields" INTEGER NOT NULL DEFAULT 0,
    "success_action_count" INTEGER NOT NULL DEFAULT 0,
    "blocked_action_count" INTEGER NOT NULL DEFAULT 0,
    "failed_action_count" INTEGER NOT NULL DEFAULT 0,
    "action_summary_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "robot_sim_snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "building_upgrade_log" (
    "id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "building_key" TEXT NOT NULL,
    "old_level" INTEGER NOT NULL,
    "new_level" INTEGER NOT NULL,
    "cost_gold" INTEGER NOT NULL,
    "request_idempotency_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "building_upgrade_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "field_harvest_log" (
    "id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "field_slot_id" TEXT NOT NULL,
    "seed_id" TEXT,
    "collect_mode" TEXT NOT NULL,
    "collected_gold" INTEGER NOT NULL,
    "overflow_gold" INTEGER NOT NULL,
    "reward_items_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "field_harvest_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faction_contribution_log" (
    "id" TEXT NOT NULL,
    "faction_id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "donated_gold" INTEGER NOT NULL DEFAULT 0,
    "contribution_delta" INTEGER NOT NULL,
    "source_type" TEXT NOT NULL DEFAULT 'gold-donation',
    "source_id" TEXT,
    "metadata_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "faction_contribution_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_faction_task" (
    "id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "faction_id" TEXT NOT NULL,
    "task_date" TEXT NOT NULL,
    "task_type" "DailyFactionTaskType" NOT NULL,
    "required_essence_type" TEXT,
    "required_amount" INTEGER NOT NULL,
    "progress_amount" INTEGER NOT NULL DEFAULT 0,
    "reward_contribution" INTEGER NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "refreshed_from_task_id" TEXT,

    CONSTRAINT "daily_faction_task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "essence_transaction_log" (
    "id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "essence_type" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "source_id" TEXT,
    "balance_after" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "essence_transaction_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_reward_log" (
    "id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "task_state_id" TEXT,
    "task_id" TEXT NOT NULL,
    "reward_gold" INTEGER NOT NULL,
    "request_idempotency_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_reward_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_record" (
    "id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "endpoint_key" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "response_snapshot_json" JSONB,
    "business_entity_type" TEXT,
    "business_entity_id" TEXT,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "idempotency_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_raid_daily_state" (
    "id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "date_key" TEXT NOT NULL,
    "normal_raid_attempts_used" INTEGER NOT NULL DEFAULT 0,
    "raid_refreshes_used" INTEGER NOT NULL DEFAULT 0,
    "successful_defense_raid_count" INTEGER NOT NULL DEFAULT 0,
    "extra_raid_attempts_purchased" INTEGER NOT NULL DEFAULT 0,
    "extra_refreshes_purchased" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_raid_daily_state_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_raid_pair_daily_state" (
    "id" TEXT NOT NULL,
    "attacker_player_id" TEXT NOT NULL,
    "defender_player_id" TEXT NOT NULL,
    "date_key" TEXT NOT NULL,
    "settled_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_raid_pair_daily_state_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "raid_target_pool" (
    "id" TEXT NOT NULL,
    "owner_player_id" TEXT NOT NULL,
    "target_player_id" TEXT NOT NULL,
    "slot_index" INTEGER NOT NULL,
    "target_snapshot_json" JSONB NOT NULL,
    "field_snapshot_json" JSONB,
    "risk_snapshot_json" JSONB,
    "refresh_batch_no" INTEGER NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "raid_target_pool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "raid_order" (
    "id" TEXT NOT NULL,
    "attacker_player_id" TEXT NOT NULL,
    "defender_player_id" TEXT NOT NULL,
    "defender_field_slot_id" TEXT,
    "source_target_pool_id" TEXT,
    "mode" "RaidOrderMode" NOT NULL,
    "status" "RaidOrderStatus" NOT NULL DEFAULT 'CREATED',
    "dispatched_unit_count" INTEGER NOT NULL,
    "frozen_unit_snapshot" JSONB NOT NULL,
    "transport_capacity_snapshot" INTEGER NOT NULL,
    "attacker_snapshot_json" JSONB NOT NULL,
    "defender_snapshot_json" JSONB NOT NULL,
    "dispatched_at" TIMESTAMP(3) NOT NULL,
    "settle_at" TIMESTAMP(3) NOT NULL,
    "settled_at" TIMESTAMP(3),
    "request_idempotency_key" TEXT NOT NULL,
    "settlement_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "raid_order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "raid_asset_lock" (
    "id" TEXT NOT NULL,
    "raid_order_id" TEXT NOT NULL,
    "defender_player_id" TEXT NOT NULL,
    "asset_type" TEXT NOT NULL,
    "source_entity_id" TEXT,
    "source_field_slot_id" TEXT,
    "locked_gold" INTEGER NOT NULL DEFAULT 0,
    "locked_item_json" JSONB,
    "lock_mode" "RaidAssetLockMode" NOT NULL,
    "status" "RaidAssetLockStatus" NOT NULL DEFAULT 'ACTIVE',
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "raid_asset_lock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "raid_settlement" (
    "id" TEXT NOT NULL,
    "raid_order_id" TEXT NOT NULL,
    "result" "RaidSettlementResult" NOT NULL,
    "loot_gold" INTEGER NOT NULL DEFAULT 0,
    "deposited_gold" INTEGER NOT NULL DEFAULT 0,
    "overflow_gold" INTEGER NOT NULL DEFAULT 0,
    "temporary_claim_expires_at" TIMESTAMP(3),
    "attacker_loss" INTEGER NOT NULL DEFAULT 0,
    "defender_loss" INTEGER NOT NULL DEFAULT 0,
    "reward_items_json" JSONB,
    "battle_replay_json" JSONB,
    "report_summary" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "raid_settlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "battle_report" (
    "id" TEXT NOT NULL,
    "raid_order_id" TEXT NOT NULL,
    "owner_player_id" TEXT NOT NULL,
    "opponent_player_id" TEXT NOT NULL,
    "report_type" "BattleReportType" NOT NULL,
    "result" "RaidSettlementResult" NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "revenge_available" BOOLEAN NOT NULL DEFAULT false,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "battle_report_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "player_faction_id_idx" ON "player"("faction_id");

-- CreateIndex
CREATE INDEX "player_last_login_at_idx" ON "player"("last_login_at");

-- CreateIndex
CREATE INDEX "game_season_starts_at_ends_at_idx" ON "game_season"("starts_at", "ends_at");

-- CreateIndex
CREATE INDEX "player_season_state_current_season_number_idx" ON "player_season_state"("current_season_number");

-- CreateIndex
CREATE INDEX "player_season_state_last_reset_season_number_idx" ON "player_season_state"("last_reset_season_number");

-- CreateIndex
CREATE INDEX "player_season_snapshot_season_number_contribution_score_idx" ON "player_season_snapshot"("season_number", "contribution_score");

-- CreateIndex
CREATE INDEX "player_season_snapshot_faction_id_season_number_idx" ON "player_season_snapshot"("faction_id", "season_number");

-- CreateIndex
CREATE UNIQUE INDEX "player_season_snapshot_player_id_season_number_key" ON "player_season_snapshot"("player_id", "season_number");

-- CreateIndex
CREATE INDEX "player_season_sign_in_player_id_season_number_idx" ON "player_season_sign_in"("player_id", "season_number");

-- CreateIndex
CREATE INDEX "player_season_sign_in_season_number_day_index_idx" ON "player_season_sign_in"("season_number", "day_index");

-- CreateIndex
CREATE UNIQUE INDEX "player_season_sign_in_player_id_season_number_day_index_key" ON "player_season_sign_in"("player_id", "season_number", "day_index");

-- CreateIndex
CREATE INDEX "player_season_activity_player_id_season_number_idx" ON "player_season_activity"("player_id", "season_number");

-- CreateIndex
CREATE INDEX "player_season_activity_season_number_date_key_idx" ON "player_season_activity"("season_number", "date_key");

-- CreateIndex
CREATE UNIQUE INDEX "player_season_activity_player_id_season_number_date_key_key" ON "player_season_activity"("player_id", "season_number", "date_key");

-- CreateIndex
CREATE INDEX "player_season_reward_grant_player_id_status_idx" ON "player_season_reward_grant"("player_id", "status");

-- CreateIndex
CREATE INDEX "player_season_reward_grant_season_number_reward_type_idx" ON "player_season_reward_grant"("season_number", "reward_type");

-- CreateIndex
CREATE INDEX "player_season_reward_grant_notification_id_idx" ON "player_season_reward_grant"("notification_id");

-- CreateIndex
CREATE UNIQUE INDEX "player_season_reward_grant_player_id_season_number_reward_t_key" ON "player_season_reward_grant"("player_id", "season_number", "reward_type");

-- CreateIndex
CREATE INDEX "player_season_achievement_player_id_season_number_domain_idx" ON "player_season_achievement"("player_id", "season_number", "domain");

-- CreateIndex
CREATE INDEX "player_season_achievement_reward_grant_id_idx" ON "player_season_achievement"("reward_grant_id");

-- CreateIndex
CREATE UNIQUE INDEX "player_season_achievement_player_id_season_number_achieveme_key" ON "player_season_achievement"("player_id", "season_number", "achievement_key");

-- CreateIndex
CREATE INDEX "faction_season_snapshot_season_number_contribution_score_idx" ON "faction_season_snapshot"("season_number", "contribution_score");

-- CreateIndex
CREATE UNIQUE INDEX "faction_season_snapshot_faction_id_season_number_key" ON "faction_season_snapshot"("faction_id", "season_number");

-- CreateIndex
CREATE INDEX "player_auth_identity_player_id_idx" ON "player_auth_identity"("player_id");

-- CreateIndex
CREATE UNIQUE INDEX "player_auth_identity_provider_provider_user_id_key" ON "player_auth_identity"("provider", "provider_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "faction_code_key" ON "faction"("code");

-- CreateIndex
CREATE UNIQUE INDEX "faction_name_key" ON "faction"("name");

-- CreateIndex
CREATE INDEX "faction_member_player_id_idx" ON "faction_member"("player_id");

-- CreateIndex
CREATE UNIQUE INDEX "faction_member_faction_id_player_id_key" ON "faction_member"("faction_id", "player_id");

-- CreateIndex
CREATE INDEX "player_land_deed_progress_player_id_status_idx" ON "player_land_deed_progress"("player_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "player_land_deed_progress_player_id_deed_key_key" ON "player_land_deed_progress"("player_id", "deed_key");

-- CreateIndex
CREATE INDEX "player_faction_stipend_state_date_key_claimed_at_idx" ON "player_faction_stipend_state"("date_key", "claimed_at");

-- CreateIndex
CREATE INDEX "player_faction_stipend_state_player_id_claimed_at_idx" ON "player_faction_stipend_state"("player_id", "claimed_at");

-- CreateIndex
CREATE UNIQUE INDEX "player_faction_stipend_state_player_id_date_key_key" ON "player_faction_stipend_state"("player_id", "date_key");

-- CreateIndex
CREATE INDEX "player_wallet_pending_raid_overflow_expires_at_idx" ON "player_wallet"("pending_raid_overflow_expires_at");

-- CreateIndex
CREATE INDEX "army_training_queue_player_id_status_idx" ON "army_training_queue"("player_id", "status");

-- CreateIndex
CREATE INDEX "army_training_queue_finish_at_idx" ON "army_training_queue"("finish_at");

-- CreateIndex
CREATE INDEX "seed_definition_rarity_sort_order_idx" ON "seed_definition"("rarity", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "seed_definition_seed_id_key" ON "seed_definition"("seed_id");

-- CreateIndex
CREATE INDEX "spirit_definition_rarity_sort_order_idx" ON "spirit_definition"("rarity", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "spirit_definition_spirit_id_key" ON "spirit_definition"("spirit_id");

-- CreateIndex
CREATE INDEX "player_spirit_slot_player_id_is_main_idx" ON "player_spirit_slot"("player_id", "is_main");

-- CreateIndex
CREATE INDEX "player_spirit_slot_spirit_definition_id_idx" ON "player_spirit_slot"("spirit_definition_id");

-- CreateIndex
CREATE UNIQUE INDEX "player_spirit_slot_player_id_slot_index_key" ON "player_spirit_slot"("player_id", "slot_index");

-- CreateIndex
CREATE INDEX "player_spirit_trait_spirit_slot_id_idx" ON "player_spirit_trait"("spirit_slot_id");

-- CreateIndex
CREATE INDEX "player_spirit_trait_trait_code_idx" ON "player_spirit_trait"("trait_code");

-- CreateIndex
CREATE UNIQUE INDEX "player_spirit_trait_spirit_slot_id_slot_index_key" ON "player_spirit_trait"("spirit_slot_id", "slot_index");

-- CreateIndex
CREATE INDEX "spirit_feed_log_player_id_created_at_idx" ON "spirit_feed_log"("player_id", "created_at");

-- CreateIndex
CREATE INDEX "spirit_feed_log_spirit_slot_id_idx" ON "spirit_feed_log"("spirit_slot_id");

-- CreateIndex
CREATE INDEX "spirit_feed_log_request_idempotency_key_idx" ON "spirit_feed_log"("request_idempotency_key");

-- CreateIndex
CREATE INDEX "spirit_breakthrough_log_player_id_created_at_idx" ON "spirit_breakthrough_log"("player_id", "created_at");

-- CreateIndex
CREATE INDEX "spirit_breakthrough_log_spirit_slot_id_idx" ON "spirit_breakthrough_log"("spirit_slot_id");

-- CreateIndex
CREATE INDEX "spirit_breakthrough_log_request_idempotency_key_idx" ON "spirit_breakthrough_log"("request_idempotency_key");

-- CreateIndex
CREATE INDEX "spirit_trait_roll_log_player_id_created_at_idx" ON "spirit_trait_roll_log"("player_id", "created_at");

-- CreateIndex
CREATE INDEX "spirit_trait_roll_log_spirit_slot_id_idx" ON "spirit_trait_roll_log"("spirit_slot_id");

-- CreateIndex
CREATE INDEX "spirit_trait_roll_log_request_idempotency_key_idx" ON "spirit_trait_roll_log"("request_idempotency_key");

-- CreateIndex
CREATE INDEX "spirit_shop_purchase_log_player_id_item_id_period_key_idx" ON "spirit_shop_purchase_log"("player_id", "item_id", "period_key");

-- CreateIndex
CREATE INDEX "spirit_ad_reward_log_player_id_date_key_idx" ON "spirit_ad_reward_log"("player_id", "date_key");

-- CreateIndex
CREATE INDEX "player_spirit_codex_player_id_ready_to_compose_idx" ON "player_spirit_codex"("player_id", "ready_to_compose");

-- CreateIndex
CREATE INDEX "player_spirit_codex_spirit_definition_id_idx" ON "player_spirit_codex"("spirit_definition_id");

-- CreateIndex
CREATE UNIQUE INDEX "player_spirit_codex_player_id_spirit_definition_id_key" ON "player_spirit_codex"("player_id", "spirit_definition_id");

-- CreateIndex
CREATE INDEX "raid_message_template_is_active_sort_order_idx" ON "raid_message_template"("is_active", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "raid_message_template_template_id_key" ON "raid_message_template"("template_id");

-- CreateIndex
CREATE UNIQUE INDEX "raid_order_message_raid_order_id_key" ON "raid_order_message"("raid_order_id");

-- CreateIndex
CREATE INDEX "raid_order_message_author_player_id_created_at_idx" ON "raid_order_message"("author_player_id", "created_at");

-- CreateIndex
CREATE INDEX "raid_order_message_receiver_player_id_created_at_idx" ON "raid_order_message"("receiver_player_id", "created_at");

-- CreateIndex
CREATE INDEX "raid_order_message_template_id_idx" ON "raid_order_message"("template_id");

-- CreateIndex
CREATE INDEX "system_notification_audience_created_at_idx" ON "system_notification"("audience", "created_at");

-- CreateIndex
CREATE INDEX "system_notification_category_created_at_idx" ON "system_notification"("category", "created_at");

-- CreateIndex
CREATE INDEX "system_notification_revoked_at_idx" ON "system_notification"("revoked_at");

-- CreateIndex
CREATE INDEX "player_notification_player_id_deleted_at_created_at_idx" ON "player_notification"("player_id", "deleted_at", "created_at");

-- CreateIndex
CREATE INDEX "player_notification_player_id_read_at_idx" ON "player_notification"("player_id", "read_at");

-- CreateIndex
CREATE INDEX "player_notification_player_id_claim_status_idx" ON "player_notification"("player_id", "claim_status");

-- CreateIndex
CREATE INDEX "player_notification_system_notification_id_idx" ON "player_notification"("system_notification_id");

-- CreateIndex
CREATE INDEX "player_social_relation_player_id_relation_type_status_idx" ON "player_social_relation"("player_id", "relation_type", "status");

-- CreateIndex
CREATE INDEX "player_social_relation_target_player_id_relation_type_statu_idx" ON "player_social_relation"("target_player_id", "relation_type", "status");

-- CreateIndex
CREATE INDEX "player_social_relation_last_interacted_at_idx" ON "player_social_relation"("last_interacted_at");

-- CreateIndex
CREATE UNIQUE INDEX "player_social_relation_player_id_target_player_id_relation__key" ON "player_social_relation"("player_id", "target_player_id", "relation_type");

-- CreateIndex
CREATE INDEX "player_social_feed_player_id_is_read_created_at_idx" ON "player_social_feed"("player_id", "is_read", "created_at");

-- CreateIndex
CREATE INDEX "player_social_feed_player_id_feed_type_created_at_idx" ON "player_social_feed"("player_id", "feed_type", "created_at");

-- CreateIndex
CREATE INDEX "player_social_feed_actor_player_id_created_at_idx" ON "player_social_feed"("actor_player_id", "created_at");

-- CreateIndex
CREATE INDEX "player_social_feed_expires_at_idx" ON "player_social_feed"("expires_at");

-- CreateIndex
CREATE INDEX "player_assist_record_helper_player_id_date_key_assist_type_idx" ON "player_assist_record"("helper_player_id", "date_key", "assist_type");

-- CreateIndex
CREATE INDEX "assist_pair_date_idx" ON "player_assist_record"("helper_player_id", "target_player_id", "date_key");

-- CreateIndex
CREATE INDEX "player_assist_record_target_player_id_date_key_assist_type_idx" ON "player_assist_record"("target_player_id", "date_key", "assist_type");

-- CreateIndex
CREATE INDEX "player_assist_record_target_entity_type_target_entity_id_idx" ON "player_assist_record"("target_entity_type", "target_entity_id");

-- CreateIndex
CREATE INDEX "team_challenge_initiator_player_id_status_created_at_idx" ON "team_challenge"("initiator_player_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "team_challenge_ally_player_id_status_created_at_idx" ON "team_challenge"("ally_player_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "team_challenge_target_player_id_created_at_idx" ON "team_challenge"("target_player_id", "created_at");

-- CreateIndex
CREATE INDEX "team_challenge_expires_at_status_idx" ON "team_challenge"("expires_at", "status");

-- CreateIndex
CREATE INDEX "share_assist_campaign_owner_player_id_campaign_type_status__idx" ON "share_assist_campaign"("owner_player_id", "campaign_type", "status", "created_at");

-- CreateIndex
CREATE INDEX "share_assist_campaign_expires_at_status_idx" ON "share_assist_campaign"("expires_at", "status");

-- CreateIndex
CREATE INDEX "share_assist_record_campaign_id_status_created_at_idx" ON "share_assist_record"("campaign_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "share_assist_record_helper_player_id_created_at_idx" ON "share_assist_record"("helper_player_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "share_assist_record_campaign_id_helper_player_id_key" ON "share_assist_record"("campaign_id", "helper_player_id");

-- CreateIndex
CREATE UNIQUE INDEX "share_assist_record_campaign_id_helper_openid_hash_key" ON "share_assist_record"("campaign_id", "helper_openid_hash");

-- CreateIndex
CREATE UNIQUE INDEX "share_assist_record_campaign_id_helper_device_hash_key" ON "share_assist_record"("campaign_id", "helper_device_hash");

-- CreateIndex
CREATE INDEX "player_invite_relation_inviter_player_id_status_created_at_idx" ON "player_invite_relation"("inviter_player_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "player_invite_relation_invited_player_id_idx" ON "player_invite_relation"("invited_player_id");

-- CreateIndex
CREATE INDEX "player_invite_relation_source_campaign_id_idx" ON "player_invite_relation"("source_campaign_id");

-- CreateIndex
CREATE UNIQUE INDEX "player_invite_relation_inviter_player_id_invited_player_id_key" ON "player_invite_relation"("inviter_player_id", "invited_player_id");

-- CreateIndex
CREATE UNIQUE INDEX "player_invite_relation_inviter_player_id_invited_openid_has_key" ON "player_invite_relation"("inviter_player_id", "invited_openid_hash");

-- CreateIndex
CREATE INDEX "player_seed_inventory_player_id_idx" ON "player_seed_inventory"("player_id");

-- CreateIndex
CREATE UNIQUE INDEX "player_seed_inventory_player_id_seed_definition_id_key" ON "player_seed_inventory"("player_id", "seed_definition_id");

-- CreateIndex
CREATE INDEX "player_plant_research_player_id_idx" ON "player_plant_research"("player_id");

-- CreateIndex
CREATE UNIQUE INDEX "player_plant_research_player_id_seed_definition_id_key" ON "player_plant_research"("player_id", "seed_definition_id");

-- CreateIndex
CREATE INDEX "player_field_slot_player_id_status_idx" ON "player_field_slot"("player_id", "status");

-- CreateIndex
CREATE INDEX "player_field_slot_mature_at_idx" ON "player_field_slot"("mature_at");

-- CreateIndex
CREATE INDEX "player_field_slot_ready_at_idx" ON "player_field_slot"("ready_at");

-- CreateIndex
CREATE INDEX "player_field_slot_overripe_at_idx" ON "player_field_slot"("overripe_at");

-- CreateIndex
CREATE UNIQUE INDEX "player_field_slot_player_id_slot_index_key" ON "player_field_slot"("player_id", "slot_index");

-- CreateIndex
CREATE INDEX "player_daily_task_state_player_id_date_key_idx" ON "player_daily_task_state"("player_id", "date_key");

-- CreateIndex
CREATE INDEX "player_daily_task_state_date_key_status_idx" ON "player_daily_task_state"("date_key", "status");

-- CreateIndex
CREATE UNIQUE INDEX "player_daily_task_state_player_id_date_key_task_id_key" ON "player_daily_task_state"("player_id", "date_key", "task_id");

-- CreateIndex
CREATE INDEX "task_config_override_task_group_is_enabled_idx" ON "task_config_override"("task_group", "is_enabled");

-- CreateIndex
CREATE UNIQUE INDEX "task_config_override_task_group_task_id_key" ON "task_config_override"("task_group", "task_id");

-- CreateIndex
CREATE INDEX "wallet_change_log_player_id_created_at_idx" ON "wallet_change_log"("player_id", "created_at");

-- CreateIndex
CREATE INDEX "wallet_change_log_request_idempotency_key_idx" ON "wallet_change_log"("request_idempotency_key");

-- CreateIndex
CREATE INDEX "wallet_change_log_change_type_created_at_idx" ON "wallet_change_log"("change_type", "created_at");

-- CreateIndex
CREATE INDEX "admin_operation_audit_log_action_created_at_idx" ON "admin_operation_audit_log"("action", "created_at");

-- CreateIndex
CREATE INDEX "admin_operation_audit_log_target_type_target_id_idx" ON "admin_operation_audit_log"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "robot_test_run_status_started_at_idx" ON "robot_test_run"("status", "started_at");

-- CreateIndex
CREATE INDEX "robot_test_run_mode_started_at_idx" ON "robot_test_run"("mode", "started_at");

-- CreateIndex
CREATE INDEX "robot_action_log_run_id_created_at_idx" ON "robot_action_log"("run_id", "created_at");

-- CreateIndex
CREATE INDEX "robot_action_log_robot_key_created_at_idx" ON "robot_action_log"("robot_key", "created_at");

-- CreateIndex
CREATE INDEX "robot_action_log_player_id_created_at_idx" ON "robot_action_log"("player_id", "created_at");

-- CreateIndex
CREATE INDEX "robot_action_log_status_created_at_idx" ON "robot_action_log"("status", "created_at");

-- CreateIndex
CREATE INDEX "robot_automation_job_mode_status_started_at_idx" ON "robot_automation_job"("mode", "status", "started_at");

-- CreateIndex
CREATE INDEX "robot_automation_job_status_started_at_idx" ON "robot_automation_job"("status", "started_at");

-- CreateIndex
CREATE UNIQUE INDEX "robot_automation_config_mode_key" ON "robot_automation_config"("mode");

-- CreateIndex
CREATE INDEX "robot_automation_config_enabled_mode_idx" ON "robot_automation_config"("enabled", "mode");

-- CreateIndex
CREATE INDEX "robot_sim_snapshot_run_id_idx" ON "robot_sim_snapshot"("run_id");

-- CreateIndex
CREATE INDEX "robot_sim_snapshot_mode_created_at_idx" ON "robot_sim_snapshot"("mode", "created_at");

-- CreateIndex
CREATE INDEX "robot_sim_snapshot_player_id_created_at_idx" ON "robot_sim_snapshot"("player_id", "created_at");

-- CreateIndex
CREATE INDEX "robot_sim_snapshot_robot_key_created_at_idx" ON "robot_sim_snapshot"("robot_key", "created_at");

-- CreateIndex
CREATE INDEX "building_upgrade_log_player_id_created_at_idx" ON "building_upgrade_log"("player_id", "created_at");

-- CreateIndex
CREATE INDEX "building_upgrade_log_request_idempotency_key_idx" ON "building_upgrade_log"("request_idempotency_key");

-- CreateIndex
CREATE INDEX "field_harvest_log_player_id_created_at_idx" ON "field_harvest_log"("player_id", "created_at");

-- CreateIndex
CREATE INDEX "field_harvest_log_player_id_seed_id_idx" ON "field_harvest_log"("player_id", "seed_id");

-- CreateIndex
CREATE INDEX "field_harvest_log_field_slot_id_idx" ON "field_harvest_log"("field_slot_id");

-- CreateIndex
CREATE INDEX "faction_contribution_log_faction_id_created_at_idx" ON "faction_contribution_log"("faction_id", "created_at");

-- CreateIndex
CREATE INDEX "faction_contribution_log_player_id_created_at_idx" ON "faction_contribution_log"("player_id", "created_at");

-- CreateIndex
CREATE INDEX "daily_faction_task_player_id_task_date_status_idx" ON "daily_faction_task"("player_id", "task_date", "status");

-- CreateIndex
CREATE INDEX "daily_faction_task_faction_id_task_date_idx" ON "daily_faction_task"("faction_id", "task_date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_faction_task_player_id_task_date_task_type_key" ON "daily_faction_task"("player_id", "task_date", "task_type");

-- CreateIndex
CREATE INDEX "essence_transaction_log_player_id_created_at_idx" ON "essence_transaction_log"("player_id", "created_at");

-- CreateIndex
CREATE INDEX "essence_transaction_log_essence_type_created_at_idx" ON "essence_transaction_log"("essence_type", "created_at");

-- CreateIndex
CREATE INDEX "task_reward_log_player_id_created_at_idx" ON "task_reward_log"("player_id", "created_at");

-- CreateIndex
CREATE INDEX "task_reward_log_request_idempotency_key_idx" ON "task_reward_log"("request_idempotency_key");

-- CreateIndex
CREATE INDEX "idempotency_record_expires_at_idx" ON "idempotency_record"("expires_at");

-- CreateIndex
CREATE INDEX "idempotency_record_status_updated_at_idx" ON "idempotency_record"("status", "updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_record_player_id_endpoint_key_idempotency_key_key" ON "idempotency_record"("player_id", "endpoint_key", "idempotency_key");

-- CreateIndex
CREATE INDEX "player_raid_daily_state_date_key_idx" ON "player_raid_daily_state"("date_key");

-- CreateIndex
CREATE UNIQUE INDEX "player_raid_daily_state_player_id_date_key_key" ON "player_raid_daily_state"("player_id", "date_key");

-- CreateIndex
CREATE INDEX "player_raid_pair_daily_state_attacker_player_id_date_key_idx" ON "player_raid_pair_daily_state"("attacker_player_id", "date_key");

-- CreateIndex
CREATE INDEX "player_raid_pair_daily_state_defender_player_id_date_key_idx" ON "player_raid_pair_daily_state"("defender_player_id", "date_key");

-- CreateIndex
CREATE UNIQUE INDEX "player_raid_pair_daily_state_attacker_player_id_defender_pl_key" ON "player_raid_pair_daily_state"("attacker_player_id", "defender_player_id", "date_key");

-- CreateIndex
CREATE INDEX "raid_target_pool_owner_player_id_expires_at_idx" ON "raid_target_pool"("owner_player_id", "expires_at");

-- CreateIndex
CREATE INDEX "raid_target_pool_owner_player_id_refresh_batch_no_idx" ON "raid_target_pool"("owner_player_id", "refresh_batch_no");

-- CreateIndex
CREATE UNIQUE INDEX "raid_target_pool_owner_player_id_target_player_id_slot_inde_key" ON "raid_target_pool"("owner_player_id", "target_player_id", "slot_index", "refresh_batch_no");

-- CreateIndex
CREATE INDEX "raid_order_attacker_player_id_status_idx" ON "raid_order"("attacker_player_id", "status");

-- CreateIndex
CREATE INDEX "raid_order_defender_player_id_status_idx" ON "raid_order"("defender_player_id", "status");

-- CreateIndex
CREATE INDEX "raid_order_settle_at_status_idx" ON "raid_order"("settle_at", "status");

-- CreateIndex
CREATE UNIQUE INDEX "raid_order_request_idempotency_key_key" ON "raid_order"("request_idempotency_key");

-- CreateIndex
CREATE INDEX "raid_asset_lock_raid_order_id_idx" ON "raid_asset_lock"("raid_order_id");

-- CreateIndex
CREATE INDEX "raid_asset_lock_defender_player_id_status_idx" ON "raid_asset_lock"("defender_player_id", "status");

-- CreateIndex
CREATE INDEX "raid_asset_lock_expires_at_status_idx" ON "raid_asset_lock"("expires_at", "status");

-- CreateIndex
CREATE UNIQUE INDEX "raid_settlement_raid_order_id_key" ON "raid_settlement"("raid_order_id");

-- CreateIndex
CREATE INDEX "battle_report_owner_player_id_created_at_idx" ON "battle_report"("owner_player_id", "created_at");

-- CreateIndex
CREATE INDEX "battle_report_raid_order_id_idx" ON "battle_report"("raid_order_id");

-- AddForeignKey
ALTER TABLE "player" ADD CONSTRAINT "player_faction_id_fkey" FOREIGN KEY ("faction_id") REFERENCES "faction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_season_state" ADD CONSTRAINT "player_season_state_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_season_snapshot" ADD CONSTRAINT "player_season_snapshot_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_season_snapshot" ADD CONSTRAINT "player_season_snapshot_faction_id_fkey" FOREIGN KEY ("faction_id") REFERENCES "faction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_season_snapshot" ADD CONSTRAINT "player_season_snapshot_season_number_fkey" FOREIGN KEY ("season_number") REFERENCES "game_season"("season_number") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_season_sign_in" ADD CONSTRAINT "player_season_sign_in_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_season_sign_in" ADD CONSTRAINT "player_season_sign_in_season_number_fkey" FOREIGN KEY ("season_number") REFERENCES "game_season"("season_number") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_season_activity" ADD CONSTRAINT "player_season_activity_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_season_activity" ADD CONSTRAINT "player_season_activity_season_number_fkey" FOREIGN KEY ("season_number") REFERENCES "game_season"("season_number") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_season_reward_grant" ADD CONSTRAINT "player_season_reward_grant_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_season_reward_grant" ADD CONSTRAINT "player_season_reward_grant_season_number_fkey" FOREIGN KEY ("season_number") REFERENCES "game_season"("season_number") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_season_reward_grant" ADD CONSTRAINT "player_season_reward_grant_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "player_notification"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_season_achievement" ADD CONSTRAINT "player_season_achievement_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_season_achievement" ADD CONSTRAINT "player_season_achievement_season_number_fkey" FOREIGN KEY ("season_number") REFERENCES "game_season"("season_number") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_season_achievement" ADD CONSTRAINT "player_season_achievement_reward_grant_id_fkey" FOREIGN KEY ("reward_grant_id") REFERENCES "player_season_reward_grant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faction_season_snapshot" ADD CONSTRAINT "faction_season_snapshot_faction_id_fkey" FOREIGN KEY ("faction_id") REFERENCES "faction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faction_season_snapshot" ADD CONSTRAINT "faction_season_snapshot_season_number_fkey" FOREIGN KEY ("season_number") REFERENCES "game_season"("season_number") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_auth_identity" ADD CONSTRAINT "player_auth_identity_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faction_member" ADD CONSTRAINT "faction_member_faction_id_fkey" FOREIGN KEY ("faction_id") REFERENCES "faction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faction_member" ADD CONSTRAINT "faction_member_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_land_deed_progress" ADD CONSTRAINT "player_land_deed_progress_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_faction_stipend_state" ADD CONSTRAINT "player_faction_stipend_state_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_wallet" ADD CONSTRAINT "player_wallet_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_building" ADD CONSTRAINT "player_building_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_army" ADD CONSTRAINT "player_army_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "army_training_queue" ADD CONSTRAINT "army_training_queue_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_spirit_resource" ADD CONSTRAINT "player_spirit_resource_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_spirit_slot" ADD CONSTRAINT "player_spirit_slot_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_spirit_slot" ADD CONSTRAINT "player_spirit_slot_spirit_definition_id_fkey" FOREIGN KEY ("spirit_definition_id") REFERENCES "spirit_definition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_spirit_trait" ADD CONSTRAINT "player_spirit_trait_spirit_slot_id_fkey" FOREIGN KEY ("spirit_slot_id") REFERENCES "player_spirit_slot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spirit_feed_log" ADD CONSTRAINT "spirit_feed_log_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spirit_feed_log" ADD CONSTRAINT "spirit_feed_log_spirit_slot_id_fkey" FOREIGN KEY ("spirit_slot_id") REFERENCES "player_spirit_slot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spirit_breakthrough_log" ADD CONSTRAINT "spirit_breakthrough_log_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spirit_breakthrough_log" ADD CONSTRAINT "spirit_breakthrough_log_spirit_slot_id_fkey" FOREIGN KEY ("spirit_slot_id") REFERENCES "player_spirit_slot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spirit_trait_roll_log" ADD CONSTRAINT "spirit_trait_roll_log_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spirit_trait_roll_log" ADD CONSTRAINT "spirit_trait_roll_log_spirit_slot_id_fkey" FOREIGN KEY ("spirit_slot_id") REFERENCES "player_spirit_slot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spirit_shop_purchase_log" ADD CONSTRAINT "spirit_shop_purchase_log_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spirit_ad_reward_log" ADD CONSTRAINT "spirit_ad_reward_log_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_spirit_codex" ADD CONSTRAINT "player_spirit_codex_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_spirit_codex" ADD CONSTRAINT "player_spirit_codex_spirit_definition_id_fkey" FOREIGN KEY ("spirit_definition_id") REFERENCES "spirit_definition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_farm_board" ADD CONSTRAINT "player_farm_board_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raid_order_message" ADD CONSTRAINT "raid_order_message_raid_order_id_fkey" FOREIGN KEY ("raid_order_id") REFERENCES "raid_order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raid_order_message" ADD CONSTRAINT "raid_order_message_author_player_id_fkey" FOREIGN KEY ("author_player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raid_order_message" ADD CONSTRAINT "raid_order_message_receiver_player_id_fkey" FOREIGN KEY ("receiver_player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raid_order_message" ADD CONSTRAINT "raid_order_message_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "raid_message_template"("template_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_notification" ADD CONSTRAINT "player_notification_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_notification" ADD CONSTRAINT "player_notification_system_notification_id_fkey" FOREIGN KEY ("system_notification_id") REFERENCES "system_notification"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_social_relation" ADD CONSTRAINT "player_social_relation_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_social_relation" ADD CONSTRAINT "player_social_relation_target_player_id_fkey" FOREIGN KEY ("target_player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_social_feed" ADD CONSTRAINT "player_social_feed_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_social_feed" ADD CONSTRAINT "player_social_feed_actor_player_id_fkey" FOREIGN KEY ("actor_player_id") REFERENCES "player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_assist_record" ADD CONSTRAINT "player_assist_record_helper_player_id_fkey" FOREIGN KEY ("helper_player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_assist_record" ADD CONSTRAINT "player_assist_record_target_player_id_fkey" FOREIGN KEY ("target_player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_challenge" ADD CONSTRAINT "team_challenge_initiator_player_id_fkey" FOREIGN KEY ("initiator_player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_challenge" ADD CONSTRAINT "team_challenge_ally_player_id_fkey" FOREIGN KEY ("ally_player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_challenge" ADD CONSTRAINT "team_challenge_target_player_id_fkey" FOREIGN KEY ("target_player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "share_assist_campaign" ADD CONSTRAINT "share_assist_campaign_owner_player_id_fkey" FOREIGN KEY ("owner_player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "share_assist_record" ADD CONSTRAINT "share_assist_record_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "share_assist_campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "share_assist_record" ADD CONSTRAINT "share_assist_record_helper_player_id_fkey" FOREIGN KEY ("helper_player_id") REFERENCES "player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_invite_relation" ADD CONSTRAINT "player_invite_relation_inviter_player_id_fkey" FOREIGN KEY ("inviter_player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_invite_relation" ADD CONSTRAINT "player_invite_relation_invited_player_id_fkey" FOREIGN KEY ("invited_player_id") REFERENCES "player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_invite_relation" ADD CONSTRAINT "player_invite_relation_source_campaign_id_fkey" FOREIGN KEY ("source_campaign_id") REFERENCES "share_assist_campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_seed_inventory" ADD CONSTRAINT "player_seed_inventory_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_seed_inventory" ADD CONSTRAINT "player_seed_inventory_seed_definition_id_fkey" FOREIGN KEY ("seed_definition_id") REFERENCES "seed_definition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_plant_research" ADD CONSTRAINT "player_plant_research_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_plant_research" ADD CONSTRAINT "player_plant_research_seed_definition_id_fkey" FOREIGN KEY ("seed_definition_id") REFERENCES "seed_definition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_field_slot" ADD CONSTRAINT "player_field_slot_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_field_slot" ADD CONSTRAINT "player_field_slot_seed_definition_id_fkey" FOREIGN KEY ("seed_definition_id") REFERENCES "seed_definition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_daily_task_state" ADD CONSTRAINT "player_daily_task_state_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_change_log" ADD CONSTRAINT "wallet_change_log_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "robot_action_log" ADD CONSTRAINT "robot_action_log_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "robot_test_run"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "robot_action_log" ADD CONSTRAINT "robot_action_log_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "robot_sim_snapshot" ADD CONSTRAINT "robot_sim_snapshot_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "robot_test_run"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "robot_sim_snapshot" ADD CONSTRAINT "robot_sim_snapshot_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "building_upgrade_log" ADD CONSTRAINT "building_upgrade_log_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_harvest_log" ADD CONSTRAINT "field_harvest_log_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_harvest_log" ADD CONSTRAINT "field_harvest_log_field_slot_id_fkey" FOREIGN KEY ("field_slot_id") REFERENCES "player_field_slot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faction_contribution_log" ADD CONSTRAINT "faction_contribution_log_faction_id_fkey" FOREIGN KEY ("faction_id") REFERENCES "faction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faction_contribution_log" ADD CONSTRAINT "faction_contribution_log_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_faction_task" ADD CONSTRAINT "daily_faction_task_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_faction_task" ADD CONSTRAINT "daily_faction_task_faction_id_fkey" FOREIGN KEY ("faction_id") REFERENCES "faction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "essence_transaction_log" ADD CONSTRAINT "essence_transaction_log_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_reward_log" ADD CONSTRAINT "task_reward_log_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_reward_log" ADD CONSTRAINT "task_reward_log_task_state_id_fkey" FOREIGN KEY ("task_state_id") REFERENCES "player_daily_task_state"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_record" ADD CONSTRAINT "idempotency_record_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_raid_daily_state" ADD CONSTRAINT "player_raid_daily_state_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_raid_pair_daily_state" ADD CONSTRAINT "player_raid_pair_daily_state_attacker_player_id_fkey" FOREIGN KEY ("attacker_player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_raid_pair_daily_state" ADD CONSTRAINT "player_raid_pair_daily_state_defender_player_id_fkey" FOREIGN KEY ("defender_player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raid_target_pool" ADD CONSTRAINT "raid_target_pool_owner_player_id_fkey" FOREIGN KEY ("owner_player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raid_target_pool" ADD CONSTRAINT "raid_target_pool_target_player_id_fkey" FOREIGN KEY ("target_player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raid_order" ADD CONSTRAINT "raid_order_attacker_player_id_fkey" FOREIGN KEY ("attacker_player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raid_order" ADD CONSTRAINT "raid_order_defender_player_id_fkey" FOREIGN KEY ("defender_player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raid_order" ADD CONSTRAINT "raid_order_defender_field_slot_id_fkey" FOREIGN KEY ("defender_field_slot_id") REFERENCES "player_field_slot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raid_order" ADD CONSTRAINT "raid_order_source_target_pool_id_fkey" FOREIGN KEY ("source_target_pool_id") REFERENCES "raid_target_pool"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raid_asset_lock" ADD CONSTRAINT "raid_asset_lock_raid_order_id_fkey" FOREIGN KEY ("raid_order_id") REFERENCES "raid_order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raid_asset_lock" ADD CONSTRAINT "raid_asset_lock_defender_player_id_fkey" FOREIGN KEY ("defender_player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raid_asset_lock" ADD CONSTRAINT "raid_asset_lock_source_field_slot_id_fkey" FOREIGN KEY ("source_field_slot_id") REFERENCES "player_field_slot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raid_settlement" ADD CONSTRAINT "raid_settlement_raid_order_id_fkey" FOREIGN KEY ("raid_order_id") REFERENCES "raid_order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battle_report" ADD CONSTRAINT "battle_report_raid_order_id_fkey" FOREIGN KEY ("raid_order_id") REFERENCES "raid_order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battle_report" ADD CONSTRAINT "battle_report_owner_player_id_fkey" FOREIGN KEY ("owner_player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battle_report" ADD CONSTRAINT "battle_report_opponent_player_id_fkey" FOREIGN KEY ("opponent_player_id") REFERENCES "player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
