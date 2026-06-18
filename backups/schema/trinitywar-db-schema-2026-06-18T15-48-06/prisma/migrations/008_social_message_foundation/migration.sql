-- CreateTable
CREATE TABLE "player_farm_board" (
    "player_id" TEXT NOT NULL,
    "message" TEXT NOT NULL DEFAULT '',
    "board_version" INTEGER NOT NULL DEFAULT 1,
    "hidden_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_farm_board_pkey" PRIMARY KEY ("player_id"),
    CONSTRAINT "player_farm_board_message_length_check" CHECK (char_length("message") <= 40)
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

    CONSTRAINT "raid_message_template_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "raid_message_template_text_length_check" CHECK (char_length("text") <= 40)
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

    CONSTRAINT "raid_order_message_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "raid_order_message_text_snapshot_length_check" CHECK (char_length("text_snapshot") <= 40)
);

-- CreateIndex
CREATE UNIQUE INDEX "raid_message_template_template_id_key" ON "raid_message_template"("template_id");

-- CreateIndex
CREATE INDEX "raid_message_template_is_active_sort_order_idx" ON "raid_message_template"("is_active", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "raid_order_message_raid_order_id_key" ON "raid_order_message"("raid_order_id");

-- CreateIndex
CREATE INDEX "raid_order_message_author_player_id_created_at_idx" ON "raid_order_message"("author_player_id", "created_at");

-- CreateIndex
CREATE INDEX "raid_order_message_receiver_player_id_created_at_idx" ON "raid_order_message"("receiver_player_id", "created_at");

-- CreateIndex
CREATE INDEX "raid_order_message_template_id_idx" ON "raid_order_message"("template_id");

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
