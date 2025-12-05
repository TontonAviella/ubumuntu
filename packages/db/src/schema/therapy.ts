import type { z } from "zod";
import {
  text,
  timestamp,
  uuid,
  varchar,
  integer,
  real,
  jsonb,
  boolean,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { timestamps } from "../lib/utils";
import { createTable } from "./_table";

// ============================================================================
// User Profile - Speech condition and preferences
// ============================================================================

export const UserProfile = createTable("user_profile", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().unique(),

  // Speech profile
  speechCondition: varchar("speech_condition", { length: 100 }), // dysarthria, apraxia, autism, stuttering, etc.
  severityLevel: integer("severity_level"), // 1-5 scale
  targetPhonemes: jsonb("target_phonemes").$type<string[]>(), // Phonemes to focus on

  // Therapy settings
  difficultyLevel: integer("difficulty_level").default(1), // 1-5
  preferredSpeed: real("preferred_speed").default(1.0), // TTS speed

  // Voice cloning
  voiceProfileUrl: text("voice_profile_url"), // S3 URL for voice reference

  // Therapist link
  therapistId: text("therapist_id"),

  // Preferences
  exercisePreferences: jsonb("exercise_preferences").$type<Record<string, unknown>>(),
  accessibilitySettings: jsonb("accessibility_settings").$type<Record<string, unknown>>(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at", {
    mode: "date",
    withTimezone: true,
  }).$onUpdateFn(() => new Date()),
});

// ============================================================================
// Therapy Session - Individual practice sessions
// ============================================================================

export const TherapySession = createTable("therapy_session", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),

  // Session info
  sessionType: varchar("session_type", { length: 50 }).notNull(), // exercise, conversation, aac, assessment
  status: varchar("status", { length: 20 }).default("active"), // active, completed, abandoned

  // Timing
  startedAt: timestamp("started_at").defaultNow().notNull(),
  endedAt: timestamp("ended_at"),
  durationSeconds: integer("duration_seconds"),

  // Metrics
  exerciseCount: integer("exercise_count").default(0),
  averageScore: real("average_score"),

  // Session data
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  notes: text("notes"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at", {
    mode: "date",
    withTimezone: true,
  }).$onUpdateFn(() => new Date()),
});

// ============================================================================
// Exercise Attempt - Individual exercise attempts within a session
// ============================================================================

export const ExerciseAttempt = createTable("exercise_attempt", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").references(() => TherapySession.id),
  userId: text("user_id").notNull(),

  // Exercise info
  exerciseType: varchar("exercise_type", { length: 50 }).notNull(), // repeat_after_me, minimal_pairs, etc.
  targetText: text("target_text").notNull(),
  difficulty: integer("difficulty").default(1),

  // Results
  transcription: text("transcription"),
  overallScore: real("overall_score"),
  clarityScore: real("clarity_score"),
  paceScore: real("pace_score"),
  fluencyScore: real("fluency_score"),

  // Detailed feedback
  wordScores: jsonb("word_scores").$type<Array<{
    word: string;
    score: number;
    errors: Array<{
      type: string;
      expected: string;
      actual: string | null;
      suggestion: string;
    }>;
  }>>(),
  phonemeErrors: jsonb("phoneme_errors").$type<Array<{
    word: string;
    position: number;
    expected: string;
    actual: string | null;
    errorType: string;
    suggestion: string;
  }>>(),
  suggestions: jsonb("suggestions").$type<string[]>(),

  // AI Feedback from GPT-4o via GitHub Models
  aiFeedback: jsonb("ai_feedback").$type<{
    feedback: string;
    encouragement: string;
    specificTips: string[];
    recommendedExercises: string[];
    difficultyAdjustment?: "easier" | "same" | "harder";
  }>(),

  // Audio storage
  audioUrl: text("audio_url"), // S3 URL for review

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================================================
// Progress Metric - Tracked metrics over time
// ============================================================================

export const ProgressMetric = createTable("progress_metric", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),

  // Metric info
  metricType: varchar("metric_type", { length: 50 }).notNull(), // pcc, pwc, intelligibility, clarity, pace
  value: real("value").notNull(),

  // Context
  exerciseType: varchar("exercise_type", { length: 50 }),
  targetPhoneme: varchar("target_phoneme", { length: 20 }),

  // Notes
  notes: text("notes"),

  measuredAt: timestamp("measured_at").defaultNow().notNull(),
});

// ============================================================================
// Exercise Library - Available exercises and prompts
// ============================================================================

export const ExerciseLibrary = createTable("exercise_library", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Exercise definition
  exerciseType: varchar("exercise_type", { length: 50 }).notNull(),
  category: varchar("category", { length: 50 }), // articulation, fluency, voice, language
  targetText: text("target_text").notNull(),

  // Targeting
  targetPhonemes: jsonb("target_phonemes").$type<string[]>(),
  difficulty: integer("difficulty").default(1), // 1-5

  // Display
  instructions: text("instructions"),
  audioPromptUrl: text("audio_prompt_url"),
  imageUrl: text("image_url"),

  // Metadata
  isActive: boolean("is_active").default(true),
  usageCount: integer("usage_count").default(0),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at", {
    mode: "date",
    withTimezone: true,
  }).$onUpdateFn(() => new Date()),
});

// ============================================================================
// AAC Board Configuration - User's AAC board setup
// ============================================================================

export const AACBoard = createTable("aac_board", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),

  // Board config
  name: varchar("name", { length: 100 }).notNull(),
  isDefault: boolean("is_default").default(false),

  // Layout
  gridColumns: integer("grid_columns").default(4),
  gridRows: integer("grid_rows").default(4),

  // Symbols
  symbols: jsonb("symbols").$type<Array<{
    id: string;
    label: string;
    imageUrl: string;
    audioUrl?: string;
    position: { row: number; col: number };
    category?: string;
  }>>(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at", {
    mode: "date",
    withTimezone: true,
  }).$onUpdateFn(() => new Date()),
});

// ============================================================================
// Relations
// ============================================================================

export const therapySessionRelations = relations(TherapySession, ({ many }) => ({
  attempts: many(ExerciseAttempt),
}));

export const exerciseAttemptRelations = relations(ExerciseAttempt, ({ one }) => ({
  session: one(TherapySession, {
    fields: [ExerciseAttempt.sessionId],
    references: [TherapySession.id],
  }),
}));

// ============================================================================
// Zod Schemas - For API validation
// ============================================================================

// UserProfile
const userProfileBaseSchema = createSelectSchema(UserProfile).omit(timestamps);
export const insertUserProfileSchema = createInsertSchema(UserProfile).omit(timestamps);
export const insertUserProfileParams = insertUserProfileSchema.extend({}).omit({
  id: true,
});
export const updateUserProfileParams = userProfileBaseSchema
  .omit({ userId: true })
  .partial()
  .extend({ id: userProfileBaseSchema.shape.id });

// TherapySession
const sessionBaseSchema = createSelectSchema(TherapySession).omit(timestamps);
export const insertSessionSchema = createInsertSchema(TherapySession).omit(timestamps);
export const insertSessionParams = insertSessionSchema.extend({}).omit({
  id: true,
  userId: true,
});
export const updateSessionParams = sessionBaseSchema
  .omit({ userId: true })
  .partial()
  .extend({ id: sessionBaseSchema.shape.id });
export const sessionIdSchema = sessionBaseSchema.pick({ id: true });

// ExerciseAttempt
const attemptBaseSchema = createSelectSchema(ExerciseAttempt);
export const insertAttemptSchema = createInsertSchema(ExerciseAttempt);
export const insertAttemptParams = insertAttemptSchema.extend({}).omit({
  id: true,
  userId: true,
});

// ProgressMetric
const metricBaseSchema = createSelectSchema(ProgressMetric);
export const insertMetricSchema = createInsertSchema(ProgressMetric);
export const insertMetricParams = insertMetricSchema.extend({}).omit({
  id: true,
  userId: true,
});

// ExerciseLibrary
const exerciseLibraryBaseSchema = createSelectSchema(ExerciseLibrary).omit(timestamps);
export const insertExerciseLibrarySchema = createInsertSchema(ExerciseLibrary).omit(timestamps);

// AACBoard
const aacBoardBaseSchema = createSelectSchema(AACBoard).omit(timestamps);
export const insertAACBoardSchema = createInsertSchema(AACBoard).omit(timestamps);
export const insertAACBoardParams = insertAACBoardSchema.extend({}).omit({
  id: true,
  userId: true,
});

// ============================================================================
// Types
// ============================================================================

export type UserProfile = typeof UserProfile.$inferSelect;
export type NewUserProfile = z.infer<typeof insertUserProfileSchema>;

export type TherapySession = typeof TherapySession.$inferSelect;
export type NewTherapySession = z.infer<typeof insertSessionSchema>;

export type ExerciseAttempt = typeof ExerciseAttempt.$inferSelect;
export type NewExerciseAttempt = z.infer<typeof insertAttemptSchema>;

export type ProgressMetric = typeof ProgressMetric.$inferSelect;
export type NewProgressMetric = z.infer<typeof insertMetricSchema>;

export type ExerciseLibrary = typeof ExerciseLibrary.$inferSelect;
export type AACBoard = typeof AACBoard.$inferSelect;
