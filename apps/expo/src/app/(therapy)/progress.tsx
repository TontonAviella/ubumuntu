import { Text, View, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Card } from "~/components/ui/card";
import { Progress } from "~/components/ui/progress";
import { Loader2 } from "~/lib/icons/loader-2";
import { api } from "~/utils/api";

function getScoreColor(score: number) {
  if (score >= 80) return "text-green-600 dark:text-green-400";
  if (score >= 60) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

function getImprovementColor(improvement: number) {
  if (improvement > 0) return "text-green-600 dark:text-green-400";
  if (improvement < 0) return "text-red-600 dark:text-red-400";
  return "text-muted-foreground";
}

export default function ProgressScreen() {
  const { data: summaryData, isPending: summaryPending } = api.therapy.getProgressSummary.useQuery({
    days: 30,
  });

  const { data: trendsData, isPending: trendsPending } = api.therapy.getProgressTrends.useQuery({
    metric: "overall",
    days: 7,
  });

  const { data: sessionsData, isPending: sessionsPending } = api.therapy.getSessions.useQuery({
    limit: 3,
  });

  const isPending = summaryPending || trendsPending || sessionsPending;

  // Generate weekly scores from trends data
  const weeklyScores = trendsData?.trends
    ? trendsData.trends.slice(0, 7).map((t) => t.value).reverse()
    : [0, 0, 0, 0, 0, 0, 0];

  // Placeholder phoneme progress - would come from detailed analytics
  const phonemeProgress = [
    { phoneme: "S", score: 85, improvement: 12 },
    { phoneme: "TH", score: 62, improvement: 5 },
    { phoneme: "R", score: 70, improvement: 8 },
    { phoneme: "L", score: 75, improvement: 10 },
    { phoneme: "CH", score: 80, improvement: 15 },
  ];

  if (isPending) {
    return (
      <SafeAreaView edges={["bottom"]} style={{ flex: 1 }}>
        <View className="flex-1 items-center justify-center bg-secondary/30">
          <Loader2 size={48} strokeWidth={3} className="animate-spin text-foreground" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["bottom"]} style={{ flex: 1 }}>
      <ScrollView className="flex-1 bg-secondary/30">
        <View className="p-4">
          {/* Stats Overview */}
          <View className="mb-6 flex-row flex-wrap gap-3">
            <Card className="min-w-[30%] flex-1 bg-secondary p-4">
              <Text className="text-sm text-muted-foreground">Streak</Text>
              <Text className="text-2xl font-bold text-foreground">
                {summaryData?.currentStreakDays ?? 0} days
              </Text>
            </Card>
            <Card className="min-w-[30%] flex-1 bg-secondary p-4">
              <Text className="text-sm text-muted-foreground">Sessions</Text>
              <Text className="text-2xl font-bold text-foreground">
                {summaryData?.totalSessions ?? 0}
              </Text>
            </Card>
            <Card className="min-w-[30%] flex-1 bg-secondary p-4">
              <Text className="text-sm text-muted-foreground">Minutes</Text>
              <Text className="text-2xl font-bold text-foreground">
                {summaryData?.totalPracticeMinutes ?? 0}
              </Text>
            </Card>
          </View>

          {/* Overall Score */}
          <Card className="mb-6 bg-secondary p-4">
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-sm text-muted-foreground">
                  Average Score
                </Text>
                <Text
                  className={`text-3xl font-bold ${getScoreColor(summaryData?.averageScore ?? 0)}`}
                >
                  {summaryData?.averageScore ?? 0}%
                </Text>
              </View>
              <View className="items-end">
                <Text className="text-sm text-muted-foreground">
                  Improvement
                </Text>
                <Text
                  className={`text-xl font-semibold ${getImprovementColor(summaryData?.improvementPercent ?? 0)}`}
                >
                  {(summaryData?.improvementPercent ?? 0) > 0 ? "+" : ""}
                  {summaryData?.improvementPercent ?? 0}%
                </Text>
              </View>
            </View>
          </Card>

          {/* Weekly Chart (Simple bar representation) */}
          <Text className="mb-3 text-lg font-semibold text-foreground">
            This Week
          </Text>
          <Card className="mb-6 bg-secondary p-4">
            <View className="flex-row items-end justify-between gap-2">
              {weeklyScores.map((score, index) => (
                <View key={index} className="flex-1 items-center">
                  <View
                    className="w-full rounded-t bg-primary"
                    style={{ height: Math.max(score * 0.8, 4) }}
                  />
                  <Text className="mt-1 text-xs text-muted-foreground">
                    {["M", "T", "W", "T", "F", "S", "S"][index]}
                  </Text>
                </View>
              ))}
            </View>
          </Card>

          {/* Phoneme Progress */}
          <Text className="mb-3 text-lg font-semibold text-foreground">
            Sound Progress
          </Text>
          <Card className="mb-6 bg-secondary p-4">
            {phonemeProgress.map((item, index) => (
              <View key={index} className="mb-4 last:mb-0">
                <View className="mb-1 flex-row items-center justify-between">
                  <Text className="font-medium text-foreground">
                    "{item.phoneme}" sound
                  </Text>
                  <View className="flex-row items-center gap-2">
                    <Text className={getScoreColor(item.score)}>
                      {item.score}%
                    </Text>
                    <Text
                      className={`text-xs ${getImprovementColor(item.improvement)}`}
                    >
                      {item.improvement > 0 ? "+" : ""}
                      {item.improvement}%
                    </Text>
                  </View>
                </View>
                <Progress value={item.score} className="h-2" />
              </View>
            ))}
          </Card>

          {/* Recent Sessions */}
          <Text className="mb-3 text-lg font-semibold text-foreground">
            Recent Sessions
          </Text>
          <Card className="mb-6 bg-secondary p-4">
            {sessionsData?.sessions && sessionsData.sessions.length > 0 ? (
              sessionsData.sessions.map((session, index) => (
                <View
                  key={session.id}
                  className="flex-row items-center justify-between border-b border-border py-3 last:border-0"
                >
                  <View>
                    <Text className="font-medium text-foreground">
                      {formatSessionDate(session.startedAt)}
                    </Text>
                    <Text className="text-sm text-muted-foreground">
                      {session.exerciseCount ?? 0} exercises
                    </Text>
                  </View>
                  <Text className={`text-lg font-semibold ${getScoreColor(session.averageScore ?? 0)}`}>
                    {Math.round(session.averageScore ?? 0)}%
                  </Text>
                </View>
              ))
            ) : (
              <Text className="py-4 text-center text-muted-foreground">
                No sessions yet. Start practicing!
              </Text>
            )}
          </Card>

          {/* Tips */}
          <Card className="mb-6 bg-primary/10 p-4">
            <Text className="mb-2 font-semibold text-foreground">
              Recommendation
            </Text>
            <Text className="text-sm text-muted-foreground">
              Focus on the "TH" sound this week. Try practicing words like
              "think", "three", and "through" for 5 minutes daily.
            </Text>
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function formatSessionDate(date: Date): string {
  const now = new Date();
  const sessionDate = new Date(date);
  const diffDays = Math.floor((now.getTime() - sessionDate.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return sessionDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
