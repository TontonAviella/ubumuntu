"use client";

import { useState, useEffect } from "react";
import { TrendingUp, TrendingDown, Calendar, Target, Award, Loader2 } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@shc/ui/card";
import { getWeeklyStats, getDataForAIInsights, type WeeklyStats } from "~/lib/exercise-storage";

interface WeeklyInsights {
  summary: string;
  celebration: string;
  focus_area: string;
  goal: string;
}

export default function ProgressPage() {
  const [stats, setStats] = useState<WeeklyStats | null>(null);
  const [insights, setInsights] = useState<WeeklyInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [insightsLoading, setInsightsLoading] = useState(false);

  useEffect(() => {
    // Get real stats from localStorage
    const weeklyStats = getWeeklyStats();
    setStats(weeklyStats);
    setLoading(false);

    // Only fetch AI insights if there's actual data
    if (weeklyStats.sessionsThisWeek > 0) {
      fetchAIInsights(weeklyStats);
    }
  }, []);

  const fetchAIInsights = async (weeklyStats: WeeklyStats) => {
    setInsightsLoading(true);
    try {
      // Send real data to the backend for AI analysis
      const realData = getDataForAIInsights();
      const response = await fetch(`${process.env.NEXT_PUBLIC_FASTAPI_URL}/v1/therapy/demo/weekly-insights`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(realData)
      });

      if (response.ok) {
        const data = await response.json();
        setInsights(data.summary ? data : null);
      }
    } catch (error) {
      console.error("Failed to fetch AI insights:", error);
      // Generate fallback insights based on real data
      setInsights({
        summary: weeklyStats.sessionsThisWeek > 0
          ? `You completed ${weeklyStats.sessionsThisWeek} practice sessions this week with an average score of ${weeklyStats.averageScore}%.`
          : "Start practicing to see your weekly summary!",
        celebration: weeklyStats.currentStreak > 0
          ? `Great job maintaining a ${weeklyStats.currentStreak}-day practice streak!`
          : "Complete an exercise to start building your streak!",
        focus_area: weeklyStats.weaknesses.length > 0
          ? weeklyStats.weaknesses[0]
          : "Keep practicing to identify areas for improvement.",
        goal: `Aim for ${Math.max(weeklyStats.sessionsThisWeek + 2, 5)} sessions next week to continue improving!`
      });
    }
    setInsightsLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const hasData = stats && stats.sessionsThisWeek > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Your Progress</h1>
        <p className="text-muted-foreground">
          Track your speech therapy journey
        </p>
      </div>

      {/* Stats Overview - Real Data */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Sessions This Week</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.sessionsThisWeek || 0}</div>
            <p className="text-xs text-muted-foreground">
              {hasData ? "sessions completed" : "No sessions yet"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Average Score</CardTitle>
            {stats && stats.scoreChange >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {hasData ? `${stats?.averageScore}%` : "--"}
            </div>
            {hasData && stats?.scoreChange !== 0 && (
              <p className={`text-xs ${stats!.scoreChange >= 0 ? "text-green-600" : "text-red-600"}`}>
                {stats!.scoreChange >= 0 ? "+" : ""}{stats?.scoreChange}% vs last week
              </p>
            )}
            {!hasData && (
              <p className="text-xs text-muted-foreground">Complete exercises to see</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Practice Time</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {hasData ? `${stats?.totalPracticeMinutes} min` : "--"}
            </div>
            <p className="text-xs text-muted-foreground">
              {hasData ? "This week" : "Start practicing!"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Streak</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.currentStreak || 0} {stats?.currentStreak === 1 ? "day" : "days"}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats && stats.currentStreak > 0 ? "Keep it up!" : "Practice today!"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* No Data State */}
      {!hasData && (
        <Card className="bg-muted/50">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Target className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No practice data yet</h3>
            <p className="text-muted-foreground text-center max-w-md mt-2">
              Complete some exercises to start tracking your progress. Your real scores,
              practice time, and improvements will appear here.
            </p>
          </CardContent>
        </Card>
      )}

      {/* AI Insights - Only show when there's data */}
      {hasData && (
        <>
          {insightsLoading ? (
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                <span className="ml-3 text-muted-foreground">Generating insights...</span>
              </CardContent>
            </Card>
          ) : insights ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Weekly Summary</CardTitle>
                  <CardDescription>AI-powered insights from your practice</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-lg">{insights.summary}</p>
                </CardContent>
              </Card>

              <Card className="bg-green-50 dark:bg-green-900/20">
                <CardHeader>
                  <CardTitle className="text-green-700 dark:text-green-400">Celebration</CardTitle>
                </CardHeader>
                <CardContent>
                  <p>{insights.celebration}</p>
                </CardContent>
              </Card>

              <Card className="bg-blue-50 dark:bg-blue-900/20">
                <CardHeader>
                  <CardTitle className="text-blue-700 dark:text-blue-400">Focus Area</CardTitle>
                </CardHeader>
                <CardContent>
                  <p>{insights.focus_area}</p>
                </CardContent>
              </Card>

              <Card className="md:col-span-2 bg-purple-50 dark:bg-purple-900/20">
                <CardHeader>
                  <CardTitle className="text-purple-700 dark:text-purple-400">Next Week's Goal</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-lg font-medium">{insights.goal}</p>
                </CardContent>
              </Card>
            </div>
          ) : null}

          {/* Strengths and Weaknesses from real data */}
          {stats && (stats.strengths.length > 0 || stats.weaknesses.length > 0) && (
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-green-700 dark:text-green-400">Your Strengths</CardTitle>
                  <CardDescription>Based on your practice sessions</CardDescription>
                </CardHeader>
                <CardContent>
                  {stats.strengths.length > 0 ? (
                    <ul className="space-y-2">
                      {stats.strengths.map((strength, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full" />
                          {strength}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted-foreground">Keep practicing to identify strengths</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-yellow-700 dark:text-yellow-400">Areas to Improve</CardTitle>
                  <CardDescription>Focus on these for better results</CardDescription>
                </CardHeader>
                <CardContent>
                  {stats.weaknesses.length > 0 ? (
                    <ul className="space-y-2">
                      {stats.weaknesses.map((weakness, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-yellow-500 rounded-full" />
                          {weakness}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted-foreground">Great job! No major weaknesses identified</p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
