CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"platform" text NOT NULL,
	"username" text NOT NULL,
	"display_name" text NOT NULL,
	"avatar_url" text,
	"country" text,
	"joined_at" timestamp with time zone,
	"ratings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"total_games" integer DEFAULT 0 NOT NULL,
	"imported_games" integer DEFAULT 0 NOT NULL,
	"last_synced_at" timestamp with time zone,
	"sync_status" text DEFAULT 'idle' NOT NULL,
	"sync_message" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drills" (
	"id" text PRIMARY KEY NOT NULL,
	"game_id" text NOT NULL,
	"account_id" text,
	"kind" text DEFAULT 'improve' NOT NULL,
	"found" boolean DEFAULT false NOT NULL,
	"ply" integer NOT NULL,
	"fen" text NOT NULL,
	"solution" text NOT NULL,
	"solution_san" text NOT NULL,
	"played_san" text NOT NULL,
	"prompt" text NOT NULL,
	"theme" text NOT NULL,
	"classification" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"solved" integer DEFAULT 0 NOT NULL,
	"last_result" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "games" (
	"id" text PRIMARY KEY NOT NULL,
	"pgn_hash" text NOT NULL,
	"source" text NOT NULL,
	"external_url" text,
	"account_id" text,
	"white_name" text NOT NULL,
	"black_name" text NOT NULL,
	"white_rating" integer,
	"black_rating" integer,
	"result" text DEFAULT '*' NOT NULL,
	"you_color" text,
	"opening" text DEFAULT 'Uncharted opening' NOT NULL,
	"opening_family" text DEFAULT 'Uncharted opening' NOT NULL,
	"opening_line" text DEFAULT '' NOT NULL,
	"eco" text,
	"time_control" text,
	"speed" text,
	"rated" boolean DEFAULT true NOT NULL,
	"termination" text,
	"your_result" text,
	"opp_result" text,
	"endgame_type" text,
	"endgame_start_ply" integer,
	"endgame_diff" integer,
	"white_castled_ply" integer,
	"black_castled_ply" integer,
	"platform_accuracy" real,
	"event" text,
	"site" text,
	"played_at" timestamp with time zone,
	"pgn" text NOT NULL,
	"initial_fen" text NOT NULL,
	"ply_count" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'imported' NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"queued_at" timestamp with time zone,
	"analysis_error" text,
	"depth" integer,
	"accuracy_white" real,
	"accuracy_black" real,
	"acpl_white" real,
	"acpl_black" real,
	"estimated_white" integer,
	"estimated_black" integer,
	"summary" jsonb,
	"moves" jsonb,
	"tail" jsonb,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"analyzed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "profile" (
	"id" integer PRIMARY KEY NOT NULL,
	"display_name" text DEFAULT 'You' NOT NULL,
	"chesscom" text DEFAULT '' NOT NULL,
	"lichess" text DEFAULT '' NOT NULL,
	"rating" integer DEFAULT 1400 NOT NULL,
	"depth" integer DEFAULT 12 NOT NULL,
	"bulk_depth" integer DEFAULT 10 NOT NULL,
	"board_theme" text DEFAULT 'neon' NOT NULL,
	"coach_tone" text DEFAULT 'patient' NOT NULL,
	"focus" text DEFAULT 'all' NOT NULL,
	"sound" boolean DEFAULT true NOT NULL,
	"show_arrows" boolean DEFAULT false NOT NULL,
	"active_account_id" text,
	"seeded" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reference_games" (
	"id" text PRIMARY KEY NOT NULL,
	"external_url" text,
	"source" text NOT NULL,
	"white_name" text NOT NULL,
	"black_name" text NOT NULL,
	"white_elo" integer,
	"black_elo" integer,
	"result" text NOT NULL,
	"opening" text DEFAULT 'Uncharted opening' NOT NULL,
	"opening_family" text DEFAULT 'Uncharted opening' NOT NULL,
	"eco" text,
	"event" text,
	"speed" text,
	"played_at" timestamp with time zone,
	"pgn" text NOT NULL,
	"initial_fen" text NOT NULL,
	"midgame_fen" text NOT NULL,
	"midgame_ply" integer DEFAULT 0 NOT NULL,
	"ply_count" integer DEFAULT 0 NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_cursors" (
	"id" text PRIMARY KEY NOT NULL,
	"scope" text NOT NULL,
	"cursor" integer DEFAULT 0 NOT NULL,
	"untouched" integer DEFAULT 0 NOT NULL,
	"complete" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "theory_progress" (
	"id" text PRIMARY KEY NOT NULL,
	"uid" text NOT NULL,
	"module_id" text NOT NULL,
	"correct" integer DEFAULT 0 NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"best_score" integer DEFAULT 0 NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "drills" ADD CONSTRAINT "drills_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_platform_username_idx" ON "accounts" USING btree ("platform","username");--> statement-breakpoint
CREATE INDEX "drills_game_idx" ON "drills" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "drills_account_idx" ON "drills" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "games_pgn_hash_idx" ON "games" USING btree ("pgn_hash");--> statement-breakpoint
CREATE INDEX "games_account_idx" ON "games" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "games_status_idx" ON "games" USING btree ("status");--> statement-breakpoint
CREATE INDEX "games_external_url_idx" ON "games" USING btree ("external_url");--> statement-breakpoint
CREATE INDEX "games_played_at_idx" ON "games" USING btree ("played_at");--> statement-breakpoint
CREATE UNIQUE INDEX "reference_url_idx" ON "reference_games" USING btree ("external_url");--> statement-breakpoint
CREATE INDEX "reference_players_idx" ON "reference_games" USING btree ("white_name","black_name");--> statement-breakpoint
CREATE INDEX "reference_opening_idx" ON "reference_games" USING btree ("opening_family");--> statement-breakpoint
CREATE UNIQUE INDEX "theory_uid_module_idx" ON "theory_progress" USING btree ("uid","module_id");--> statement-breakpoint
CREATE INDEX "theory_uid_idx" ON "theory_progress" USING btree ("uid");