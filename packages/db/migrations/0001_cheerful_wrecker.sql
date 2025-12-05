CREATE TABLE IF NOT EXISTS "scribeHC_aac_board" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" varchar(100) NOT NULL,
	"is_default" boolean DEFAULT false,
	"grid_columns" integer DEFAULT 4,
	"grid_rows" integer DEFAULT 4,
	"symbols" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scribeHC_exercise_attempt" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid,
	"user_id" text NOT NULL,
	"exercise_type" varchar(50) NOT NULL,
	"target_text" text NOT NULL,
	"difficulty" integer DEFAULT 1,
	"transcription" text,
	"overall_score" real,
	"clarity_score" real,
	"pace_score" real,
	"fluency_score" real,
	"word_scores" jsonb,
	"phoneme_errors" jsonb,
	"suggestions" jsonb,
	"audio_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scribeHC_exercise_library" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exercise_type" varchar(50) NOT NULL,
	"category" varchar(50),
	"target_text" text NOT NULL,
	"target_phonemes" jsonb,
	"difficulty" integer DEFAULT 1,
	"instructions" text,
	"audio_prompt_url" text,
	"image_url" text,
	"is_active" boolean DEFAULT true,
	"usage_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scribeHC_progress_metric" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"metric_type" varchar(50) NOT NULL,
	"value" real NOT NULL,
	"exercise_type" varchar(50),
	"target_phoneme" varchar(20),
	"notes" text,
	"measured_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scribeHC_therapy_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"session_type" varchar(50) NOT NULL,
	"status" varchar(20) DEFAULT 'active',
	"started_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp,
	"duration_seconds" integer,
	"exercise_count" integer DEFAULT 0,
	"average_score" real,
	"metadata" jsonb,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scribeHC_user_profile" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"speech_condition" varchar(100),
	"severity_level" integer,
	"target_phonemes" jsonb,
	"difficulty_level" integer DEFAULT 1,
	"preferred_speed" real DEFAULT 1,
	"voice_profile_url" text,
	"therapist_id" text,
	"exercise_preferences" jsonb,
	"accessibility_settings" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "scribeHC_user_profile_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scribeHC_exercise_attempt" ADD CONSTRAINT "scribeHC_exercise_attempt_session_id_scribeHC_therapy_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."scribeHC_therapy_session"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
