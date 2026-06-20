UPDATE "spirit_definition"
SET
  "label" = '岩龟',
  "shard_name" = '岩龟精魄',
  "lore" = '岩甲厚重、正面抗压稳定，适合作为耐久型过渡宠。',
  "updated_at" = CURRENT_TIMESTAMP
WHERE "spirit_id" = 'hegui';

UPDATE "spirit_definition"
SET
  "label" = '玄蛇',
  "shard_name" = '玄蛇精魄',
  "lore" = '玄鳞绕雾、气息绵长，越到后程越能撑住燃血压力。',
  "updated_at" = CURRENT_TIMESTAMP
WHERE "spirit_id" = 'xuangui';
