DELETE FROM "raid_target_pool"
WHERE "target_snapshot_json"->>'tutorialTarget' = 'true';
