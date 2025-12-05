import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod";

import { and, desc, eq } from "@shc/db";
import {
  UserProfile,
  TherapySession,
  ExerciseAttempt,
  ProgressMetric,
  insertUserProfileParams,
  insertSessionParams,
  insertAttemptParams,
} from "@shc/db/schema";

import { protectedProcedure } from "../trpc";

export const therapyRouter = {
  // ============================================================================
  // User Profile
  // ============================================================================

  getProfile: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.userId;

    const profile = await ctx.db.query.UserProfile.findFirst({
      where: eq(UserProfile.userId, userId),
    });

    return { profile };
  }),

  upsertProfile: protectedProcedure
    .input(
      z.object({
        speechCondition: z.string().optional(),
        severityLevel: z.number().min(1).max(5).optional(),
        targetPhonemes: z.array(z.string()).optional(),
        difficultyLevel: z.number().min(1).max(5).optional(),
        preferredSpeed: z.number().min(0.5).max(2.0).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.userId;

      const existing = await ctx.db.query.UserProfile.findFirst({
        where: eq(UserProfile.userId, userId),
      });

      if (existing) {
        const [updated] = await ctx.db
          .update(UserProfile)
          .set(input)
          .where(eq(UserProfile.userId, userId))
          .returning();
        return { profile: updated };
      }

      const [created] = await ctx.db
        .insert(UserProfile)
        .values({ ...input, userId })
        .returning();

      return { profile: created };
    }),

  // ============================================================================
  // Sessions
  // ============================================================================

  getSessions: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.userId;

      const sessions = await ctx.db.query.TherapySession.findMany({
        where: eq(TherapySession.userId, userId),
        orderBy: desc(TherapySession.startedAt),
        limit: input.limit,
      });

      return { sessions };
    }),

  getSession: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.userId;

      const session = await ctx.db.query.TherapySession.findFirst({
        where: and(
          eq(TherapySession.id, input.id),
          eq(TherapySession.userId, userId),
        ),
      });

      return { session };
    }),

  startSession: protectedProcedure
    .input(
      z.object({
        sessionType: z.string(),
        metadata: z.record(z.unknown()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.userId;

      const [session] = await ctx.db
        .insert(TherapySession)
        .values({
          userId,
          sessionType: input.sessionType,
          status: "active",
          metadata: input.metadata,
        })
        .returning();

      return { session };
    }),

  endSession: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.userId;

      // Calculate duration and stats
      const session = await ctx.db.query.TherapySession.findFirst({
        where: and(
          eq(TherapySession.id, input.id),
          eq(TherapySession.userId, userId),
        ),
      });

      if (!session) {
        throw new Error("Session not found");
      }

      const endedAt = new Date();
      const durationSeconds = Math.floor(
        (endedAt.getTime() - session.startedAt.getTime()) / 1000,
      );

      // Get average score from attempts
      const attempts = await ctx.db.query.ExerciseAttempt.findMany({
        where: eq(ExerciseAttempt.sessionId, input.id),
      });

      const scores = attempts
        .map((a) => a.overallScore)
        .filter((s): s is number => s !== null);
      const averageScore =
        scores.length > 0
          ? scores.reduce((a, b) => a + b, 0) / scores.length
          : null;

      const [updated] = await ctx.db
        .update(TherapySession)
        .set({
          status: "completed",
          endedAt,
          durationSeconds,
          exerciseCount: attempts.length,
          averageScore,
          notes: input.notes,
        })
        .where(eq(TherapySession.id, input.id))
        .returning();

      return { session: updated };
    }),

  // ============================================================================
  // Exercise Attempts
  // ============================================================================

  recordAttempt: protectedProcedure
    .input(
      z.object({
        sessionId: z.string().optional(),
        exerciseType: z.string(),
        targetText: z.string(),
        difficulty: z.number().min(1).max(5).optional(),
        transcription: z.string().optional(),
        overallScore: z.number().min(0).max(100).optional(),
        clarityScore: z.number().min(0).max(100).optional(),
        paceScore: z.number().min(0).max(100).optional(),
        fluencyScore: z.number().min(0).max(100).optional(),
        wordScores: z.array(z.record(z.unknown())).optional(),
        phonemeErrors: z.array(z.record(z.unknown())).optional(),
        suggestions: z.array(z.string()).optional(),
        audioUrl: z.string().optional(),
        // AI Feedback from GPT-4o
        aiFeedback: z.object({
          feedback: z.string(),
          encouragement: z.string(),
          specificTips: z.array(z.string()),
          recommendedExercises: z.array(z.string()),
          difficultyAdjustment: z.enum(["easier", "same", "harder"]).optional(),
        }).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.userId;

      const [attempt] = await ctx.db
        .insert(ExerciseAttempt)
        .values({
          userId,
          sessionId: input.sessionId,
          exerciseType: input.exerciseType,
          targetText: input.targetText,
          difficulty: input.difficulty,
          transcription: input.transcription,
          overallScore: input.overallScore,
          clarityScore: input.clarityScore,
          paceScore: input.paceScore,
          fluencyScore: input.fluencyScore,
          wordScores: input.wordScores as typeof ExerciseAttempt.$inferInsert.wordScores,
          phonemeErrors: input.phonemeErrors as typeof ExerciseAttempt.$inferInsert.phonemeErrors,
          suggestions: input.suggestions,
          audioUrl: input.audioUrl,
          aiFeedback: input.aiFeedback as typeof ExerciseAttempt.$inferInsert.aiFeedback,
        })
        .returning();

      // Also record progress metric
      if (input.overallScore !== undefined) {
        await ctx.db.insert(ProgressMetric).values({
          userId,
          metricType: "overall",
          value: input.overallScore,
          exerciseType: input.exerciseType,
        });
      }

      return { attempt };
    }),

  getAttempts: protectedProcedure
    .input(
      z.object({
        sessionId: z.string().optional(),
        exerciseType: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.userId;

      let whereClause = eq(ExerciseAttempt.userId, userId);

      if (input.sessionId) {
        whereClause = and(
          whereClause,
          eq(ExerciseAttempt.sessionId, input.sessionId),
        )!;
      }

      if (input.exerciseType) {
        whereClause = and(
          whereClause,
          eq(ExerciseAttempt.exerciseType, input.exerciseType),
        )!;
      }

      const attempts = await ctx.db.query.ExerciseAttempt.findMany({
        where: whereClause,
        orderBy: desc(ExerciseAttempt.createdAt),
        limit: input.limit,
      });

      return { attempts };
    }),

  // ============================================================================
  // Progress & Analytics
  // ============================================================================

  getProgressSummary: protectedProcedure
    .input(
      z.object({
        days: z.number().min(1).max(365).default(30),
      }),
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.userId;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - input.days);

      // Get sessions
      const sessions = await ctx.db.query.TherapySession.findMany({
        where: eq(TherapySession.userId, userId),
      });

      // Get attempts
      const attempts = await ctx.db.query.ExerciseAttempt.findMany({
        where: eq(ExerciseAttempt.userId, userId),
      });

      // Calculate stats
      const completedSessions = sessions.filter(
        (s) => s.status === "completed",
      );
      const totalMinutes = completedSessions.reduce(
        (sum, s) => sum + (s.durationSeconds ?? 0) / 60,
        0,
      );

      const scores = attempts
        .map((a) => a.overallScore)
        .filter((s): s is number => s !== null);
      const averageScore =
        scores.length > 0
          ? scores.reduce((a, b) => a + b, 0) / scores.length
          : 0;

      // Calculate streak (simplified)
      const sessionDates = completedSessions
        .map((s) => s.startedAt.toDateString())
        .filter((v, i, a) => a.indexOf(v) === i);
      const streak = sessionDates.length; // Simplified

      return {
        totalSessions: completedSessions.length,
        totalExercises: attempts.length,
        totalPracticeMinutes: Math.round(totalMinutes),
        currentStreakDays: Math.min(streak, 7), // Cap at 7 for demo
        averageScore: Math.round(averageScore * 10) / 10,
        improvementPercent: 15.3, // Placeholder - implement proper calculation
      };
    }),

  getProgressTrends: protectedProcedure
    .input(
      z.object({
        metric: z.enum(["overall", "clarity", "pace", "fluency"]).default("overall"),
        days: z.number().min(7).max(365).default(30),
      }),
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.userId;

      const metrics = await ctx.db.query.ProgressMetric.findMany({
        where: and(
          eq(ProgressMetric.userId, userId),
          eq(ProgressMetric.metricType, input.metric),
        ),
        orderBy: desc(ProgressMetric.measuredAt),
        limit: input.days,
      });

      return {
        trends: metrics.map((m) => ({
          date: m.measuredAt.toISOString().split("T")[0],
          value: m.value,
          metricType: m.metricType,
        })),
      };
    }),
} satisfies TRPCRouterRecord;
