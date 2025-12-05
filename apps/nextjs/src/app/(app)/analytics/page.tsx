"use client";

import { useState, useEffect } from "react";
import { BarChart3, TrendingUp, Clock, CheckCircle, Target } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@shc/ui/card";
import { getAnalyticsData, type AnalyticsData } from "~/lib/exercise-storage";

// Helper to get score color
const getScoreColor = (score: number) => {
  if (score >= 80) return "bg-green-600";
  if (score >= 60) return "bg-yellow-600";
  if (score >= 40) return "bg-orange-600";
  return "bg-red-600";
};

const getScoreTextColor = (score: number) => {
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-yellow-600";
  if (score >= 40) return "text-orange-600";
  return "text-red-600";
};

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get real analytics from localStorage
    const data = getAnalyticsData();
    setAnalytics(data);
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const hasData = analytics && analytics.totalAttempts > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Analytics</h1>
        <p className="text-muted-foreground">
          Detailed insights into your speech therapy progress
        </p>
      </div>

      {/* No Data State */}
      {!hasData && (
        <Card className="bg-muted/50">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BarChart3 className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No analytics data yet</h3>
            <p className="text-muted-foreground text-center max-w-md mt-2">
              Complete some exercises to see your detailed analytics. Your clarity, pace,
              fluency scores, and practice history will appear here.
            </p>
          </CardContent>
        </Card>
      )}

      {hasData && analytics && (
        <>
          {/* Performance Metrics - Real Data */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Clarity Score</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${getScoreTextColor(analytics.clarityScore)}`}>
                  {analytics.clarityScore}%
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-2">
                  <div
                    className={`h-2 rounded-full transition-all ${getScoreColor(analytics.clarityScore)}`}
                    style={{ width: `${analytics.clarityScore}%` }}
                  ></div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Word accuracy</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Pace Control</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${getScoreTextColor(analytics.paceScore)}`}>
                  {analytics.paceScore}%
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-2">
                  <div
                    className={`h-2 rounded-full transition-all ${getScoreColor(analytics.paceScore)}`}
                    style={{ width: `${analytics.paceScore}%` }}
                  ></div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Speech completeness</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Fluency</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${getScoreTextColor(analytics.fluencyScore)}`}>
                  {analytics.fluencyScore}%
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-2">
                  <div
                    className={`h-2 rounded-full transition-all ${getScoreColor(analytics.fluencyScore)}`}
                    style={{ width: `${analytics.fluencyScore}%` }}
                  ></div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Smooth delivery</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${getScoreTextColor(analytics.completionRate)}`}>
                  {analytics.completionRate}%
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-2">
                  <div
                    className={`h-2 rounded-full transition-all ${getScoreColor(analytics.completionRate)}`}
                    style={{ width: `${analytics.completionRate}%` }}
                  ></div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {analytics.totalAttempts} total exercises
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Stats - Real Data */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Strengths</CardTitle>
                <CardDescription>Areas where you excel</CardDescription>
              </CardHeader>
              <CardContent>
                {analytics.strengths.length > 0 ? (
                  <ul className="space-y-3">
                    {analytics.strengths.map((strength, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
                        <span>{strength}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground">
                    Keep practicing to identify your strengths
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Areas to Improve</CardTitle>
                <CardDescription>Focus on these for better results</CardDescription>
              </CardHeader>
              <CardContent>
                {analytics.areasToImprove.length > 0 ? (
                  <ul className="space-y-3">
                    {analytics.areasToImprove.map((area, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <div className="h-5 w-5 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center shrink-0">
                          <span className="text-yellow-600 dark:text-yellow-400 text-xs font-bold">!</span>
                        </div>
                        <span>{area}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground">
                    Great job! No major areas for improvement identified yet
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity - Real Data */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Your latest practice sessions</CardDescription>
            </CardHeader>
            <CardContent>
              {analytics.recentActivity.length > 0 ? (
                <div className="space-y-4">
                  {analytics.recentActivity.map((session, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div>
                        <p className="font-medium">{session.date}</p>
                        <p className="text-sm text-muted-foreground">
                          {session.exerciseCount} {session.exerciseCount === 1 ? "exercise" : "exercises"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`font-medium ${getScoreTextColor(session.score)}`}>
                          {session.score}%
                        </p>
                        <p className="text-sm text-muted-foreground">{session.duration}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8">
                  <Target className="w-8 h-8 text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">No recent activity</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Summary Stats */}
          <Card className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20">
            <CardContent className="py-6">
              <div className="flex items-center justify-around text-center">
                <div>
                  <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                    {analytics.totalAttempts}
                  </p>
                  <p className="text-sm text-muted-foreground">Total Exercises</p>
                </div>
                <div className="h-12 w-px bg-gray-200 dark:bg-gray-700" />
                <div>
                  <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                    {Math.round((analytics.clarityScore + analytics.paceScore + analytics.fluencyScore) / 3)}%
                  </p>
                  <p className="text-sm text-muted-foreground">Overall Average</p>
                </div>
                <div className="h-12 w-px bg-gray-200 dark:bg-gray-700" />
                <div>
                  <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                    {analytics.completionRate}%
                  </p>
                  <p className="text-sm text-muted-foreground">Success Rate</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
