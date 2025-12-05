import { Text, View, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { Card } from "~/components/ui/card";
import { ChevronRight } from "~/lib/icons/chevron-right";

const EXERCISES = [
  {
    id: "repeat_after_me",
    name: "Repeat After Me",
    description: "Listen and repeat target phrases",
    difficulty: "Easy",
    icon: "🎤",
  },
  {
    id: "minimal_pairs",
    name: "Minimal Pairs",
    description: "Practice similar-sounding words",
    difficulty: "Medium",
    icon: "🔤",
  },
  {
    id: "tongue_twisters",
    name: "Tongue Twisters",
    description: "Challenge your fluency",
    difficulty: "Hard",
    icon: "👅",
  },
  {
    id: "word_chains",
    name: "Word Chains",
    description: "Build vocabulary with connected words",
    difficulty: "Easy",
    icon: "🔗",
  },
  {
    id: "sentence_building",
    name: "Sentence Building",
    description: "Progress from words to sentences",
    difficulty: "Medium",
    icon: "📝",
  },
];

function getDifficultyColor(difficulty: string) {
  switch (difficulty) {
    case "Easy":
      return "text-green-600 dark:text-green-400";
    case "Medium":
      return "text-yellow-600 dark:text-yellow-400";
    case "Hard":
      return "text-red-600 dark:text-red-400";
    default:
      return "text-muted-foreground";
  }
}

export default function ExercisesScreen() {
  const router = useRouter();

  return (
    <SafeAreaView edges={["bottom"]} style={{ flex: 1 }}>
      <ScrollView className="flex-1 bg-secondary/30">
        <View className="p-4">
          <Text className="mb-2 text-sm text-muted-foreground">
            Choose an exercise type to practice
          </Text>

          {EXERCISES.map((exercise) => (
            <TouchableOpacity
              key={exercise.id}
              activeOpacity={0.5}
              onPress={() => router.push(`/therapy/exercise/${exercise.id}`)}
            >
              <Card className="mb-3 flex-row items-center justify-between bg-secondary p-4">
                <View className="flex-row items-center gap-3">
                  <View className="h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <Text className="text-2xl">{exercise.icon}</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-base font-medium text-foreground">
                      {exercise.name}
                    </Text>
                    <Text className="text-sm text-muted-foreground">
                      {exercise.description}
                    </Text>
                    <Text
                      className={`text-xs ${getDifficultyColor(exercise.difficulty)}`}
                    >
                      {exercise.difficulty}
                    </Text>
                  </View>
                </View>
                <ChevronRight size={20} className="text-foreground" />
              </Card>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
