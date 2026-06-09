--
-- PostgreSQL database dump
--

\restrict mQ4dhdufXxwivefk9FNBPwIFDY7zwsKrMyEBflpbW2EgGeVLb21AI2oMkFVgbBu

-- Dumped from database version 18.4
-- Dumped by pg_dump version 18.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: ArmyTrainingStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ArmyTrainingStatus" AS ENUM (
    'QUEUED',
    'FINISHED',
    'CLAIMED',
    'CANCELLED'
);


--
-- Name: AuthProvider; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."AuthProvider" AS ENUM (
    'WECHAT',
    'DEV_FAKE'
);


--
-- Name: BattleReportType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."BattleReportType" AS ENUM (
    'ATTACK',
    'DEFENSE',
    'BOUNTY'
);


--
-- Name: DailyFactionTaskType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."DailyFactionTaskType" AS ENUM (
    'ESSENCE_SUBMIT_BASIC',
    'ESSENCE_SUBMIT_FOCUS',
    'CONFLICT_RAID'
);


--
-- Name: FieldStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."FieldStatus" AS ENUM (
    'LOCKED',
    'EMPTY',
    'GROWING',
    'MATURE',
    'WITHERED'
);


--
-- Name: NotificationAudience; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."NotificationAudience" AS ENUM (
    'GLOBAL',
    'PLAYER'
);


--
-- Name: NotificationCategory; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."NotificationCategory" AS ENUM (
    'SYSTEM',
    'ANNOUNCEMENT',
    'MAINTENANCE',
    'REWARD',
    'COMPENSATION'
);


--
-- Name: PlayerInviteRelationStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PlayerInviteRelationStatus" AS ENUM (
    'PENDING_BIND',
    'BOUND',
    'TUTORIAL_COMPLETED',
    'REWARDED',
    'INVALID'
);


--
-- Name: PlayerNotificationClaimStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PlayerNotificationClaimStatus" AS ENUM (
    'NONE',
    'UNCLAIMED',
    'CLAIMED',
    'EXPIRED'
);


--
-- Name: PlayerSpiritStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PlayerSpiritStatus" AS ENUM (
    'ACTIVE',
    'WOUNDED',
    'RESTING',
    'DISSOLVED'
);


--
-- Name: RaidAssetLockMode; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."RaidAssetLockMode" AS ENUM (
    'SOFT',
    'HARD'
);


--
-- Name: RaidAssetLockStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."RaidAssetLockStatus" AS ENUM (
    'ACTIVE',
    'RELEASED',
    'CONSUMED',
    'EXPIRED'
);


--
-- Name: RaidOrderMode; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."RaidOrderMode" AS ENUM (
    'SINGLE',
    'BOUNTY'
);


--
-- Name: RaidOrderStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."RaidOrderStatus" AS ENUM (
    'CREATED',
    'LOCKED',
    'SETTLING',
    'SETTLED',
    'SETTLEMENT_FAILED',
    'CANCELLED',
    'BOUNTY_CREATED',
    'BOUNTY_WAITING_PARTNER',
    'BOUNTY_ACCEPTED',
    'BOUNTY_EXPIRED'
);


--
-- Name: RaidSettlementResult; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."RaidSettlementResult" AS ENUM (
    'WIN',
    'LOSS',
    'DRAW',
    'CANCELLED'
);


--
-- Name: ShareAssistCampaignStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ShareAssistCampaignStatus" AS ENUM (
    'ACTIVE',
    'FULL',
    'EXPIRED',
    'CANCELLED'
);


--
-- Name: ShareAssistCampaignType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ShareAssistCampaignType" AS ENUM (
    'WATER',
    'FRIEND_INVITE'
);


--
-- Name: ShareAssistRecordAudience; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ShareAssistRecordAudience" AS ENUM (
    'GUEST',
    'PLAYER'
);


--
-- Name: ShareAssistRecordStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ShareAssistRecordStatus" AS ENUM (
    'CONFIRMED',
    'BOUND',
    'REWARDED',
    'REJECTED'
);


--
-- Name: SocialAssistType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."SocialAssistType" AS ENUM (
    'WATER_FIELD',
    'GUARD_FIELD',
    'RECOVER_SPIRIT',
    'FACTION_TASK_HELP',
    'HARVEST_FIELD'
);


--
-- Name: SocialFeedType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."SocialFeedType" AS ENUM (
    'FRIEND_WATERED_FIELD',
    'FRIEND_GUARDED_FIELD',
    'TEAM_CHALLENGE_INVITED',
    'TEAM_CHALLENGE_ACCEPTED',
    'ENEMY_RAIDED',
    'REVENGE_AVAILABLE',
    'FACTION_HELP_REQUESTED',
    'FRIEND_REQUESTED',
    'FRIEND_ACCEPTED',
    'FRIEND_REJECTED'
);


--
-- Name: SocialRelationStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."SocialRelationStatus" AS ENUM (
    'ACTIVE',
    'PENDING',
    'MUTED'
);


--
-- Name: SocialRelationType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."SocialRelationType" AS ENUM (
    'FRIEND',
    'FOLLOWING',
    'ENEMY',
    'BLOCKED'
);


--
-- Name: SpiritElement; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."SpiritElement" AS ENUM (
    'METAL',
    'WOOD',
    'WATER',
    'FIRE',
    'EARTH'
);


--
-- Name: SpiritRarity; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."SpiritRarity" AS ENUM (
    'COMMON',
    'RARE',
    'LEGENDARY'
);


--
-- Name: SpiritRole; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."SpiritRole" AS ENUM (
    'ATTACK',
    'BALANCED',
    'HEALTH'
);


--
-- Name: TaskStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."TaskStatus" AS ENUM (
    'IN_PROGRESS',
    'COMPLETED',
    'CLAIMED'
);


--
-- Name: TeamChallengeStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."TeamChallengeStatus" AS ENUM (
    'PENDING',
    'ACCEPTED',
    'REJECTED',
    'EXPIRED',
    'SETTLED'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


--
-- Name: admin_operation_audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_operation_audit_log (
    id text NOT NULL,
    action text NOT NULL,
    target_type text NOT NULL,
    target_id text NOT NULL,
    admin_actor text DEFAULT 'admin-console'::text NOT NULL,
    reason text NOT NULL,
    confirm_text text NOT NULL,
    metadata_json jsonb,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: army_training_queue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.army_training_queue (
    id text NOT NULL,
    player_id text NOT NULL,
    queued_count integer NOT NULL,
    unit_cost_gold integer NOT NULL,
    total_cost_gold integer NOT NULL,
    started_at timestamp(3) without time zone NOT NULL,
    finish_at timestamp(3) without time zone NOT NULL,
    status public."ArmyTrainingStatus" DEFAULT 'QUEUED'::public."ArmyTrainingStatus" NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: battle_report; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.battle_report (
    id text NOT NULL,
    raid_order_id text NOT NULL,
    owner_player_id text NOT NULL,
    opponent_player_id text NOT NULL,
    report_type public."BattleReportType" NOT NULL,
    result public."RaidSettlementResult" NOT NULL,
    title text NOT NULL,
    summary text NOT NULL,
    revenge_available boolean DEFAULT false NOT NULL,
    revoked_at timestamp(3) without time zone,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: building_upgrade_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.building_upgrade_log (
    id text NOT NULL,
    player_id text NOT NULL,
    building_key text NOT NULL,
    old_level integer NOT NULL,
    new_level integer NOT NULL,
    cost_gold integer NOT NULL,
    request_idempotency_key text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: daily_faction_task; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.daily_faction_task (
    id text NOT NULL,
    player_id text NOT NULL,
    faction_id text NOT NULL,
    task_date text NOT NULL,
    task_type public."DailyFactionTaskType" NOT NULL,
    required_essence_type text,
    required_amount integer NOT NULL,
    progress_amount integer DEFAULT 0 NOT NULL,
    reward_contribution integer NOT NULL,
    status public."TaskStatus" DEFAULT 'IN_PROGRESS'::public."TaskStatus" NOT NULL,
    generated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    completed_at timestamp(3) without time zone,
    refreshed_from_task_id text
);


--
-- Name: essence_transaction_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.essence_transaction_log (
    id text NOT NULL,
    player_id text NOT NULL,
    essence_type text NOT NULL,
    delta integer NOT NULL,
    reason text NOT NULL,
    source_id text,
    balance_after integer NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: faction; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.faction (
    id text NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    treasury_gold integer DEFAULT 0 NOT NULL,
    hourly_base_dividend integer DEFAULT 0 NOT NULL,
    hourly_contribution_dividend_per_ten integer DEFAULT 0 NOT NULL,
    contribution_score integer DEFAULT 0 NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: faction_contribution_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.faction_contribution_log (
    id text NOT NULL,
    faction_id text NOT NULL,
    player_id text NOT NULL,
    donated_gold integer DEFAULT 0 NOT NULL,
    contribution_delta integer NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    source_type text DEFAULT 'gold-donation'::text NOT NULL,
    source_id text,
    metadata_json jsonb
);


--
-- Name: faction_member; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.faction_member (
    id text NOT NULL,
    faction_id text NOT NULL,
    player_id text NOT NULL,
    contribution_score integer DEFAULT 0 NOT NULL,
    joined_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: faction_season_snapshot; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.faction_season_snapshot (
    id text NOT NULL,
    faction_id text NOT NULL,
    season_number integer NOT NULL,
    contribution_score integer DEFAULT 0 NOT NULL,
    member_count integer DEFAULT 0 NOT NULL,
    final_rank integer,
    snapshot_json jsonb NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: field_harvest_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.field_harvest_log (
    id text NOT NULL,
    player_id text NOT NULL,
    field_slot_id text NOT NULL,
    collect_mode text NOT NULL,
    collected_gold integer NOT NULL,
    overflow_gold integer NOT NULL,
    reward_items_json jsonb,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    seed_id text
);


--
-- Name: game_season; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.game_season (
    season_number integer NOT NULL,
    starts_at timestamp(3) without time zone NOT NULL,
    ends_at timestamp(3) without time zone NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: idempotency_record; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.idempotency_record (
    id text NOT NULL,
    player_id text NOT NULL,
    endpoint_key text NOT NULL,
    idempotency_key text NOT NULL,
    request_hash text NOT NULL,
    status text NOT NULL,
    response_snapshot_json jsonb,
    business_entity_type text,
    business_entity_id text,
    expires_at timestamp(3) without time zone,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: player; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.player (
    id text NOT NULL,
    nickname text NOT NULL,
    avatar_url text,
    faction_id text,
    castle_level_cache integer DEFAULT 1 NOT NULL,
    last_login_at timestamp(3) without time zone,
    state_version integer DEFAULT 1 NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    protected_until timestamp(3) without time zone
);


--
-- Name: player_army; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.player_army (
    player_id text NOT NULL,
    total_count integer DEFAULT 0 NOT NULL,
    available_count integer DEFAULT 0 NOT NULL,
    frozen_count integer DEFAULT 0 NOT NULL,
    wounded_count integer DEFAULT 0 NOT NULL,
    capacity integer DEFAULT 0 NOT NULL,
    army_version integer DEFAULT 1 NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: player_assist_record; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.player_assist_record (
    id text NOT NULL,
    helper_player_id text NOT NULL,
    target_player_id text NOT NULL,
    assist_type public."SocialAssistType" NOT NULL,
    target_entity_type text,
    target_entity_id text,
    effect_value integer DEFAULT 0 NOT NULL,
    date_key text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    intimacy_gain integer DEFAULT 0 NOT NULL
);


--
-- Name: player_auth_identity; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.player_auth_identity (
    id text NOT NULL,
    player_id text NOT NULL,
    provider public."AuthProvider" NOT NULL,
    provider_user_id text NOT NULL,
    union_id text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: player_building; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.player_building (
    player_id text NOT NULL,
    castle_level integer DEFAULT 1 NOT NULL,
    vault_level integer DEFAULT 1 NOT NULL,
    field_slot_level integer DEFAULT 1 NOT NULL,
    population_level integer DEFAULT 1 NOT NULL,
    watchtower_level integer DEFAULT 1 NOT NULL,
    protection_tech_level integer DEFAULT 0 NOT NULL,
    farm_yield_tech_level integer DEFAULT 0 NOT NULL,
    collect_window_tech_level integer DEFAULT 0 CONSTRAINT player_building_ripe_window_tech_level_not_null NOT NULL,
    pending_claim_tech_level integer DEFAULT 0 NOT NULL,
    building_version integer DEFAULT 1 NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: player_daily_task_state; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.player_daily_task_state (
    id text NOT NULL,
    player_id text NOT NULL,
    date_key text NOT NULL,
    task_id text NOT NULL,
    progress integer DEFAULT 0 NOT NULL,
    target integer NOT NULL,
    status public."TaskStatus" DEFAULT 'IN_PROGRESS'::public."TaskStatus" NOT NULL,
    reward_gold integer NOT NULL,
    action_scene text NOT NULL,
    claimed_at timestamp(3) without time zone,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: player_faction_stipend_state; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.player_faction_stipend_state (
    id text NOT NULL,
    player_id text NOT NULL,
    date_key text NOT NULL,
    contribution_snapshot integer NOT NULL,
    tier_key text NOT NULL,
    reward_json jsonb NOT NULL,
    claimed_at timestamp(3) without time zone,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: player_farm_board; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.player_farm_board (
    player_id text NOT NULL,
    message text DEFAULT ''::text NOT NULL,
    board_version integer DEFAULT 1 NOT NULL,
    hidden_at timestamp(3) without time zone,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    CONSTRAINT player_farm_board_message_length_check CHECK ((char_length(message) <= 40))
);


--
-- Name: player_field_slot; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.player_field_slot (
    id text NOT NULL,
    player_id text NOT NULL,
    slot_index integer NOT NULL,
    is_unlocked boolean DEFAULT false NOT NULL,
    unlock_castle_level integer NOT NULL,
    status public."FieldStatus" DEFAULT 'LOCKED'::public."FieldStatus" NOT NULL,
    seed_definition_id text,
    invested_gold integer DEFAULT 0 NOT NULL,
    current_claimable_gold integer DEFAULT 0 NOT NULL,
    harvested_gold_total integer DEFAULT 0 NOT NULL,
    raided_gold_total integer DEFAULT 0 NOT NULL,
    seed_at timestamp(3) without time zone,
    mature_at timestamp(3) without time zone,
    ready_at timestamp(3) without time zone,
    overripe_at timestamp(3) without time zone,
    last_calculated_at timestamp(3) without time zone,
    status_version integer DEFAULT 1 NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    expected_essence_yield integer DEFAULT 0 NOT NULL,
    stolen_essence_yield integer DEFAULT 0 NOT NULL,
    harvested_essence_yield integer DEFAULT 0 NOT NULL,
    last_stolen_at timestamp(3) without time zone
);


--
-- Name: player_invite_relation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.player_invite_relation (
    id text NOT NULL,
    inviter_player_id text NOT NULL,
    invited_player_id text,
    invited_openid_hash text,
    source_campaign_id text,
    status public."PlayerInviteRelationStatus" DEFAULT 'PENDING_BIND'::public."PlayerInviteRelationStatus" NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    bound_at timestamp(3) without time zone,
    rewarded_at timestamp(3) without time zone
);


--
-- Name: player_land_deed_progress; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.player_land_deed_progress (
    id text NOT NULL,
    player_id text NOT NULL,
    deed_key text NOT NULL,
    status text DEFAULT 'in_progress'::text NOT NULL,
    progress_json jsonb NOT NULL,
    claimed_at timestamp(3) without time zone,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    CONSTRAINT player_land_deed_progress_status_check CHECK ((status = ANY (ARRAY['locked'::text, 'in_progress'::text, 'completed'::text, 'claimed'::text])))
);


--
-- Name: player_notification; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.player_notification (
    id text NOT NULL,
    player_id text NOT NULL,
    system_notification_id text,
    category public."NotificationCategory" DEFAULT 'SYSTEM'::public."NotificationCategory" NOT NULL,
    title_snapshot text NOT NULL,
    body_snapshot text NOT NULL,
    attachment_json jsonb,
    claim_status public."PlayerNotificationClaimStatus" DEFAULT 'NONE'::public."PlayerNotificationClaimStatus" NOT NULL,
    read_at timestamp(3) without time zone,
    deleted_at timestamp(3) without time zone,
    claimed_at timestamp(3) without time zone,
    expires_at timestamp(3) without time zone,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    CONSTRAINT player_notification_body_snapshot_length_check CHECK (((char_length(body_snapshot) >= 1) AND (char_length(body_snapshot) <= 1000))),
    CONSTRAINT player_notification_claim_consistency_check CHECK ((((attachment_json IS NULL) AND (claim_status = 'NONE'::public."PlayerNotificationClaimStatus")) OR ((attachment_json IS NOT NULL) AND (claim_status = ANY (ARRAY['UNCLAIMED'::public."PlayerNotificationClaimStatus", 'CLAIMED'::public."PlayerNotificationClaimStatus", 'EXPIRED'::public."PlayerNotificationClaimStatus"]))))),
    CONSTRAINT player_notification_title_snapshot_length_check CHECK (((char_length(title_snapshot) >= 1) AND (char_length(title_snapshot) <= 80)))
);


--
-- Name: player_plant_research; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.player_plant_research (
    id text NOT NULL,
    player_id text NOT NULL,
    seed_definition_id text NOT NULL,
    discovered_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    research_version integer DEFAULT 1 NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: player_season_achievement; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.player_season_achievement (
    id text NOT NULL,
    player_id text NOT NULL,
    season_number integer NOT NULL,
    domain text NOT NULL,
    achievement_key text NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    contribution_snapshot integer DEFAULT 0 NOT NULL,
    stat_snapshot_json jsonb NOT NULL,
    reward_grant_id text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: player_season_activity; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.player_season_activity (
    id text NOT NULL,
    player_id text NOT NULL,
    season_number integer NOT NULL,
    date_key text NOT NULL,
    first_seen_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    last_seen_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: player_season_reward_grant; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.player_season_reward_grant (
    id text NOT NULL,
    player_id text NOT NULL,
    season_number integer NOT NULL,
    reward_type text NOT NULL,
    reward_tier text,
    status text DEFAULT 'generated'::text NOT NULL,
    contribution_snapshot integer DEFAULT 0 NOT NULL,
    sign_in_days integer DEFAULT 0 NOT NULL,
    login_days integer DEFAULT 0 NOT NULL,
    harvest_count integer DEFAULT 0 NOT NULL,
    raid_count integer DEFAULT 0 NOT NULL,
    reward_json jsonb NOT NULL,
    claimed_at timestamp(3) without time zone,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    notification_id text
);


--
-- Name: player_season_sign_in; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.player_season_sign_in (
    id text NOT NULL,
    player_id text NOT NULL,
    season_number integer NOT NULL,
    day_index integer NOT NULL,
    reward_tianji_talisman integer NOT NULL,
    claimed_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: player_season_snapshot; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.player_season_snapshot (
    id text NOT NULL,
    player_id text NOT NULL,
    season_number integer NOT NULL,
    faction_id text,
    contribution_score integer DEFAULT 0 NOT NULL,
    sign_in_days integer DEFAULT 0 NOT NULL,
    login_days integer DEFAULT 0 NOT NULL,
    harvest_count integer DEFAULT 0 NOT NULL,
    raid_count integer DEFAULT 0 NOT NULL,
    final_rank integer,
    reward_tier text,
    snapshot_json jsonb NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: player_season_state; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.player_season_state (
    player_id text NOT NULL,
    current_season_number integer NOT NULL,
    last_reset_season_number integer DEFAULT 1 NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: player_seed_inventory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.player_seed_inventory (
    id text NOT NULL,
    player_id text NOT NULL,
    seed_definition_id text NOT NULL,
    quantity integer DEFAULT 0 NOT NULL,
    inventory_version integer DEFAULT 1 NOT NULL,
    unlocked_at timestamp(3) without time zone,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: player_social_feed; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.player_social_feed (
    id text NOT NULL,
    player_id text NOT NULL,
    actor_player_id text,
    feed_type public."SocialFeedType" NOT NULL,
    related_entity_type text,
    related_entity_id text,
    summary text NOT NULL,
    metadata_json jsonb,
    is_read boolean DEFAULT false NOT NULL,
    expires_at timestamp(3) without time zone,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: player_social_relation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.player_social_relation (
    id text NOT NULL,
    player_id text NOT NULL,
    target_player_id text NOT NULL,
    relation_type public."SocialRelationType" NOT NULL,
    status public."SocialRelationStatus" DEFAULT 'ACTIVE'::public."SocialRelationStatus" NOT NULL,
    source_type text DEFAULT 'manual'::text NOT NULL,
    intimacy integer DEFAULT 0 NOT NULL,
    last_interacted_at timestamp(3) without time zone,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: player_spirit_codex; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.player_spirit_codex (
    id text NOT NULL,
    player_id text NOT NULL,
    spirit_definition_id text NOT NULL,
    has_seen boolean DEFAULT false NOT NULL,
    shard_count integer DEFAULT 0 NOT NULL,
    ready_to_compose boolean DEFAULT false NOT NULL,
    owned_current boolean DEFAULT false NOT NULL,
    owned_ever boolean DEFAULT false NOT NULL,
    first_seen_at timestamp(3) without time zone,
    ready_at timestamp(3) without time zone,
    last_owned_at timestamp(3) without time zone,
    codex_version integer DEFAULT 1 NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    CONSTRAINT player_spirit_codex_ready_check CHECK (((ready_to_compose = false) OR (shard_count = 100))),
    CONSTRAINT player_spirit_codex_shard_count_check CHECK (((shard_count >= 0) AND (shard_count <= 100)))
);


--
-- Name: player_spirit_resource; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.player_spirit_resource (
    player_id text NOT NULL,
    spirit_soul integer DEFAULT 0 NOT NULL,
    daily_recovery_used integer DEFAULT 0 NOT NULL,
    resource_version integer DEFAULT 1 NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    tianji_talisman integer DEFAULT 0 NOT NULL,
    daily_intel_free_used integer DEFAULT 0 NOT NULL,
    daily_intel_talisman_used integer DEFAULT 0 NOT NULL,
    daily_recovery_date_key text,
    daily_intel_date_key text,
    daily_tianji_claim_date_key text,
    daily_starter_seed_claim_date_key text,
    daily_spirit_soul_claim_date_key text,
    spirit_root integer DEFAULT 0 NOT NULL,
    spirit_marrow integer DEFAULT 0 NOT NULL,
    spirit_jade integer DEFAULT 0 NOT NULL,
    ordinary_soul integer DEFAULT 0 NOT NULL,
    rare_soul integer DEFAULT 0 NOT NULL,
    legendary_soul integer DEFAULT 0 NOT NULL,
    CONSTRAINT player_spirit_resource_daily_intel_free_used_check CHECK ((daily_intel_free_used >= 0)),
    CONSTRAINT player_spirit_resource_daily_intel_talisman_used_check CHECK ((daily_intel_talisman_used >= 0)),
    CONSTRAINT player_spirit_resource_daily_recovery_used_check CHECK ((daily_recovery_used >= 0)),
    CONSTRAINT player_spirit_resource_spirit_soul_check CHECK ((spirit_soul >= 0)),
    CONSTRAINT player_spirit_resource_tianji_talisman_check CHECK ((tianji_talisman >= 0))
);


--
-- Name: player_spirit_slot; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.player_spirit_slot (
    id text NOT NULL,
    player_id text NOT NULL,
    slot_index integer NOT NULL,
    spirit_definition_id text,
    is_main boolean DEFAULT false NOT NULL,
    level integer DEFAULT 1 NOT NULL,
    exp integer DEFAULT 0 NOT NULL,
    element public."SpiritElement",
    current_hp integer DEFAULT 0 NOT NULL,
    max_hp integer DEFAULT 0 NOT NULL,
    status public."PlayerSpiritStatus" DEFAULT 'ACTIVE'::public."PlayerSpiritStatus" NOT NULL,
    acquired_at timestamp(3) without time zone,
    dissolved_at timestamp(3) without time zone,
    slot_version integer DEFAULT 1 NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    breakthrough_stage integer DEFAULT 0 NOT NULL,
    satiated_until timestamp(3) without time zone,
    last_exp_settled_at timestamp(3) without time zone,
    CONSTRAINT player_spirit_slot_exp_check CHECK ((exp >= 0)),
    CONSTRAINT player_spirit_slot_filled_state_check CHECK ((((spirit_definition_id IS NULL) AND (element IS NULL) AND (is_main = false) AND (current_hp = 0) AND (max_hp = 0)) OR ((spirit_definition_id IS NOT NULL) AND (element IS NOT NULL) AND (max_hp > 0)))),
    CONSTRAINT player_spirit_slot_hp_check CHECK (((current_hp >= 0) AND (max_hp >= 0) AND (current_hp <= max_hp))),
    CONSTRAINT player_spirit_slot_level_check CHECK (((level >= 1) AND (level <= 50))),
    CONSTRAINT player_spirit_slot_slot_index_check CHECK (((slot_index >= 1) AND (slot_index <= 5)))
);


--
-- Name: player_spirit_trait; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.player_spirit_trait (
    id text NOT NULL,
    spirit_slot_id text NOT NULL,
    slot_index integer NOT NULL,
    trait_code text NOT NULL,
    trait_value integer NOT NULL,
    source_type text NOT NULL,
    locked_at timestamp(3) without time zone,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: player_wallet; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.player_wallet (
    player_id text NOT NULL,
    vault_gold integer DEFAULT 0 NOT NULL,
    vault_capacity integer DEFAULT 0 NOT NULL,
    wallet_gold integer DEFAULT 0 NOT NULL,
    wallet_capacity integer DEFAULT 0 NOT NULL,
    wallet_protected_ratio integer DEFAULT 0 NOT NULL,
    pending_tax_gold integer DEFAULT 0 NOT NULL,
    pending_dividend_gold integer DEFAULT 0 NOT NULL,
    pending_raid_overflow_gold integer DEFAULT 0 NOT NULL,
    pending_raid_overflow_expires_at timestamp(3) without time zone,
    balance_version integer DEFAULT 1 NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    passive_settled_at timestamp(3) without time zone
);


--
-- Name: raid_asset_lock; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.raid_asset_lock (
    id text NOT NULL,
    raid_order_id text NOT NULL,
    defender_player_id text NOT NULL,
    asset_type text NOT NULL,
    source_entity_id text,
    source_field_slot_id text,
    locked_gold integer DEFAULT 0 NOT NULL,
    locked_item_json jsonb,
    lock_mode public."RaidAssetLockMode" NOT NULL,
    status public."RaidAssetLockStatus" DEFAULT 'ACTIVE'::public."RaidAssetLockStatus" NOT NULL,
    expires_at timestamp(3) without time zone,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: raid_message_template; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.raid_message_template (
    id text NOT NULL,
    template_id text NOT NULL,
    text text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    CONSTRAINT raid_message_template_text_length_check CHECK ((char_length(text) <= 40))
);


--
-- Name: raid_order; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.raid_order (
    id text NOT NULL,
    attacker_player_id text NOT NULL,
    defender_player_id text NOT NULL,
    defender_field_slot_id text,
    source_target_pool_id text,
    mode public."RaidOrderMode" NOT NULL,
    status public."RaidOrderStatus" DEFAULT 'CREATED'::public."RaidOrderStatus" NOT NULL,
    dispatched_unit_count integer NOT NULL,
    frozen_unit_snapshot jsonb NOT NULL,
    transport_capacity_snapshot integer NOT NULL,
    attacker_snapshot_json jsonb NOT NULL,
    defender_snapshot_json jsonb NOT NULL,
    dispatched_at timestamp(3) without time zone NOT NULL,
    settle_at timestamp(3) without time zone NOT NULL,
    settled_at timestamp(3) without time zone,
    request_idempotency_key text NOT NULL,
    settlement_version integer DEFAULT 1 NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: raid_order_message; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.raid_order_message (
    id text NOT NULL,
    raid_order_id text NOT NULL,
    author_player_id text NOT NULL,
    receiver_player_id text NOT NULL,
    template_id text NOT NULL,
    text_snapshot text NOT NULL,
    is_hidden boolean DEFAULT false NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    CONSTRAINT raid_order_message_text_snapshot_length_check CHECK ((char_length(text_snapshot) <= 40))
);


--
-- Name: raid_settlement; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.raid_settlement (
    id text NOT NULL,
    raid_order_id text NOT NULL,
    result public."RaidSettlementResult" NOT NULL,
    loot_gold integer DEFAULT 0 NOT NULL,
    deposited_gold integer DEFAULT 0 NOT NULL,
    overflow_gold integer DEFAULT 0 NOT NULL,
    temporary_claim_expires_at timestamp(3) without time zone,
    attacker_loss integer DEFAULT 0 NOT NULL,
    defender_loss integer DEFAULT 0 NOT NULL,
    reward_items_json jsonb,
    report_summary text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    battle_replay_json jsonb
);


--
-- Name: raid_target_pool; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.raid_target_pool (
    id text NOT NULL,
    owner_player_id text NOT NULL,
    target_player_id text NOT NULL,
    slot_index integer NOT NULL,
    target_snapshot_json jsonb NOT NULL,
    field_snapshot_json jsonb,
    risk_snapshot_json jsonb,
    refresh_batch_no integer NOT NULL,
    expires_at timestamp(3) without time zone NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: robot_action_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.robot_action_log (
    id text NOT NULL,
    run_id text NOT NULL,
    robot_key text NOT NULL,
    robot_role text NOT NULL,
    player_id text NOT NULL,
    action_name text NOT NULL,
    status text NOT NULL,
    duration_ms integer DEFAULT 0 NOT NULL,
    error_code text,
    error_message text,
    request_summary_json jsonb,
    result_summary_json jsonb,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: robot_automation_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.robot_automation_config (
    id text NOT NULL,
    mode text NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    interval_seconds integer DEFAULT 10 NOT NULL,
    max_rounds integer DEFAULT 20 NOT NULL,
    hard_error_limit integer DEFAULT 3 NOT NULL,
    auto_start_on_boot boolean DEFAULT false NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: robot_automation_job; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.robot_automation_job (
    id text NOT NULL,
    name text NOT NULL,
    mode text NOT NULL,
    status text DEFAULT 'RUNNING'::text NOT NULL,
    interval_seconds integer NOT NULL,
    max_rounds integer NOT NULL,
    hard_error_limit integer NOT NULL,
    completed_rounds integer DEFAULT 0 NOT NULL,
    consecutive_hard_errors integer DEFAULT 0 NOT NULL,
    last_run_id text,
    last_status text,
    last_error text,
    stop_reason text,
    started_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    stopped_at timestamp(3) without time zone,
    last_run_at timestamp(3) without time zone,
    next_run_at timestamp(3) without time zone,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: robot_sim_snapshot; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.robot_sim_snapshot (
    id text NOT NULL,
    run_id text NOT NULL,
    mode text NOT NULL,
    robot_key text NOT NULL,
    player_id text NOT NULL,
    faction_code text,
    vault_gold integer DEFAULT 0 NOT NULL,
    wallet_gold integer DEFAULT 0 NOT NULL,
    contribution_score integer DEFAULT 0 NOT NULL,
    spirit_soul integer DEFAULT 0 NOT NULL,
    ordinary_soul integer DEFAULT 0 NOT NULL,
    rare_soul integer DEFAULT 0 NOT NULL,
    legendary_soul integer DEFAULT 0 NOT NULL,
    main_spirit_level integer,
    main_spirit_stage integer,
    army_total integer DEFAULT 0 NOT NULL,
    army_available integer DEFAULT 0 NOT NULL,
    army_capacity integer DEFAULT 0 NOT NULL,
    queued_army integer DEFAULT 0 NOT NULL,
    mature_fields integer DEFAULT 0 NOT NULL,
    growing_fields integer DEFAULT 0 NOT NULL,
    empty_fields integer DEFAULT 0 NOT NULL,
    success_action_count integer DEFAULT 0 NOT NULL,
    blocked_action_count integer DEFAULT 0 NOT NULL,
    failed_action_count integer DEFAULT 0 NOT NULL,
    action_summary_json jsonb,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: robot_test_run; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.robot_test_run (
    id text NOT NULL,
    name text NOT NULL,
    mode text NOT NULL,
    status text DEFAULT 'RUNNING'::text NOT NULL,
    planned_robot_count integer DEFAULT 0 NOT NULL,
    success_action_count integer DEFAULT 0 NOT NULL,
    failed_action_count integer DEFAULT 0 NOT NULL,
    summary text,
    started_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    finished_at timestamp(3) without time zone,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: seed_definition; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.seed_definition (
    id text NOT NULL,
    seed_id text NOT NULL,
    label text NOT NULL,
    rarity text NOT NULL,
    grow_seconds integer NOT NULL,
    mature_seconds integer NOT NULL,
    collect_window_seconds integer CONSTRAINT seed_definition_ripe_window_seconds_not_null NOT NULL,
    base_yield_gold integer NOT NULL,
    harvest_seed_return integer DEFAULT 0 NOT NULL,
    strategy_note text,
    lore text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL
);


--
-- Name: share_assist_campaign; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.share_assist_campaign (
    id text NOT NULL,
    owner_player_id text NOT NULL,
    campaign_type public."ShareAssistCampaignType" NOT NULL,
    target_entity_type text,
    target_entity_id text,
    status public."ShareAssistCampaignStatus" DEFAULT 'ACTIVE'::public."ShareAssistCampaignStatus" NOT NULL,
    max_assist_count integer DEFAULT 3 NOT NULL,
    current_assist_count integer DEFAULT 0 NOT NULL,
    expires_at timestamp(3) without time zone NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: share_assist_record; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.share_assist_record (
    id text NOT NULL,
    campaign_id text NOT NULL,
    helper_player_id text,
    helper_openid_hash text,
    helper_device_hash text,
    helper_audience public."ShareAssistRecordAudience" NOT NULL,
    status public."ShareAssistRecordStatus" DEFAULT 'CONFIRMED'::public."ShareAssistRecordStatus" NOT NULL,
    assist_record_id text,
    reward_claimed_at timestamp(3) without time zone,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    bound_at timestamp(3) without time zone
);


--
-- Name: spirit_ad_reward_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.spirit_ad_reward_log (
    id text NOT NULL,
    player_id text NOT NULL,
    date_key text NOT NULL,
    tianji_talisman_reward integer NOT NULL,
    bonus_reward_json jsonb NOT NULL,
    request_idempotency_key text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: spirit_breakthrough_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.spirit_breakthrough_log (
    id text NOT NULL,
    player_id text NOT NULL,
    spirit_slot_id text NOT NULL,
    from_stage integer NOT NULL,
    to_stage integer NOT NULL,
    consumed_soul_quality text NOT NULL,
    consumed_soul_count integer NOT NULL,
    request_idempotency_key text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: spirit_definition; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.spirit_definition (
    id text NOT NULL,
    spirit_id text NOT NULL,
    label text NOT NULL,
    rarity public."SpiritRarity" NOT NULL,
    faction_affinity text NOT NULL,
    role public."SpiritRole" NOT NULL,
    shard_name text NOT NULL,
    shard_unlock_required integer DEFAULT 100 NOT NULL,
    base_attack integer NOT NULL,
    base_hp integer NOT NULL,
    growth_attack integer NOT NULL,
    growth_hp integer NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    lore text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    CONSTRAINT spirit_definition_shard_unlock_required_check CHECK ((shard_unlock_required = 100))
);


--
-- Name: spirit_feed_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.spirit_feed_log (
    id text NOT NULL,
    player_id text NOT NULL,
    spirit_slot_id text NOT NULL,
    action_type text NOT NULL,
    feed_count integer NOT NULL,
    satiated_seconds_added integer NOT NULL,
    immediate_exp_gain integer NOT NULL,
    before_satiated_until timestamp(3) without time zone,
    after_satiated_until timestamp(3) without time zone,
    request_idempotency_key text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: spirit_shop_purchase_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.spirit_shop_purchase_log (
    id text NOT NULL,
    player_id text NOT NULL,
    item_id text NOT NULL,
    period_key text,
    consumed_tianji_talisman integer NOT NULL,
    reward_json jsonb NOT NULL,
    request_idempotency_key text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: spirit_trait_roll_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.spirit_trait_roll_log (
    id text NOT NULL,
    player_id text NOT NULL,
    spirit_slot_id text NOT NULL,
    mode text NOT NULL,
    locked_slot_index integer,
    target_slot_index integer,
    target_trait_code text,
    consumed_json jsonb NOT NULL,
    before_traits_json jsonb NOT NULL,
    result_traits_json jsonb NOT NULL,
    candidate_results_json jsonb,
    request_idempotency_key text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: system_notification; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_notification (
    id text NOT NULL,
    audience public."NotificationAudience" NOT NULL,
    category public."NotificationCategory" DEFAULT 'SYSTEM'::public."NotificationCategory" NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    created_by_admin text,
    starts_at timestamp(3) without time zone,
    expires_at timestamp(3) without time zone,
    revoked_at timestamp(3) without time zone,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    CONSTRAINT system_notification_body_length_check CHECK (((char_length(body) >= 1) AND (char_length(body) <= 1000))),
    CONSTRAINT system_notification_title_length_check CHECK (((char_length(title) >= 1) AND (char_length(title) <= 80)))
);


--
-- Name: task_config_override; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_config_override (
    id text NOT NULL,
    task_group text NOT NULL,
    task_id text NOT NULL,
    title text,
    description text,
    target_count integer,
    reward_gold integer,
    reward_contribution integer,
    is_enabled boolean DEFAULT true NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: task_reward_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_reward_log (
    id text NOT NULL,
    player_id text NOT NULL,
    task_state_id text,
    task_id text NOT NULL,
    reward_gold integer NOT NULL,
    request_idempotency_key text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: team_challenge; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.team_challenge (
    id text NOT NULL,
    initiator_player_id text NOT NULL,
    ally_player_id text NOT NULL,
    target_player_id text NOT NULL,
    status public."TeamChallengeStatus" DEFAULT 'PENDING'::public."TeamChallengeStatus" NOT NULL,
    initiator_power_snapshot integer DEFAULT 0 NOT NULL,
    ally_power_snapshot integer DEFAULT 0 NOT NULL,
    target_power_snapshot integer DEFAULT 0 NOT NULL,
    assist_efficiency_bps integer DEFAULT 6000 NOT NULL,
    result text,
    reward_json jsonb,
    expires_at timestamp(3) without time zone NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    settled_at timestamp(3) without time zone
);


--
-- Name: wallet_change_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wallet_change_log (
    id text NOT NULL,
    player_id text NOT NULL,
    wallet_bucket text NOT NULL,
    change_type text NOT NULL,
    delta_gold integer NOT NULL,
    before_gold integer NOT NULL,
    after_gold integer NOT NULL,
    related_entity_type text,
    related_entity_id text,
    request_idempotency_key text,
    note text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: admin_operation_audit_log admin_operation_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_operation_audit_log
    ADD CONSTRAINT admin_operation_audit_log_pkey PRIMARY KEY (id);


--
-- Name: army_training_queue army_training_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.army_training_queue
    ADD CONSTRAINT army_training_queue_pkey PRIMARY KEY (id);


--
-- Name: battle_report battle_report_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.battle_report
    ADD CONSTRAINT battle_report_pkey PRIMARY KEY (id);


--
-- Name: building_upgrade_log building_upgrade_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.building_upgrade_log
    ADD CONSTRAINT building_upgrade_log_pkey PRIMARY KEY (id);


--
-- Name: daily_faction_task daily_faction_task_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_faction_task
    ADD CONSTRAINT daily_faction_task_pkey PRIMARY KEY (id);


--
-- Name: essence_transaction_log essence_transaction_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.essence_transaction_log
    ADD CONSTRAINT essence_transaction_log_pkey PRIMARY KEY (id);


--
-- Name: faction_contribution_log faction_contribution_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faction_contribution_log
    ADD CONSTRAINT faction_contribution_log_pkey PRIMARY KEY (id);


--
-- Name: faction_member faction_member_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faction_member
    ADD CONSTRAINT faction_member_pkey PRIMARY KEY (id);


--
-- Name: faction faction_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faction
    ADD CONSTRAINT faction_pkey PRIMARY KEY (id);


--
-- Name: faction_season_snapshot faction_season_snapshot_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faction_season_snapshot
    ADD CONSTRAINT faction_season_snapshot_pkey PRIMARY KEY (id);


--
-- Name: field_harvest_log field_harvest_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_harvest_log
    ADD CONSTRAINT field_harvest_log_pkey PRIMARY KEY (id);


--
-- Name: game_season game_season_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_season
    ADD CONSTRAINT game_season_pkey PRIMARY KEY (season_number);


--
-- Name: idempotency_record idempotency_record_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.idempotency_record
    ADD CONSTRAINT idempotency_record_pkey PRIMARY KEY (id);


--
-- Name: player_army player_army_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_army
    ADD CONSTRAINT player_army_pkey PRIMARY KEY (player_id);


--
-- Name: player_assist_record player_assist_record_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_assist_record
    ADD CONSTRAINT player_assist_record_pkey PRIMARY KEY (id);


--
-- Name: player_auth_identity player_auth_identity_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_auth_identity
    ADD CONSTRAINT player_auth_identity_pkey PRIMARY KEY (id);


--
-- Name: player_building player_building_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_building
    ADD CONSTRAINT player_building_pkey PRIMARY KEY (player_id);


--
-- Name: player_daily_task_state player_daily_task_state_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_daily_task_state
    ADD CONSTRAINT player_daily_task_state_pkey PRIMARY KEY (id);


--
-- Name: player_faction_stipend_state player_faction_stipend_state_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_faction_stipend_state
    ADD CONSTRAINT player_faction_stipend_state_pkey PRIMARY KEY (id);


--
-- Name: player_farm_board player_farm_board_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_farm_board
    ADD CONSTRAINT player_farm_board_pkey PRIMARY KEY (player_id);


--
-- Name: player_field_slot player_field_slot_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_field_slot
    ADD CONSTRAINT player_field_slot_pkey PRIMARY KEY (id);


--
-- Name: player_invite_relation player_invite_relation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_invite_relation
    ADD CONSTRAINT player_invite_relation_pkey PRIMARY KEY (id);


--
-- Name: player_land_deed_progress player_land_deed_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_land_deed_progress
    ADD CONSTRAINT player_land_deed_progress_pkey PRIMARY KEY (id);


--
-- Name: player_notification player_notification_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_notification
    ADD CONSTRAINT player_notification_pkey PRIMARY KEY (id);


--
-- Name: player player_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player
    ADD CONSTRAINT player_pkey PRIMARY KEY (id);


--
-- Name: player_plant_research player_plant_research_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_plant_research
    ADD CONSTRAINT player_plant_research_pkey PRIMARY KEY (id);


--
-- Name: player_season_achievement player_season_achievement_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_season_achievement
    ADD CONSTRAINT player_season_achievement_pkey PRIMARY KEY (id);


--
-- Name: player_season_activity player_season_activity_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_season_activity
    ADD CONSTRAINT player_season_activity_pkey PRIMARY KEY (id);


--
-- Name: player_season_reward_grant player_season_reward_grant_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_season_reward_grant
    ADD CONSTRAINT player_season_reward_grant_pkey PRIMARY KEY (id);


--
-- Name: player_season_sign_in player_season_sign_in_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_season_sign_in
    ADD CONSTRAINT player_season_sign_in_pkey PRIMARY KEY (id);


--
-- Name: player_season_snapshot player_season_snapshot_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_season_snapshot
    ADD CONSTRAINT player_season_snapshot_pkey PRIMARY KEY (id);


--
-- Name: player_season_state player_season_state_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_season_state
    ADD CONSTRAINT player_season_state_pkey PRIMARY KEY (player_id);


--
-- Name: player_seed_inventory player_seed_inventory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_seed_inventory
    ADD CONSTRAINT player_seed_inventory_pkey PRIMARY KEY (id);


--
-- Name: player_social_feed player_social_feed_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_social_feed
    ADD CONSTRAINT player_social_feed_pkey PRIMARY KEY (id);


--
-- Name: player_social_relation player_social_relation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_social_relation
    ADD CONSTRAINT player_social_relation_pkey PRIMARY KEY (id);


--
-- Name: player_spirit_codex player_spirit_codex_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_spirit_codex
    ADD CONSTRAINT player_spirit_codex_pkey PRIMARY KEY (id);


--
-- Name: player_spirit_resource player_spirit_resource_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_spirit_resource
    ADD CONSTRAINT player_spirit_resource_pkey PRIMARY KEY (player_id);


--
-- Name: player_spirit_slot player_spirit_slot_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_spirit_slot
    ADD CONSTRAINT player_spirit_slot_pkey PRIMARY KEY (id);


--
-- Name: player_spirit_trait player_spirit_trait_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_spirit_trait
    ADD CONSTRAINT player_spirit_trait_pkey PRIMARY KEY (id);


--
-- Name: player_wallet player_wallet_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_wallet
    ADD CONSTRAINT player_wallet_pkey PRIMARY KEY (player_id);


--
-- Name: raid_asset_lock raid_asset_lock_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.raid_asset_lock
    ADD CONSTRAINT raid_asset_lock_pkey PRIMARY KEY (id);


--
-- Name: raid_message_template raid_message_template_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.raid_message_template
    ADD CONSTRAINT raid_message_template_pkey PRIMARY KEY (id);


--
-- Name: raid_order_message raid_order_message_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.raid_order_message
    ADD CONSTRAINT raid_order_message_pkey PRIMARY KEY (id);


--
-- Name: raid_order raid_order_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.raid_order
    ADD CONSTRAINT raid_order_pkey PRIMARY KEY (id);


--
-- Name: raid_settlement raid_settlement_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.raid_settlement
    ADD CONSTRAINT raid_settlement_pkey PRIMARY KEY (id);


--
-- Name: raid_target_pool raid_target_pool_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.raid_target_pool
    ADD CONSTRAINT raid_target_pool_pkey PRIMARY KEY (id);


--
-- Name: robot_action_log robot_action_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.robot_action_log
    ADD CONSTRAINT robot_action_log_pkey PRIMARY KEY (id);


--
-- Name: robot_automation_config robot_automation_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.robot_automation_config
    ADD CONSTRAINT robot_automation_config_pkey PRIMARY KEY (id);


--
-- Name: robot_automation_job robot_automation_job_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.robot_automation_job
    ADD CONSTRAINT robot_automation_job_pkey PRIMARY KEY (id);


--
-- Name: robot_sim_snapshot robot_sim_snapshot_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.robot_sim_snapshot
    ADD CONSTRAINT robot_sim_snapshot_pkey PRIMARY KEY (id);


--
-- Name: robot_test_run robot_test_run_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.robot_test_run
    ADD CONSTRAINT robot_test_run_pkey PRIMARY KEY (id);


--
-- Name: seed_definition seed_definition_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seed_definition
    ADD CONSTRAINT seed_definition_pkey PRIMARY KEY (id);


--
-- Name: share_assist_campaign share_assist_campaign_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.share_assist_campaign
    ADD CONSTRAINT share_assist_campaign_pkey PRIMARY KEY (id);


--
-- Name: share_assist_record share_assist_record_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.share_assist_record
    ADD CONSTRAINT share_assist_record_pkey PRIMARY KEY (id);


--
-- Name: spirit_ad_reward_log spirit_ad_reward_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.spirit_ad_reward_log
    ADD CONSTRAINT spirit_ad_reward_log_pkey PRIMARY KEY (id);


--
-- Name: spirit_breakthrough_log spirit_breakthrough_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.spirit_breakthrough_log
    ADD CONSTRAINT spirit_breakthrough_log_pkey PRIMARY KEY (id);


--
-- Name: spirit_definition spirit_definition_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.spirit_definition
    ADD CONSTRAINT spirit_definition_pkey PRIMARY KEY (id);


--
-- Name: spirit_feed_log spirit_feed_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.spirit_feed_log
    ADD CONSTRAINT spirit_feed_log_pkey PRIMARY KEY (id);


--
-- Name: spirit_shop_purchase_log spirit_shop_purchase_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.spirit_shop_purchase_log
    ADD CONSTRAINT spirit_shop_purchase_log_pkey PRIMARY KEY (id);


--
-- Name: spirit_trait_roll_log spirit_trait_roll_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.spirit_trait_roll_log
    ADD CONSTRAINT spirit_trait_roll_log_pkey PRIMARY KEY (id);


--
-- Name: system_notification system_notification_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_notification
    ADD CONSTRAINT system_notification_pkey PRIMARY KEY (id);


--
-- Name: task_config_override task_config_override_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_config_override
    ADD CONSTRAINT task_config_override_pkey PRIMARY KEY (id);


--
-- Name: task_reward_log task_reward_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_reward_log
    ADD CONSTRAINT task_reward_log_pkey PRIMARY KEY (id);


--
-- Name: team_challenge team_challenge_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_challenge
    ADD CONSTRAINT team_challenge_pkey PRIMARY KEY (id);


--
-- Name: wallet_change_log wallet_change_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallet_change_log
    ADD CONSTRAINT wallet_change_log_pkey PRIMARY KEY (id);


--
-- Name: admin_operation_audit_log_action_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX admin_operation_audit_log_action_created_at_idx ON public.admin_operation_audit_log USING btree (action, created_at);


--
-- Name: admin_operation_audit_log_target_type_target_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX admin_operation_audit_log_target_type_target_id_idx ON public.admin_operation_audit_log USING btree (target_type, target_id);


--
-- Name: army_training_queue_finish_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX army_training_queue_finish_at_idx ON public.army_training_queue USING btree (finish_at);


--
-- Name: army_training_queue_player_active_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX army_training_queue_player_active_key ON public.army_training_queue USING btree (player_id) WHERE (status = ANY (ARRAY['QUEUED'::public."ArmyTrainingStatus", 'FINISHED'::public."ArmyTrainingStatus"]));


--
-- Name: army_training_queue_player_id_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX army_training_queue_player_id_status_idx ON public.army_training_queue USING btree (player_id, status);


--
-- Name: assist_pair_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX assist_pair_date_idx ON public.player_assist_record USING btree (helper_player_id, target_player_id, date_key);


--
-- Name: battle_report_owner_player_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX battle_report_owner_player_id_created_at_idx ON public.battle_report USING btree (owner_player_id, created_at);


--
-- Name: battle_report_raid_order_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX battle_report_raid_order_id_idx ON public.battle_report USING btree (raid_order_id);


--
-- Name: building_upgrade_log_player_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX building_upgrade_log_player_id_created_at_idx ON public.building_upgrade_log USING btree (player_id, created_at);


--
-- Name: building_upgrade_log_request_idempotency_key_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX building_upgrade_log_request_idempotency_key_idx ON public.building_upgrade_log USING btree (request_idempotency_key);


--
-- Name: daily_faction_task_faction_id_task_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX daily_faction_task_faction_id_task_date_idx ON public.daily_faction_task USING btree (faction_id, task_date);


--
-- Name: daily_faction_task_player_id_task_date_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX daily_faction_task_player_id_task_date_status_idx ON public.daily_faction_task USING btree (player_id, task_date, status);


--
-- Name: daily_faction_task_player_id_task_date_task_type_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX daily_faction_task_player_id_task_date_task_type_key ON public.daily_faction_task USING btree (player_id, task_date, task_type);


--
-- Name: essence_transaction_log_essence_type_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX essence_transaction_log_essence_type_created_at_idx ON public.essence_transaction_log USING btree (essence_type, created_at);


--
-- Name: essence_transaction_log_player_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX essence_transaction_log_player_id_created_at_idx ON public.essence_transaction_log USING btree (player_id, created_at);


--
-- Name: faction_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX faction_code_key ON public.faction USING btree (code);


--
-- Name: faction_contribution_log_faction_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX faction_contribution_log_faction_id_created_at_idx ON public.faction_contribution_log USING btree (faction_id, created_at);


--
-- Name: faction_contribution_log_player_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX faction_contribution_log_player_id_created_at_idx ON public.faction_contribution_log USING btree (player_id, created_at);


--
-- Name: faction_member_faction_id_player_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX faction_member_faction_id_player_id_key ON public.faction_member USING btree (faction_id, player_id);


--
-- Name: faction_member_player_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX faction_member_player_id_idx ON public.faction_member USING btree (player_id);


--
-- Name: faction_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX faction_name_key ON public.faction USING btree (name);


--
-- Name: faction_season_snapshot_faction_id_season_number_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX faction_season_snapshot_faction_id_season_number_key ON public.faction_season_snapshot USING btree (faction_id, season_number);


--
-- Name: faction_season_snapshot_season_number_contribution_score_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX faction_season_snapshot_season_number_contribution_score_idx ON public.faction_season_snapshot USING btree (season_number, contribution_score);


--
-- Name: field_harvest_log_field_slot_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX field_harvest_log_field_slot_id_idx ON public.field_harvest_log USING btree (field_slot_id);


--
-- Name: field_harvest_log_player_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX field_harvest_log_player_id_created_at_idx ON public.field_harvest_log USING btree (player_id, created_at);


--
-- Name: field_harvest_log_player_id_seed_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX field_harvest_log_player_id_seed_id_idx ON public.field_harvest_log USING btree (player_id, seed_id);


--
-- Name: game_season_starts_at_ends_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX game_season_starts_at_ends_at_idx ON public.game_season USING btree (starts_at, ends_at);


--
-- Name: idempotency_record_expires_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idempotency_record_expires_at_idx ON public.idempotency_record USING btree (expires_at);


--
-- Name: idempotency_record_player_id_endpoint_key_idempotency_key_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idempotency_record_player_id_endpoint_key_idempotency_key_key ON public.idempotency_record USING btree (player_id, endpoint_key, idempotency_key);


--
-- Name: idempotency_record_status_updated_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idempotency_record_status_updated_at_idx ON public.idempotency_record USING btree (status, updated_at);


--
-- Name: player_assist_record_helper_player_id_date_key_assist_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX player_assist_record_helper_player_id_date_key_assist_type_idx ON public.player_assist_record USING btree (helper_player_id, date_key, assist_type);


--
-- Name: player_assist_record_target_entity_type_target_entity_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX player_assist_record_target_entity_type_target_entity_id_idx ON public.player_assist_record USING btree (target_entity_type, target_entity_id);


--
-- Name: player_assist_record_target_player_id_date_key_assist_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX player_assist_record_target_player_id_date_key_assist_type_idx ON public.player_assist_record USING btree (target_player_id, date_key, assist_type);


--
-- Name: player_auth_identity_player_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX player_auth_identity_player_id_idx ON public.player_auth_identity USING btree (player_id);


--
-- Name: player_auth_identity_provider_provider_user_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX player_auth_identity_provider_provider_user_id_key ON public.player_auth_identity USING btree (provider, provider_user_id);


--
-- Name: player_daily_task_state_date_key_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX player_daily_task_state_date_key_status_idx ON public.player_daily_task_state USING btree (date_key, status);


--
-- Name: player_daily_task_state_player_id_date_key_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX player_daily_task_state_player_id_date_key_idx ON public.player_daily_task_state USING btree (player_id, date_key);


--
-- Name: player_daily_task_state_player_id_date_key_task_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX player_daily_task_state_player_id_date_key_task_id_key ON public.player_daily_task_state USING btree (player_id, date_key, task_id);


--
-- Name: player_faction_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX player_faction_id_idx ON public.player USING btree (faction_id);


--
-- Name: player_faction_stipend_state_date_key_claimed_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX player_faction_stipend_state_date_key_claimed_at_idx ON public.player_faction_stipend_state USING btree (date_key, claimed_at);


--
-- Name: player_faction_stipend_state_player_id_claimed_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX player_faction_stipend_state_player_id_claimed_at_idx ON public.player_faction_stipend_state USING btree (player_id, claimed_at);


--
-- Name: player_faction_stipend_state_player_id_date_key_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX player_faction_stipend_state_player_id_date_key_key ON public.player_faction_stipend_state USING btree (player_id, date_key);


--
-- Name: player_field_slot_mature_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX player_field_slot_mature_at_idx ON public.player_field_slot USING btree (mature_at);


--
-- Name: player_field_slot_overripe_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX player_field_slot_overripe_at_idx ON public.player_field_slot USING btree (overripe_at);


--
-- Name: player_field_slot_player_id_slot_index_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX player_field_slot_player_id_slot_index_key ON public.player_field_slot USING btree (player_id, slot_index);


--
-- Name: player_field_slot_player_id_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX player_field_slot_player_id_status_idx ON public.player_field_slot USING btree (player_id, status);


--
-- Name: player_field_slot_ready_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX player_field_slot_ready_at_idx ON public.player_field_slot USING btree (ready_at);


--
-- Name: player_invite_relation_invited_player_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX player_invite_relation_invited_player_id_idx ON public.player_invite_relation USING btree (invited_player_id);


--
-- Name: player_invite_relation_inviter_player_id_invited_openid_hash_ke; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX player_invite_relation_inviter_player_id_invited_openid_hash_ke ON public.player_invite_relation USING btree (inviter_player_id, invited_openid_hash);


--
-- Name: player_invite_relation_inviter_player_id_invited_player_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX player_invite_relation_inviter_player_id_invited_player_id_key ON public.player_invite_relation USING btree (inviter_player_id, invited_player_id);


--
-- Name: player_invite_relation_inviter_player_id_status_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX player_invite_relation_inviter_player_id_status_created_at_idx ON public.player_invite_relation USING btree (inviter_player_id, status, created_at);


--
-- Name: player_invite_relation_source_campaign_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX player_invite_relation_source_campaign_id_idx ON public.player_invite_relation USING btree (source_campaign_id);


--
-- Name: player_land_deed_progress_player_id_deed_key_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX player_land_deed_progress_player_id_deed_key_key ON public.player_land_deed_progress USING btree (player_id, deed_key);


--
-- Name: player_land_deed_progress_player_id_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX player_land_deed_progress_player_id_status_idx ON public.player_land_deed_progress USING btree (player_id, status);


--
-- Name: player_last_login_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX player_last_login_at_idx ON public.player USING btree (last_login_at);


--
-- Name: player_notification_player_id_claim_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX player_notification_player_id_claim_status_idx ON public.player_notification USING btree (player_id, claim_status);


--
-- Name: player_notification_player_id_deleted_at_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX player_notification_player_id_deleted_at_created_at_idx ON public.player_notification USING btree (player_id, deleted_at, created_at);


--
-- Name: player_notification_player_id_read_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX player_notification_player_id_read_at_idx ON public.player_notification USING btree (player_id, read_at);


--
-- Name: player_notification_system_notification_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX player_notification_system_notification_id_idx ON public.player_notification USING btree (system_notification_id);


--
-- Name: player_plant_research_player_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX player_plant_research_player_id_idx ON public.player_plant_research USING btree (player_id);


--
-- Name: player_plant_research_player_id_seed_definition_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX player_plant_research_player_id_seed_definition_id_key ON public.player_plant_research USING btree (player_id, seed_definition_id);


--
-- Name: player_protected_until_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX player_protected_until_idx ON public.player USING btree (protected_until);


--
-- Name: player_season_achievement_player_id_season_number_achievement_k; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX player_season_achievement_player_id_season_number_achievement_k ON public.player_season_achievement USING btree (player_id, season_number, achievement_key);


--
-- Name: player_season_achievement_player_id_season_number_domain_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX player_season_achievement_player_id_season_number_domain_idx ON public.player_season_achievement USING btree (player_id, season_number, domain);


--
-- Name: player_season_achievement_reward_grant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX player_season_achievement_reward_grant_id_idx ON public.player_season_achievement USING btree (reward_grant_id);


--
-- Name: player_season_activity_player_id_season_number_date_key_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX player_season_activity_player_id_season_number_date_key_key ON public.player_season_activity USING btree (player_id, season_number, date_key);


--
-- Name: player_season_activity_player_id_season_number_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX player_season_activity_player_id_season_number_idx ON public.player_season_activity USING btree (player_id, season_number);


--
-- Name: player_season_activity_season_number_date_key_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX player_season_activity_season_number_date_key_idx ON public.player_season_activity USING btree (season_number, date_key);


--
-- Name: player_season_reward_grant_notification_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX player_season_reward_grant_notification_id_idx ON public.player_season_reward_grant USING btree (notification_id);


--
-- Name: player_season_reward_grant_player_id_season_number_reward_type_; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX player_season_reward_grant_player_id_season_number_reward_type_ ON public.player_season_reward_grant USING btree (player_id, season_number, reward_type);


--
-- Name: player_season_reward_grant_player_id_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX player_season_reward_grant_player_id_status_idx ON public.player_season_reward_grant USING btree (player_id, status);


--
-- Name: player_season_reward_grant_season_number_reward_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX player_season_reward_grant_season_number_reward_type_idx ON public.player_season_reward_grant USING btree (season_number, reward_type);


--
-- Name: player_season_sign_in_player_id_season_number_day_index_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX player_season_sign_in_player_id_season_number_day_index_key ON public.player_season_sign_in USING btree (player_id, season_number, day_index);


--
-- Name: player_season_sign_in_player_id_season_number_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX player_season_sign_in_player_id_season_number_idx ON public.player_season_sign_in USING btree (player_id, season_number);


--
-- Name: player_season_sign_in_season_number_day_index_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX player_season_sign_in_season_number_day_index_idx ON public.player_season_sign_in USING btree (season_number, day_index);


--
-- Name: player_season_snapshot_faction_id_season_number_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX player_season_snapshot_faction_id_season_number_idx ON public.player_season_snapshot USING btree (faction_id, season_number);


--
-- Name: player_season_snapshot_player_id_season_number_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX player_season_snapshot_player_id_season_number_key ON public.player_season_snapshot USING btree (player_id, season_number);


--
-- Name: player_season_snapshot_season_number_contribution_score_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX player_season_snapshot_season_number_contribution_score_idx ON public.player_season_snapshot USING btree (season_number, contribution_score);


--
-- Name: player_season_state_current_season_number_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX player_season_state_current_season_number_idx ON public.player_season_state USING btree (current_season_number);


--
-- Name: player_season_state_last_reset_season_number_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX player_season_state_last_reset_season_number_idx ON public.player_season_state USING btree (last_reset_season_number);


--
-- Name: player_seed_inventory_player_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX player_seed_inventory_player_id_idx ON public.player_seed_inventory USING btree (player_id);


--
-- Name: player_seed_inventory_player_id_seed_definition_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX player_seed_inventory_player_id_seed_definition_id_key ON public.player_seed_inventory USING btree (player_id, seed_definition_id);


--
-- Name: player_social_feed_actor_player_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX player_social_feed_actor_player_id_created_at_idx ON public.player_social_feed USING btree (actor_player_id, created_at);


--
-- Name: player_social_feed_expires_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX player_social_feed_expires_at_idx ON public.player_social_feed USING btree (expires_at);


--
-- Name: player_social_feed_player_id_feed_type_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX player_social_feed_player_id_feed_type_created_at_idx ON public.player_social_feed USING btree (player_id, feed_type, created_at);


--
-- Name: player_social_feed_player_id_is_read_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX player_social_feed_player_id_is_read_created_at_idx ON public.player_social_feed USING btree (player_id, is_read, created_at);


--
-- Name: player_social_relation_last_interacted_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX player_social_relation_last_interacted_at_idx ON public.player_social_relation USING btree (last_interacted_at);


--
-- Name: player_social_relation_player_id_relation_type_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX player_social_relation_player_id_relation_type_status_idx ON public.player_social_relation USING btree (player_id, relation_type, status);


--
-- Name: player_social_relation_player_id_target_player_id_relation_type; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX player_social_relation_player_id_target_player_id_relation_type ON public.player_social_relation USING btree (player_id, target_player_id, relation_type);


--
-- Name: player_social_relation_target_player_id_relation_type_status_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX player_social_relation_target_player_id_relation_type_status_id ON public.player_social_relation USING btree (target_player_id, relation_type, status);


--
-- Name: player_spirit_codex_player_id_ready_to_compose_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX player_spirit_codex_player_id_ready_to_compose_idx ON public.player_spirit_codex USING btree (player_id, ready_to_compose);


--
-- Name: player_spirit_codex_player_id_spirit_definition_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX player_spirit_codex_player_id_spirit_definition_id_key ON public.player_spirit_codex USING btree (player_id, spirit_definition_id);


--
-- Name: player_spirit_codex_spirit_definition_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX player_spirit_codex_spirit_definition_id_idx ON public.player_spirit_codex USING btree (spirit_definition_id);


--
-- Name: player_spirit_slot_one_main_per_player_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX player_spirit_slot_one_main_per_player_idx ON public.player_spirit_slot USING btree (player_id) WHERE (is_main = true);


--
-- Name: player_spirit_slot_player_id_is_main_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX player_spirit_slot_player_id_is_main_idx ON public.player_spirit_slot USING btree (player_id, is_main);


--
-- Name: player_spirit_slot_player_id_slot_index_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX player_spirit_slot_player_id_slot_index_key ON public.player_spirit_slot USING btree (player_id, slot_index);


--
-- Name: player_spirit_slot_spirit_definition_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX player_spirit_slot_spirit_definition_id_idx ON public.player_spirit_slot USING btree (spirit_definition_id);


--
-- Name: player_spirit_trait_spirit_slot_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX player_spirit_trait_spirit_slot_id_idx ON public.player_spirit_trait USING btree (spirit_slot_id);


--
-- Name: player_spirit_trait_spirit_slot_id_slot_index_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX player_spirit_trait_spirit_slot_id_slot_index_key ON public.player_spirit_trait USING btree (spirit_slot_id, slot_index);


--
-- Name: player_spirit_trait_trait_code_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX player_spirit_trait_trait_code_idx ON public.player_spirit_trait USING btree (trait_code);


--
-- Name: player_wallet_pending_raid_overflow_expires_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX player_wallet_pending_raid_overflow_expires_at_idx ON public.player_wallet USING btree (pending_raid_overflow_expires_at);


--
-- Name: raid_asset_lock_defender_player_id_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX raid_asset_lock_defender_player_id_status_idx ON public.raid_asset_lock USING btree (defender_player_id, status);


--
-- Name: raid_asset_lock_expires_at_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX raid_asset_lock_expires_at_status_idx ON public.raid_asset_lock USING btree (expires_at, status);


--
-- Name: raid_asset_lock_raid_order_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX raid_asset_lock_raid_order_id_idx ON public.raid_asset_lock USING btree (raid_order_id);


--
-- Name: raid_message_template_is_active_sort_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX raid_message_template_is_active_sort_order_idx ON public.raid_message_template USING btree (is_active, sort_order);


--
-- Name: raid_message_template_template_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX raid_message_template_template_id_key ON public.raid_message_template USING btree (template_id);


--
-- Name: raid_order_attacker_player_id_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX raid_order_attacker_player_id_status_idx ON public.raid_order USING btree (attacker_player_id, status);


--
-- Name: raid_order_defender_player_id_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX raid_order_defender_player_id_status_idx ON public.raid_order USING btree (defender_player_id, status);


--
-- Name: raid_order_message_author_player_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX raid_order_message_author_player_id_created_at_idx ON public.raid_order_message USING btree (author_player_id, created_at);


--
-- Name: raid_order_message_raid_order_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX raid_order_message_raid_order_id_key ON public.raid_order_message USING btree (raid_order_id);


--
-- Name: raid_order_message_receiver_player_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX raid_order_message_receiver_player_id_created_at_idx ON public.raid_order_message USING btree (receiver_player_id, created_at);


--
-- Name: raid_order_message_template_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX raid_order_message_template_id_idx ON public.raid_order_message USING btree (template_id);


--
-- Name: raid_order_request_idempotency_key_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX raid_order_request_idempotency_key_key ON public.raid_order USING btree (request_idempotency_key);


--
-- Name: raid_order_settle_at_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX raid_order_settle_at_status_idx ON public.raid_order USING btree (settle_at, status);


--
-- Name: raid_settlement_raid_order_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX raid_settlement_raid_order_id_key ON public.raid_settlement USING btree (raid_order_id);


--
-- Name: raid_target_pool_owner_player_id_expires_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX raid_target_pool_owner_player_id_expires_at_idx ON public.raid_target_pool USING btree (owner_player_id, expires_at);


--
-- Name: raid_target_pool_owner_player_id_refresh_batch_no_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX raid_target_pool_owner_player_id_refresh_batch_no_idx ON public.raid_target_pool USING btree (owner_player_id, refresh_batch_no);


--
-- Name: raid_target_pool_owner_player_id_target_player_id_slot_index_re; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX raid_target_pool_owner_player_id_target_player_id_slot_index_re ON public.raid_target_pool USING btree (owner_player_id, target_player_id, slot_index, refresh_batch_no);


--
-- Name: robot_action_log_player_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX robot_action_log_player_id_created_at_idx ON public.robot_action_log USING btree (player_id, created_at);


--
-- Name: robot_action_log_robot_key_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX robot_action_log_robot_key_created_at_idx ON public.robot_action_log USING btree (robot_key, created_at);


--
-- Name: robot_action_log_run_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX robot_action_log_run_id_created_at_idx ON public.robot_action_log USING btree (run_id, created_at);


--
-- Name: robot_action_log_status_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX robot_action_log_status_created_at_idx ON public.robot_action_log USING btree (status, created_at);


--
-- Name: robot_automation_config_enabled_mode_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX robot_automation_config_enabled_mode_idx ON public.robot_automation_config USING btree (enabled, mode);


--
-- Name: robot_automation_config_mode_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX robot_automation_config_mode_key ON public.robot_automation_config USING btree (mode);


--
-- Name: robot_automation_job_mode_status_started_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX robot_automation_job_mode_status_started_at_idx ON public.robot_automation_job USING btree (mode, status, started_at);


--
-- Name: robot_automation_job_status_started_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX robot_automation_job_status_started_at_idx ON public.robot_automation_job USING btree (status, started_at);


--
-- Name: robot_sim_snapshot_mode_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX robot_sim_snapshot_mode_created_at_idx ON public.robot_sim_snapshot USING btree (mode, created_at);


--
-- Name: robot_sim_snapshot_player_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX robot_sim_snapshot_player_id_created_at_idx ON public.robot_sim_snapshot USING btree (player_id, created_at);


--
-- Name: robot_sim_snapshot_robot_key_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX robot_sim_snapshot_robot_key_created_at_idx ON public.robot_sim_snapshot USING btree (robot_key, created_at);


--
-- Name: robot_sim_snapshot_run_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX robot_sim_snapshot_run_id_idx ON public.robot_sim_snapshot USING btree (run_id);


--
-- Name: robot_test_run_mode_started_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX robot_test_run_mode_started_at_idx ON public.robot_test_run USING btree (mode, started_at);


--
-- Name: robot_test_run_status_started_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX robot_test_run_status_started_at_idx ON public.robot_test_run USING btree (status, started_at);


--
-- Name: seed_definition_rarity_sort_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX seed_definition_rarity_sort_order_idx ON public.seed_definition USING btree (rarity, sort_order);


--
-- Name: seed_definition_seed_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX seed_definition_seed_id_key ON public.seed_definition USING btree (seed_id);


--
-- Name: share_assist_campaign_expires_at_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX share_assist_campaign_expires_at_status_idx ON public.share_assist_campaign USING btree (expires_at, status);


--
-- Name: share_assist_campaign_owner_player_id_campaign_type_status_crea; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX share_assist_campaign_owner_player_id_campaign_type_status_crea ON public.share_assist_campaign USING btree (owner_player_id, campaign_type, status, created_at);


--
-- Name: share_assist_record_campaign_id_helper_device_hash_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX share_assist_record_campaign_id_helper_device_hash_key ON public.share_assist_record USING btree (campaign_id, helper_device_hash);


--
-- Name: share_assist_record_campaign_id_helper_openid_hash_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX share_assist_record_campaign_id_helper_openid_hash_key ON public.share_assist_record USING btree (campaign_id, helper_openid_hash);


--
-- Name: share_assist_record_campaign_id_helper_player_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX share_assist_record_campaign_id_helper_player_id_key ON public.share_assist_record USING btree (campaign_id, helper_player_id);


--
-- Name: share_assist_record_campaign_id_status_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX share_assist_record_campaign_id_status_created_at_idx ON public.share_assist_record USING btree (campaign_id, status, created_at);


--
-- Name: share_assist_record_helper_player_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX share_assist_record_helper_player_id_created_at_idx ON public.share_assist_record USING btree (helper_player_id, created_at);


--
-- Name: spirit_ad_reward_log_player_id_date_key_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX spirit_ad_reward_log_player_id_date_key_idx ON public.spirit_ad_reward_log USING btree (player_id, date_key);


--
-- Name: spirit_breakthrough_log_player_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX spirit_breakthrough_log_player_id_created_at_idx ON public.spirit_breakthrough_log USING btree (player_id, created_at);


--
-- Name: spirit_breakthrough_log_request_idempotency_key_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX spirit_breakthrough_log_request_idempotency_key_idx ON public.spirit_breakthrough_log USING btree (request_idempotency_key);


--
-- Name: spirit_breakthrough_log_spirit_slot_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX spirit_breakthrough_log_spirit_slot_id_idx ON public.spirit_breakthrough_log USING btree (spirit_slot_id);


--
-- Name: spirit_definition_rarity_sort_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX spirit_definition_rarity_sort_order_idx ON public.spirit_definition USING btree (rarity, sort_order);


--
-- Name: spirit_definition_spirit_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX spirit_definition_spirit_id_key ON public.spirit_definition USING btree (spirit_id);


--
-- Name: spirit_feed_log_player_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX spirit_feed_log_player_id_created_at_idx ON public.spirit_feed_log USING btree (player_id, created_at);


--
-- Name: spirit_feed_log_request_idempotency_key_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX spirit_feed_log_request_idempotency_key_idx ON public.spirit_feed_log USING btree (request_idempotency_key);


--
-- Name: spirit_feed_log_spirit_slot_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX spirit_feed_log_spirit_slot_id_idx ON public.spirit_feed_log USING btree (spirit_slot_id);


--
-- Name: spirit_shop_purchase_log_player_id_item_id_period_key_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX spirit_shop_purchase_log_player_id_item_id_period_key_idx ON public.spirit_shop_purchase_log USING btree (player_id, item_id, period_key);


--
-- Name: spirit_trait_roll_log_player_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX spirit_trait_roll_log_player_id_created_at_idx ON public.spirit_trait_roll_log USING btree (player_id, created_at);


--
-- Name: spirit_trait_roll_log_request_idempotency_key_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX spirit_trait_roll_log_request_idempotency_key_idx ON public.spirit_trait_roll_log USING btree (request_idempotency_key);


--
-- Name: spirit_trait_roll_log_spirit_slot_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX spirit_trait_roll_log_spirit_slot_id_idx ON public.spirit_trait_roll_log USING btree (spirit_slot_id);


--
-- Name: system_notification_audience_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX system_notification_audience_created_at_idx ON public.system_notification USING btree (audience, created_at);


--
-- Name: system_notification_category_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX system_notification_category_created_at_idx ON public.system_notification USING btree (category, created_at);


--
-- Name: system_notification_revoked_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX system_notification_revoked_at_idx ON public.system_notification USING btree (revoked_at);


--
-- Name: task_config_override_task_group_is_enabled_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX task_config_override_task_group_is_enabled_idx ON public.task_config_override USING btree (task_group, is_enabled);


--
-- Name: task_config_override_task_group_task_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX task_config_override_task_group_task_id_key ON public.task_config_override USING btree (task_group, task_id);


--
-- Name: task_reward_log_player_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX task_reward_log_player_id_created_at_idx ON public.task_reward_log USING btree (player_id, created_at);


--
-- Name: task_reward_log_request_idempotency_key_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX task_reward_log_request_idempotency_key_idx ON public.task_reward_log USING btree (request_idempotency_key);


--
-- Name: team_challenge_ally_player_id_status_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX team_challenge_ally_player_id_status_created_at_idx ON public.team_challenge USING btree (ally_player_id, status, created_at);


--
-- Name: team_challenge_expires_at_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX team_challenge_expires_at_status_idx ON public.team_challenge USING btree (expires_at, status);


--
-- Name: team_challenge_initiator_player_id_status_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX team_challenge_initiator_player_id_status_created_at_idx ON public.team_challenge USING btree (initiator_player_id, status, created_at);


--
-- Name: team_challenge_target_player_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX team_challenge_target_player_id_created_at_idx ON public.team_challenge USING btree (target_player_id, created_at);


--
-- Name: wallet_change_log_change_type_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX wallet_change_log_change_type_created_at_idx ON public.wallet_change_log USING btree (change_type, created_at);


--
-- Name: wallet_change_log_player_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX wallet_change_log_player_id_created_at_idx ON public.wallet_change_log USING btree (player_id, created_at);


--
-- Name: wallet_change_log_request_idempotency_key_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX wallet_change_log_request_idempotency_key_idx ON public.wallet_change_log USING btree (request_idempotency_key);


--
-- Name: army_training_queue army_training_queue_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.army_training_queue
    ADD CONSTRAINT army_training_queue_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.player(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: battle_report battle_report_opponent_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.battle_report
    ADD CONSTRAINT battle_report_opponent_player_id_fkey FOREIGN KEY (opponent_player_id) REFERENCES public.player(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: battle_report battle_report_owner_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.battle_report
    ADD CONSTRAINT battle_report_owner_player_id_fkey FOREIGN KEY (owner_player_id) REFERENCES public.player(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: battle_report battle_report_raid_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.battle_report
    ADD CONSTRAINT battle_report_raid_order_id_fkey FOREIGN KEY (raid_order_id) REFERENCES public.raid_order(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: building_upgrade_log building_upgrade_log_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.building_upgrade_log
    ADD CONSTRAINT building_upgrade_log_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.player(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: daily_faction_task daily_faction_task_faction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_faction_task
    ADD CONSTRAINT daily_faction_task_faction_id_fkey FOREIGN KEY (faction_id) REFERENCES public.faction(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: daily_faction_task daily_faction_task_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_faction_task
    ADD CONSTRAINT daily_faction_task_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.player(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: essence_transaction_log essence_transaction_log_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.essence_transaction_log
    ADD CONSTRAINT essence_transaction_log_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.player(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: faction_contribution_log faction_contribution_log_faction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faction_contribution_log
    ADD CONSTRAINT faction_contribution_log_faction_id_fkey FOREIGN KEY (faction_id) REFERENCES public.faction(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: faction_contribution_log faction_contribution_log_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faction_contribution_log
    ADD CONSTRAINT faction_contribution_log_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.player(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: faction_member faction_member_faction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faction_member
    ADD CONSTRAINT faction_member_faction_id_fkey FOREIGN KEY (faction_id) REFERENCES public.faction(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: faction_member faction_member_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faction_member
    ADD CONSTRAINT faction_member_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.player(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: faction_season_snapshot faction_season_snapshot_faction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faction_season_snapshot
    ADD CONSTRAINT faction_season_snapshot_faction_id_fkey FOREIGN KEY (faction_id) REFERENCES public.faction(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: faction_season_snapshot faction_season_snapshot_season_number_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faction_season_snapshot
    ADD CONSTRAINT faction_season_snapshot_season_number_fkey FOREIGN KEY (season_number) REFERENCES public.game_season(season_number) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: field_harvest_log field_harvest_log_field_slot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_harvest_log
    ADD CONSTRAINT field_harvest_log_field_slot_id_fkey FOREIGN KEY (field_slot_id) REFERENCES public.player_field_slot(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: field_harvest_log field_harvest_log_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_harvest_log
    ADD CONSTRAINT field_harvest_log_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.player(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: idempotency_record idempotency_record_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.idempotency_record
    ADD CONSTRAINT idempotency_record_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.player(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: player_army player_army_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_army
    ADD CONSTRAINT player_army_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.player(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: player_assist_record player_assist_record_helper_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_assist_record
    ADD CONSTRAINT player_assist_record_helper_player_id_fkey FOREIGN KEY (helper_player_id) REFERENCES public.player(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: player_assist_record player_assist_record_target_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_assist_record
    ADD CONSTRAINT player_assist_record_target_player_id_fkey FOREIGN KEY (target_player_id) REFERENCES public.player(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: player_auth_identity player_auth_identity_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_auth_identity
    ADD CONSTRAINT player_auth_identity_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.player(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: player_building player_building_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_building
    ADD CONSTRAINT player_building_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.player(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: player_daily_task_state player_daily_task_state_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_daily_task_state
    ADD CONSTRAINT player_daily_task_state_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.player(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: player player_faction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player
    ADD CONSTRAINT player_faction_id_fkey FOREIGN KEY (faction_id) REFERENCES public.faction(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: player_faction_stipend_state player_faction_stipend_state_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_faction_stipend_state
    ADD CONSTRAINT player_faction_stipend_state_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.player(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: player_farm_board player_farm_board_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_farm_board
    ADD CONSTRAINT player_farm_board_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.player(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: player_field_slot player_field_slot_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_field_slot
    ADD CONSTRAINT player_field_slot_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.player(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: player_field_slot player_field_slot_seed_definition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_field_slot
    ADD CONSTRAINT player_field_slot_seed_definition_id_fkey FOREIGN KEY (seed_definition_id) REFERENCES public.seed_definition(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: player_invite_relation player_invite_relation_invited_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_invite_relation
    ADD CONSTRAINT player_invite_relation_invited_player_id_fkey FOREIGN KEY (invited_player_id) REFERENCES public.player(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: player_invite_relation player_invite_relation_inviter_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_invite_relation
    ADD CONSTRAINT player_invite_relation_inviter_player_id_fkey FOREIGN KEY (inviter_player_id) REFERENCES public.player(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: player_invite_relation player_invite_relation_source_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_invite_relation
    ADD CONSTRAINT player_invite_relation_source_campaign_id_fkey FOREIGN KEY (source_campaign_id) REFERENCES public.share_assist_campaign(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: player_land_deed_progress player_land_deed_progress_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_land_deed_progress
    ADD CONSTRAINT player_land_deed_progress_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.player(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: player_notification player_notification_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_notification
    ADD CONSTRAINT player_notification_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.player(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: player_notification player_notification_system_notification_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_notification
    ADD CONSTRAINT player_notification_system_notification_id_fkey FOREIGN KEY (system_notification_id) REFERENCES public.system_notification(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: player_plant_research player_plant_research_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_plant_research
    ADD CONSTRAINT player_plant_research_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.player(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: player_plant_research player_plant_research_seed_definition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_plant_research
    ADD CONSTRAINT player_plant_research_seed_definition_id_fkey FOREIGN KEY (seed_definition_id) REFERENCES public.seed_definition(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: player_season_achievement player_season_achievement_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_season_achievement
    ADD CONSTRAINT player_season_achievement_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.player(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: player_season_achievement player_season_achievement_reward_grant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_season_achievement
    ADD CONSTRAINT player_season_achievement_reward_grant_id_fkey FOREIGN KEY (reward_grant_id) REFERENCES public.player_season_reward_grant(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: player_season_achievement player_season_achievement_season_number_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_season_achievement
    ADD CONSTRAINT player_season_achievement_season_number_fkey FOREIGN KEY (season_number) REFERENCES public.game_season(season_number) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: player_season_activity player_season_activity_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_season_activity
    ADD CONSTRAINT player_season_activity_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.player(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: player_season_activity player_season_activity_season_number_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_season_activity
    ADD CONSTRAINT player_season_activity_season_number_fkey FOREIGN KEY (season_number) REFERENCES public.game_season(season_number) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: player_season_reward_grant player_season_reward_grant_notification_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_season_reward_grant
    ADD CONSTRAINT player_season_reward_grant_notification_id_fkey FOREIGN KEY (notification_id) REFERENCES public.player_notification(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: player_season_reward_grant player_season_reward_grant_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_season_reward_grant
    ADD CONSTRAINT player_season_reward_grant_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.player(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: player_season_reward_grant player_season_reward_grant_season_number_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_season_reward_grant
    ADD CONSTRAINT player_season_reward_grant_season_number_fkey FOREIGN KEY (season_number) REFERENCES public.game_season(season_number) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: player_season_sign_in player_season_sign_in_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_season_sign_in
    ADD CONSTRAINT player_season_sign_in_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.player(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: player_season_sign_in player_season_sign_in_season_number_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_season_sign_in
    ADD CONSTRAINT player_season_sign_in_season_number_fkey FOREIGN KEY (season_number) REFERENCES public.game_season(season_number) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: player_season_snapshot player_season_snapshot_faction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_season_snapshot
    ADD CONSTRAINT player_season_snapshot_faction_id_fkey FOREIGN KEY (faction_id) REFERENCES public.faction(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: player_season_snapshot player_season_snapshot_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_season_snapshot
    ADD CONSTRAINT player_season_snapshot_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.player(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: player_season_snapshot player_season_snapshot_season_number_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_season_snapshot
    ADD CONSTRAINT player_season_snapshot_season_number_fkey FOREIGN KEY (season_number) REFERENCES public.game_season(season_number) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: player_season_state player_season_state_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_season_state
    ADD CONSTRAINT player_season_state_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.player(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: player_seed_inventory player_seed_inventory_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_seed_inventory
    ADD CONSTRAINT player_seed_inventory_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.player(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: player_seed_inventory player_seed_inventory_seed_definition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_seed_inventory
    ADD CONSTRAINT player_seed_inventory_seed_definition_id_fkey FOREIGN KEY (seed_definition_id) REFERENCES public.seed_definition(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: player_social_feed player_social_feed_actor_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_social_feed
    ADD CONSTRAINT player_social_feed_actor_player_id_fkey FOREIGN KEY (actor_player_id) REFERENCES public.player(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: player_social_feed player_social_feed_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_social_feed
    ADD CONSTRAINT player_social_feed_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.player(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: player_social_relation player_social_relation_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_social_relation
    ADD CONSTRAINT player_social_relation_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.player(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: player_social_relation player_social_relation_target_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_social_relation
    ADD CONSTRAINT player_social_relation_target_player_id_fkey FOREIGN KEY (target_player_id) REFERENCES public.player(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: player_spirit_codex player_spirit_codex_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_spirit_codex
    ADD CONSTRAINT player_spirit_codex_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.player(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: player_spirit_codex player_spirit_codex_spirit_definition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_spirit_codex
    ADD CONSTRAINT player_spirit_codex_spirit_definition_id_fkey FOREIGN KEY (spirit_definition_id) REFERENCES public.spirit_definition(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: player_spirit_resource player_spirit_resource_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_spirit_resource
    ADD CONSTRAINT player_spirit_resource_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.player(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: player_spirit_slot player_spirit_slot_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_spirit_slot
    ADD CONSTRAINT player_spirit_slot_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.player(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: player_spirit_slot player_spirit_slot_spirit_definition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_spirit_slot
    ADD CONSTRAINT player_spirit_slot_spirit_definition_id_fkey FOREIGN KEY (spirit_definition_id) REFERENCES public.spirit_definition(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: player_spirit_trait player_spirit_trait_spirit_slot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_spirit_trait
    ADD CONSTRAINT player_spirit_trait_spirit_slot_id_fkey FOREIGN KEY (spirit_slot_id) REFERENCES public.player_spirit_slot(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: player_wallet player_wallet_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_wallet
    ADD CONSTRAINT player_wallet_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.player(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: raid_asset_lock raid_asset_lock_defender_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.raid_asset_lock
    ADD CONSTRAINT raid_asset_lock_defender_player_id_fkey FOREIGN KEY (defender_player_id) REFERENCES public.player(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: raid_asset_lock raid_asset_lock_raid_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.raid_asset_lock
    ADD CONSTRAINT raid_asset_lock_raid_order_id_fkey FOREIGN KEY (raid_order_id) REFERENCES public.raid_order(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: raid_asset_lock raid_asset_lock_source_field_slot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.raid_asset_lock
    ADD CONSTRAINT raid_asset_lock_source_field_slot_id_fkey FOREIGN KEY (source_field_slot_id) REFERENCES public.player_field_slot(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: raid_order raid_order_attacker_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.raid_order
    ADD CONSTRAINT raid_order_attacker_player_id_fkey FOREIGN KEY (attacker_player_id) REFERENCES public.player(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: raid_order raid_order_defender_field_slot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.raid_order
    ADD CONSTRAINT raid_order_defender_field_slot_id_fkey FOREIGN KEY (defender_field_slot_id) REFERENCES public.player_field_slot(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: raid_order raid_order_defender_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.raid_order
    ADD CONSTRAINT raid_order_defender_player_id_fkey FOREIGN KEY (defender_player_id) REFERENCES public.player(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: raid_order_message raid_order_message_author_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.raid_order_message
    ADD CONSTRAINT raid_order_message_author_player_id_fkey FOREIGN KEY (author_player_id) REFERENCES public.player(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: raid_order_message raid_order_message_raid_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.raid_order_message
    ADD CONSTRAINT raid_order_message_raid_order_id_fkey FOREIGN KEY (raid_order_id) REFERENCES public.raid_order(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: raid_order_message raid_order_message_receiver_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.raid_order_message
    ADD CONSTRAINT raid_order_message_receiver_player_id_fkey FOREIGN KEY (receiver_player_id) REFERENCES public.player(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: raid_order_message raid_order_message_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.raid_order_message
    ADD CONSTRAINT raid_order_message_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.raid_message_template(template_id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: raid_order raid_order_source_target_pool_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.raid_order
    ADD CONSTRAINT raid_order_source_target_pool_id_fkey FOREIGN KEY (source_target_pool_id) REFERENCES public.raid_target_pool(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: raid_settlement raid_settlement_raid_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.raid_settlement
    ADD CONSTRAINT raid_settlement_raid_order_id_fkey FOREIGN KEY (raid_order_id) REFERENCES public.raid_order(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: raid_target_pool raid_target_pool_owner_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.raid_target_pool
    ADD CONSTRAINT raid_target_pool_owner_player_id_fkey FOREIGN KEY (owner_player_id) REFERENCES public.player(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: raid_target_pool raid_target_pool_target_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.raid_target_pool
    ADD CONSTRAINT raid_target_pool_target_player_id_fkey FOREIGN KEY (target_player_id) REFERENCES public.player(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: robot_action_log robot_action_log_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.robot_action_log
    ADD CONSTRAINT robot_action_log_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.player(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: robot_action_log robot_action_log_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.robot_action_log
    ADD CONSTRAINT robot_action_log_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.robot_test_run(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: robot_sim_snapshot robot_sim_snapshot_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.robot_sim_snapshot
    ADD CONSTRAINT robot_sim_snapshot_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.player(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: robot_sim_snapshot robot_sim_snapshot_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.robot_sim_snapshot
    ADD CONSTRAINT robot_sim_snapshot_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.robot_test_run(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: share_assist_campaign share_assist_campaign_owner_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.share_assist_campaign
    ADD CONSTRAINT share_assist_campaign_owner_player_id_fkey FOREIGN KEY (owner_player_id) REFERENCES public.player(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: share_assist_record share_assist_record_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.share_assist_record
    ADD CONSTRAINT share_assist_record_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.share_assist_campaign(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: share_assist_record share_assist_record_helper_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.share_assist_record
    ADD CONSTRAINT share_assist_record_helper_player_id_fkey FOREIGN KEY (helper_player_id) REFERENCES public.player(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: spirit_ad_reward_log spirit_ad_reward_log_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.spirit_ad_reward_log
    ADD CONSTRAINT spirit_ad_reward_log_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.player(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: spirit_breakthrough_log spirit_breakthrough_log_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.spirit_breakthrough_log
    ADD CONSTRAINT spirit_breakthrough_log_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.player(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: spirit_breakthrough_log spirit_breakthrough_log_spirit_slot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.spirit_breakthrough_log
    ADD CONSTRAINT spirit_breakthrough_log_spirit_slot_id_fkey FOREIGN KEY (spirit_slot_id) REFERENCES public.player_spirit_slot(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: spirit_feed_log spirit_feed_log_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.spirit_feed_log
    ADD CONSTRAINT spirit_feed_log_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.player(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: spirit_feed_log spirit_feed_log_spirit_slot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.spirit_feed_log
    ADD CONSTRAINT spirit_feed_log_spirit_slot_id_fkey FOREIGN KEY (spirit_slot_id) REFERENCES public.player_spirit_slot(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: spirit_shop_purchase_log spirit_shop_purchase_log_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.spirit_shop_purchase_log
    ADD CONSTRAINT spirit_shop_purchase_log_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.player(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: spirit_trait_roll_log spirit_trait_roll_log_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.spirit_trait_roll_log
    ADD CONSTRAINT spirit_trait_roll_log_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.player(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: spirit_trait_roll_log spirit_trait_roll_log_spirit_slot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.spirit_trait_roll_log
    ADD CONSTRAINT spirit_trait_roll_log_spirit_slot_id_fkey FOREIGN KEY (spirit_slot_id) REFERENCES public.player_spirit_slot(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: task_reward_log task_reward_log_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_reward_log
    ADD CONSTRAINT task_reward_log_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.player(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: task_reward_log task_reward_log_task_state_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_reward_log
    ADD CONSTRAINT task_reward_log_task_state_id_fkey FOREIGN KEY (task_state_id) REFERENCES public.player_daily_task_state(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: team_challenge team_challenge_ally_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_challenge
    ADD CONSTRAINT team_challenge_ally_player_id_fkey FOREIGN KEY (ally_player_id) REFERENCES public.player(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: team_challenge team_challenge_initiator_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_challenge
    ADD CONSTRAINT team_challenge_initiator_player_id_fkey FOREIGN KEY (initiator_player_id) REFERENCES public.player(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: team_challenge team_challenge_target_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_challenge
    ADD CONSTRAINT team_challenge_target_player_id_fkey FOREIGN KEY (target_player_id) REFERENCES public.player(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: wallet_change_log wallet_change_log_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallet_change_log
    ADD CONSTRAINT wallet_change_log_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.player(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict mQ4dhdufXxwivefk9FNBPwIFDY7zwsKrMyEBflpbW2EgGeVLb21AI2oMkFVgbBu

