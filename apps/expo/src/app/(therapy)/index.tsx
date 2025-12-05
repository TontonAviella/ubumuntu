import { Text, View, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link } from "expo-router";

import { Card } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Loader2 } from "~/lib/icons/loader-2";
import { Mic } from "~/lib/icons/mic";
import { ChevronRight } from "~/lib/icons/chevron-right";
import { api } from "~/utils/api";

export default function TherapyHome() {
  const { data: progressData, isPending } = api.therapy.getProgressSummary.useQuery({
    days: 30,
  });

  return (
    <SafeAreaView edges={["bottom"]} style={{ flex: 1 }}>
      <View className="flex-1 bg-secondary/30 p-4">
        {/* Quick Stats */}
        <View className="mb-6 flex-row gap-3">
          <Card className="flex-1 bg-secondary p-4">
            <Text className="text-sm text-muted-foreground">Streak</Text>
            {isPending ? (
              <Loader2 size={20} className="animate-spin text-foreground" />
            ) : (
              <Text className="text-2xl font-bold text-foreground">
                {progressData?.currentStreakDays ?? 0} days
              </Text>
            )}
          </Card>
          <Card className="flex-1 bg-secondary p-4">
            <Text className="text-sm text-muted-foreground">Avg Score</Text>
            {isPending ? (
              <Loader2 size={20} className="animate-spin text-foreground" />
            ) : (
              <Text className="text-2xl font-bold text-foreground">
                {progressData?.averageScore ?? 0}%
              </Text>
            )}
          </Card>
          <Card className="flex-1 bg-secondary p-4">
            <Text className="text-sm text-muted-foreground">Sessions</Text>
            {isPending ? (
              <Loader2 size={20} className="animate-spin text-foreground" />
            ) : (
              <Text className="text-2xl font-bold text-foreground">
                {progressData?.totalSessions ?? 0}
              </Text>
            )}
          </Card>
        </View>

        {/* Quick Practice */}
        <Text className="mb-3 text-lg font-semibold text-foreground">
          Quick Practice
        </Text>
        <Link href="/therapy/exercises" asChild>
          <TouchableOpacity activeOpacity={0.7}>
            <Card className="mb-4 flex-row items-center justify-between bg-primary p-5">
              <View className="flex-row items-center gap-3">
                <View className="rounded-full bg-primary-foreground/20 p-3">
                  <Mic size={24} className="text-primary-foreground" />
                </View>
                <View>
                  <Text className="text-lg font-medium text-primary-foreground">
                    Start Exercise
                  </Text>
                  <Text className="text-sm text-primary-foreground/70">
                    Continue where you left off
                  </Text>
                </View>
              </View>
              <ChevronRight size={24} className="text-primary-foreground" />
            </Card>
          </TouchableOpacity>
        </Link>

        {/* Menu Items */}
        <Text className="mb-3 text-lg font-semibold text-foreground">
          Practice
        </Text>

        <Link href="/therapy/exercises" asChild>
          <TouchableOpacity activeOpacity={0.5}>
            <Card className="mb-3 flex-row items-center justify-between bg-secondary p-4">
              <View>
                <Text className="text-base font-medium text-foreground">
                  Exercises
                </Text>
                <Text className="text-sm text-muted-foreground">
                  Repeat after me, minimal pairs, more
                </Text>
              </View>
              <ChevronRight size={20} className="text-foreground" />
            </Card>
          </TouchableOpacity>
        </Link>

        <Link href="/therapy/progress" asChild>
          <TouchableOpacity activeOpacity={0.5}>
            <Card className="mb-3 flex-row items-center justify-between bg-secondary p-4">
              <View>
                <Text className="text-base font-medium text-foreground">
                  My Progress
                </Text>
                <Text className="text-sm text-muted-foreground">
                  View your improvement over time
                </Text>
              </View>
              <ChevronRight size={20} className="text-foreground" />
            </Card>
          </TouchableOpacity>
        </Link>

        {/* Bottom nav to go back to main app */}
        <View className="absolute bottom-4 left-4 right-4">
          <Link href="/(app)/dashboard" asChild>
            <Button variant="outline" className="w-full">
              <Text className="text-foreground">Back to Notes</Text>
            </Button>
          </Link>
        </View>
      </View>
    </SafeAreaView>
  );
}
