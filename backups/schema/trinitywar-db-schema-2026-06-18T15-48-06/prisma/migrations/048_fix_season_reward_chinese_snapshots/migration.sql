-- Fix already-generated season reward snapshots that were written with English copy.
-- This updates persisted data at the source: notification snapshots and reward JSON.

CREATE OR REPLACE FUNCTION public.tw_fix_season_reward_item(item jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE item->>'kind'
    WHEN 'tianjiTalisman' THEN item || jsonb_build_object('label', '天机符', 'name', '天机符', 'nameEn', COALESCE(item->>'nameEn', 'Tianji Talisman'))
    WHEN 'spiritSoul' THEN item || jsonb_build_object('label', '兽魂', 'name', '兽魂', 'nameEn', COALESCE(item->>'nameEn', 'Spirit Soul'))
    WHEN 'ordinarySoul' THEN item || jsonb_build_object('label', '普通兽魂', 'name', '普通兽魂', 'nameEn', COALESCE(item->>'nameEn', 'Ordinary Soul'))
    WHEN 'rareSoul' THEN item || jsonb_build_object('label', '稀有兽魂', 'name', '稀有兽魂', 'nameEn', COALESCE(item->>'nameEn', 'Rare Soul'))
    WHEN 'legendarySoul' THEN item || jsonb_build_object('label', '传说兽魂', 'name', '传说兽魂', 'nameEn', COALESCE(item->>'nameEn', 'Legendary Soul'))
    WHEN 'essence' THEN item || jsonb_build_object(
      'label',
      CASE item->>'essenceType'
        WHEN 'qinglingmai' THEN '青灵麦精华'
        WHEN 'qilingya' THEN '启灵芽精华'
        ELSE COALESCE(item->>'name', item->>'label')
      END,
      'name',
      CASE item->>'essenceType'
        WHEN 'qinglingmai' THEN '青灵麦精华'
        WHEN 'qilingya' THEN '启灵芽精华'
        ELSE COALESCE(item->>'name', item->>'label')
      END,
      'nameEn',
      COALESCE(
        item->>'nameEn',
        CASE item->>'essenceType'
          WHEN 'qinglingmai' THEN 'Qinglingmai Essence'
          WHEN 'qilingya' THEN 'Qilingya Essence'
          ELSE item->>'label'
        END
      )
    )
    WHEN 'spiritShard' THEN item || jsonb_build_object(
      'label',
      CASE item->>'spiritId'
        WHEN 'canglang' THEN '苍狼精魄'
        ELSE COALESCE(item->>'name', item->>'label')
      END,
      'name',
      CASE item->>'spiritId'
        WHEN 'canglang' THEN '苍狼精魄'
        ELSE COALESCE(item->>'name', item->>'label')
      END,
      'nameEn',
      COALESCE(
        item->>'nameEn',
        CASE item->>'spiritId'
          WHEN 'canglang' THEN 'Canglang Shard'
          ELSE item->>'label'
        END
      )
    )
    WHEN 'medal' THEN item || jsonb_build_object(
      'label',
      (CASE item->>'domain'
        WHEN 'farming' THEN '种田'
        WHEN 'spirit' THEN '养宠'
        WHEN 'combat' THEN '探索战斗'
        WHEN 'contribution' THEN '赛季贡献'
        ELSE '赛季'
      END) ||
      (CASE
        WHEN lower(COALESCE(item->>'medalKey', item->>'label', '')) LIKE '%gold%' THEN '金章'
        WHEN lower(COALESCE(item->>'medalKey', item->>'label', '')) LIKE '%silver%' THEN '银章'
        WHEN lower(COALESCE(item->>'medalKey', item->>'label', '')) LIKE '%bronze%' THEN '铜章'
        ELSE '奖章'
      END),
      'name',
      (CASE item->>'domain'
        WHEN 'farming' THEN '种田'
        WHEN 'spirit' THEN '养宠'
        WHEN 'combat' THEN '探索战斗'
        WHEN 'contribution' THEN '赛季贡献'
        ELSE '赛季'
      END) ||
      (CASE
        WHEN lower(COALESCE(item->>'medalKey', item->>'label', '')) LIKE '%gold%' THEN '金章'
        WHEN lower(COALESCE(item->>'medalKey', item->>'label', '')) LIKE '%silver%' THEN '银章'
        WHEN lower(COALESCE(item->>'medalKey', item->>'label', '')) LIKE '%bronze%' THEN '铜章'
        ELSE '奖章'
      END),
      'nameEn',
      COALESCE(item->>'nameEn', item->>'label')
    )
    ELSE item
  END;
$$;

UPDATE player_notification AS pn
SET
  title_snapshot = 'S' || psrg.season_number::text || ' 赛季奖励',
  body_snapshot = '你在 S' || psrg.season_number::text || ' 赛季获得了' ||
    CASE psrg.reward_type
      WHEN 'participation' THEN '基础参与'
      WHEN 'domain_farming' THEN '种田领域'
      WHEN 'domain_spirit' THEN '养宠领域'
      WHEN 'domain_combat' THEN '探索战斗领域'
      WHEN 'contribution_tier' THEN '贡献领域'
      ELSE psrg.reward_type
    END ||
    '奖励，请在过期前领取。',
  attachment_json = (
    SELECT COALESCE(jsonb_agg(public.tw_fix_season_reward_item(item)), '[]'::jsonb)
    FROM jsonb_array_elements(COALESCE(pn.attachment_json::jsonb, '[]'::jsonb)) AS item
  )
FROM player_season_reward_grant AS psrg
WHERE pn.id = psrg.notification_id
  AND pn.category = 'REWARD';

UPDATE player_season_reward_grant AS psrg
SET reward_json = (
  SELECT COALESCE(jsonb_agg(public.tw_fix_season_reward_item(item)), '[]'::jsonb)
  FROM jsonb_array_elements(COALESCE(psrg.reward_json::jsonb, '[]'::jsonb)) AS item
);

DROP FUNCTION public.tw_fix_season_reward_item(jsonb);
