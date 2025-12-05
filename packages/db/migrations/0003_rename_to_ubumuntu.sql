-- Rename all tables from scribeHC_* to ubumuntu_*
-- This migration rebrands the database tables to match the new product name: Ubumuntu

-- Rename tables
ALTER TABLE "scribeHC_note" RENAME TO "ubumuntu_note";
ALTER TABLE "scribeHC_aac_board" RENAME TO "ubumuntu_aac_board";
ALTER TABLE "scribeHC_exercise_attempt" RENAME TO "ubumuntu_exercise_attempt";
ALTER TABLE "scribeHC_exercise_library" RENAME TO "ubumuntu_exercise_library";
ALTER TABLE "scribeHC_progress_metric" RENAME TO "ubumuntu_progress_metric";
ALTER TABLE "scribeHC_therapy_session" RENAME TO "ubumuntu_therapy_session";
ALTER TABLE "scribeHC_user_profile" RENAME TO "ubumuntu_user_profile";

-- Rename foreign key constraint
ALTER TABLE "ubumuntu_exercise_attempt"
  DROP CONSTRAINT IF EXISTS "scribeHC_exercise_attempt_session_id_scribeHC_therapy_session_id_fk";

ALTER TABLE "ubumuntu_exercise_attempt"
  ADD CONSTRAINT "ubumuntu_exercise_attempt_session_id_ubumuntu_therapy_session_id_fk"
  FOREIGN KEY ("session_id") REFERENCES "ubumuntu_therapy_session"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- Rename unique constraint
ALTER TABLE "ubumuntu_user_profile"
  DROP CONSTRAINT IF EXISTS "scribeHC_user_profile_user_id_unique";

ALTER TABLE "ubumuntu_user_profile"
  ADD CONSTRAINT "ubumuntu_user_profile_user_id_unique" UNIQUE("user_id");
