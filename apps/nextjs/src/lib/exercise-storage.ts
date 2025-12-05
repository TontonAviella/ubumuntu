/**
 * Exercise Storage - Real data persistence using localStorage
 *
 * Stores actual exercise attempts for Progress and Analytics pages.
 * Data persists in browser until cleared.
 */

export interface WordAnalysis {
  target: string;
  spoken: string;
  match: boolean;
}

export interface AIFeedback {
  feedback: string;
  encouragement: string;
  specific_tips: string[];
  recommended_exercises: string[];
  difficulty_adjustment: string;
}

export interface ExerciseAttempt {
  id: string;
  exerciseId: string;
  exerciseTitle: string;
  exerciseCategory: string;
  targetText: string;
  transcription: string;
  scores: {
    overall: number;
    clarity: number;
    pace: number;
    fluency: number;
  };
  wordAnalysis: WordAnalysis[];
  aiFeedback: AIFeedback;
  timestamp: string; // ISO date string
  durationSeconds: number;
}

export interface DailyStats {
  date: string;
  exerciseCount: number;
  totalDuration: number;
  averageScore: number;
  bestScore: number;
}

export interface WeeklyStats {
  sessionsThisWeek: number;
  totalPracticeMinutes: number;
  averageScore: number;
  scoreChange: number; // vs last week
  currentStreak: number;
  strengths: string[];
  weaknesses: string[];
}

export interface AnalyticsData {
  clarityScore: number;
  paceScore: number;
  fluencyScore: number;
  completionRate: number;
  totalAttempts: number;
  recentActivity: {
    date: string;
    exerciseCount: number;
    score: number;
    duration: string;
  }[];
  strengths: string[];
  areasToImprove: string[];
}

const STORAGE_KEY = 'ubumuntu_exercise_attempts';

// Generate unique ID
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Get all attempts from storage
export function getAllAttempts(): ExerciseAttempt[] {
  if (typeof window === 'undefined') return [];

  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

// Save a new attempt
export function saveAttempt(attempt: Omit<ExerciseAttempt, 'id' | 'timestamp'>): ExerciseAttempt {
  const attempts = getAllAttempts();

  const newAttempt: ExerciseAttempt = {
    ...attempt,
    id: generateId(),
    timestamp: new Date().toISOString(),
  };

  attempts.push(newAttempt);

  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(attempts));
  }

  return newAttempt;
}

// Clear all attempts (for testing)
export function clearAllAttempts(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY);
  }
}

// Get attempts for a specific date range
export function getAttemptsByDateRange(startDate: Date, endDate: Date): ExerciseAttempt[] {
  const attempts = getAllAttempts();
  return attempts.filter(a => {
    const date = new Date(a.timestamp);
    return date >= startDate && date <= endDate;
  });
}

// Get attempts for today
export function getTodayAttempts(): ExerciseAttempt[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return getAttemptsByDateRange(today, tomorrow);
}

// Get attempts for this week
export function getThisWeekAttempts(): ExerciseAttempt[] {
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay()); // Start from Sunday
  startOfWeek.setHours(0, 0, 0, 0);
  return getAttemptsByDateRange(startOfWeek, new Date());
}

// Get attempts for last week
export function getLastWeekAttempts(): ExerciseAttempt[] {
  const today = new Date();
  const startOfThisWeek = new Date(today);
  startOfThisWeek.setDate(today.getDate() - today.getDay());
  startOfThisWeek.setHours(0, 0, 0, 0);

  const startOfLastWeek = new Date(startOfThisWeek);
  startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);

  return getAttemptsByDateRange(startOfLastWeek, startOfThisWeek);
}

// Calculate current streak (consecutive days with practice)
export function calculateStreak(): number {
  const attempts = getAllAttempts();
  if (attempts.length === 0) return 0;

  // Get unique practice dates
  const dates = new Set<string>();
  attempts.forEach(a => {
    const date = new Date(a.timestamp).toDateString();
    dates.add(date);
  });

  const sortedDates = Array.from(dates)
    .map(d => new Date(d))
    .sort((a, b) => b.getTime() - a.getTime());

  if (sortedDates.length === 0) return 0;

  // Check if practiced today or yesterday
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const mostRecent = sortedDates[0];
  mostRecent.setHours(0, 0, 0, 0);

  if (mostRecent < yesterday) {
    return 0; // Streak broken
  }

  // Count consecutive days
  let streak = 1;
  for (let i = 1; i < sortedDates.length; i++) {
    const current = sortedDates[i - 1];
    const prev = sortedDates[i];

    const diffDays = Math.floor((current.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

// Get weekly statistics for Progress page
export function getWeeklyStats(): WeeklyStats {
  const thisWeekAttempts = getThisWeekAttempts();
  const lastWeekAttempts = getLastWeekAttempts();

  // Calculate this week's stats
  const sessionsThisWeek = thisWeekAttempts.length;
  const totalPracticeMinutes = Math.round(
    thisWeekAttempts.reduce((sum, a) => sum + a.durationSeconds, 0) / 60
  );

  const thisWeekAvg = thisWeekAttempts.length > 0
    ? thisWeekAttempts.reduce((sum, a) => sum + a.scores.overall, 0) / thisWeekAttempts.length
    : 0;

  const lastWeekAvg = lastWeekAttempts.length > 0
    ? lastWeekAttempts.reduce((sum, a) => sum + a.scores.overall, 0) / lastWeekAttempts.length
    : 0;

  const scoreChange = lastWeekAvg > 0
    ? ((thisWeekAvg - lastWeekAvg) / lastWeekAvg) * 100
    : 0;

  // Analyze strengths and weaknesses from word analysis
  const { strengths, weaknesses } = analyzePerformance(thisWeekAttempts);

  return {
    sessionsThisWeek,
    totalPracticeMinutes,
    averageScore: Math.round(thisWeekAvg),
    scoreChange: Math.round(scoreChange * 10) / 10,
    currentStreak: calculateStreak(),
    strengths,
    weaknesses,
  };
}

// Get analytics data for Analytics page
export function getAnalyticsData(): AnalyticsData {
  const allAttempts = getAllAttempts();

  if (allAttempts.length === 0) {
    return {
      clarityScore: 0,
      paceScore: 0,
      fluencyScore: 0,
      completionRate: 0,
      totalAttempts: 0,
      recentActivity: [],
      strengths: [],
      areasToImprove: [],
    };
  }

  // Calculate average scores
  const clarityScore = Math.round(
    allAttempts.reduce((sum, a) => sum + a.scores.clarity, 0) / allAttempts.length
  );
  const paceScore = Math.round(
    allAttempts.reduce((sum, a) => sum + a.scores.pace, 0) / allAttempts.length
  );
  const fluencyScore = Math.round(
    allAttempts.reduce((sum, a) => sum + a.scores.fluency, 0) / allAttempts.length
  );

  // Completion rate: exercises with score >= 70%
  const completedCount = allAttempts.filter(a => a.scores.overall >= 70).length;
  const completionRate = Math.round((completedCount / allAttempts.length) * 100);

  // Recent activity by day
  const activityByDate = new Map<string, { count: number; scores: number[]; duration: number }>();

  allAttempts.forEach(a => {
    const date = new Date(a.timestamp).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric'
    });
    const existing = activityByDate.get(date) || { count: 0, scores: [], duration: 0 };
    existing.count++;
    existing.scores.push(a.scores.overall);
    existing.duration += a.durationSeconds;
    activityByDate.set(date, existing);
  });

  const recentActivity = Array.from(activityByDate.entries())
    .slice(-7) // Last 7 days with activity
    .reverse()
    .map(([date, data]) => ({
      date,
      exerciseCount: data.count,
      score: Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length),
      duration: `${Math.round(data.duration / 60)} min`,
    }));

  // Analyze strengths and areas to improve
  const { strengths, weaknesses } = analyzePerformance(allAttempts);

  return {
    clarityScore,
    paceScore,
    fluencyScore,
    completionRate,
    totalAttempts: allAttempts.length,
    recentActivity,
    strengths,
    areasToImprove: weaknesses,
  };
}

// Analyze performance to find strengths and weaknesses
function analyzePerformance(attempts: ExerciseAttempt[]): {
  strengths: string[];
  weaknesses: string[];
} {
  if (attempts.length === 0) {
    return { strengths: [], weaknesses: [] };
  }

  const strengths: string[] = [];
  const weaknesses: string[] = [];

  // Analyze scores
  const avgClarity = attempts.reduce((sum, a) => sum + a.scores.clarity, 0) / attempts.length;
  const avgPace = attempts.reduce((sum, a) => sum + a.scores.pace, 0) / attempts.length;
  const avgFluency = attempts.reduce((sum, a) => sum + a.scores.fluency, 0) / attempts.length;

  if (avgClarity >= 75) strengths.push("Strong word accuracy");
  else if (avgClarity < 60) weaknesses.push("Word accuracy needs work");

  if (avgPace >= 75) strengths.push("Good speaking pace");
  else if (avgPace < 60) weaknesses.push("Speaking pace - try slowing down");

  if (avgFluency >= 75) strengths.push("Smooth fluency");
  else if (avgFluency < 60) weaknesses.push("Fluency - practice complete phrases");

  // Analyze word patterns from word analysis
  const missedWords = new Map<string, number>();

  attempts.forEach(a => {
    a.wordAnalysis.forEach(w => {
      if (!w.match) {
        const count = missedWords.get(w.target.toLowerCase()) || 0;
        missedWords.set(w.target.toLowerCase(), count + 1);
      }
    });
  });

  // Find commonly missed words
  const sortedMissed = Array.from(missedWords.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  sortedMissed.forEach(([word, count]) => {
    if (count >= 2) {
      weaknesses.push(`Practice the word "${word}"`);
    }
  });

  // Check for consistent practice
  const streak = calculateStreak();
  if (streak >= 3) strengths.push("Consistent daily practice");

  // Ensure we have at least some feedback
  if (strengths.length === 0) {
    strengths.push("Getting started with practice");
  }
  if (weaknesses.length === 0 && attempts.length > 0) {
    weaknesses.push("Keep practicing for more insights");
  }

  return {
    strengths: strengths.slice(0, 3),
    weaknesses: weaknesses.slice(0, 3)
  };
}

// Get data formatted for backend AI analysis
export function getDataForAIInsights(): {
  sessions_this_week: number;
  practice_minutes: number;
  avg_score: number;
  score_change: number;
  strengths: string[];
  weaknesses: string[];
} {
  const stats = getWeeklyStats();
  return {
    sessions_this_week: stats.sessionsThisWeek,
    practice_minutes: stats.totalPracticeMinutes,
    avg_score: stats.averageScore,
    score_change: stats.scoreChange,
    strengths: stats.strengths,
    weaknesses: stats.weaknesses,
  };
}
