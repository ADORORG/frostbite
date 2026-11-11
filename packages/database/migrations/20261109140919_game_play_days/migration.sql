CREATE TABLE "frostbite"."game_play_days" (
	"game_id" text,
	"day" date,
	"plays" integer NOT NULL,
	CONSTRAINT "game_play_days_pkey" PRIMARY KEY("game_id","day"),
	CONSTRAINT "game_play_days_plays_positive" CHECK ("plays" > 0)
);
