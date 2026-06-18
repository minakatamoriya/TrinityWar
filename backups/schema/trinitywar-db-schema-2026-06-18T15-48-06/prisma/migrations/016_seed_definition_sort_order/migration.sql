ALTER TABLE "seed_definition"
ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0;

UPDATE "seed_definition"
SET "sort_order" = CASE "seed_id"
  WHEN 'qinglingmai' THEN 10
  WHEN 'xunyamai' THEN 20
  WHEN 'ninglucao' THEN 30
  WHEN 'suixinhua' THEN 40
  WHEN 'baiyulian' THEN 50
  WHEN 'yingyuezhu' THEN 60
  WHEN 'qianjiteng' THEN 70
  WHEN 'huichuncao' THEN 110
  WHEN 'xueyuehua' THEN 120
  WHEN 'jingdaosong' THEN 130
  WHEN 'hundunguo' THEN 140
  WHEN 'zhanqingsi' THEN 210
  WHEN 'wangchuanying' THEN 220
  WHEN 'zhaoyouming' THEN 230
  ELSE "sort_order"
END;

CREATE INDEX IF NOT EXISTS "seed_definition_rarity_sort_order_idx"
ON "seed_definition"("rarity", "sort_order");
