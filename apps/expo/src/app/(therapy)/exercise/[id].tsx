import { useState, useEffect } from "react";
import { Text, View } from "react-native";
import { useSharedValue } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { Audio } from "expo-av";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";

import WaveformAnimation from "~/components/recording/waveform";
import { Card } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Progress } from "~/components/ui/progress";
import { Loader2 } from "~/lib/icons/loader-2";
import { Mic } from "~/lib/icons/mic";
import { getBaseUrl } from "~/utils/base-url";
import { api } from "~/utils/api";

const EXERCISE_PHRASES: Record<string, string[]> = {
  repeat_after_me: [
    "The quick brown fox",
    "She sells seashells",
    "Peter Piper picked",
    "How much wood would",
    "Red lorry yellow lorry",
  ],
  minimal_pairs: [
    "ship / chip",
    "bat / pat",
    "think / sink",
    "three / free",
    "mouth / mouse",
  ],
  tongue_twisters: [
    "She sells seashells by the seashore",
    "Peter Piper picked a peck of pickled peppers",
    "How much wood would a woodchuck chuck",
    "Red lorry yellow lorry",
    "Unique New York",
  ],
  word_chains: ["cat", "hat", "bat", "mat", "sat"],
  sentence_building: [
    "I",
    "I go",
    "I go to",
    "I go to the",
    "I go to the store",
  ],
};

type AIFeedback = {
  feedback: string;
  encouragement: string;
  specific_tips: string[];
  recommended_exercises: string[];
  difficulty_adjustment: "easier" | "same" | "harder" | null;
};

type FeedbackResult = {
  overall_score: number;
  clarity_score: number;
  pace_score: number;
  fluency_score: number;
  transcription: string;
  suggestions: string[];
  ai_feedback: AIFeedback | null;
};

export default function ExerciseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getToken } = useAuth();
  const router = useRouter();
  const utils = api.useUtils();

  const SERVER_URL = getBaseUrl(8000);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [recording, setRecording] = useState<Audio.Recording>();
  const [permissionResponse, requestPermission] = Audio.usePermissions();
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackResult | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);

  const metering = useSharedValue(-160);

  const phrases = EXERCISE_PHRASES[id ?? "repeat_after_me"] ?? [];
  const currentPhrase = phrases[currentIndex] ?? "";
  const progress = ((currentIndex + 1) / phrases.length) * 100;

  // Mutation to record attempts
  const recordAttemptMutation = api.therapy.recordAttempt.useMutation({
    onSuccess: () => {
      // Invalidate progress queries to refresh data
      utils.therapy.getProgressSummary.invalidate();
      utils.therapy.getProgressTrends.invalidate();
    },
  });

  useEffect(() => {
    return () => {
      if (recording) {
        recording.stopAndUnloadAsync();
      }
    };
  }, [recording]);

  async function startRecording() {
    try {
      if (permissionResponse?.status !== "granted") {
        await requestPermission();
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
        undefined,
        200,
      );
      setRecording(newRecording);
      setShowFeedback(false);
      setFeedback(null);

      newRecording.setOnRecordingStatusUpdate((status) => {
        if (status.metering !== undefined) {
          metering.value = status.metering;
        }
      });
    } catch (err) {
      console.error("Failed to start recording", err);
    }
  }

  async function stopRecording() {
    if (!recording) return;

    metering.value = -160;
    await recording.stopAndUnloadAsync();
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

    const uri = recording.getURI();
    setRecording(undefined);

    if (uri) {
      await analyzeRecording(uri);
    }
  }

  async function analyzeRecording(uri: string) {
    setIsProcessing(true);

    try {
      const authToken = await getToken();
      if (!authToken) throw new Error("No auth token");

      const filename = uri.split("/").pop();
      const formData = new FormData();
      formData.append("file", {
        uri,
        type: "audio/mp4",
        name: filename,
      } as unknown as File);

      const response = await fetch(
        `${SERVER_URL}/v1/therapy/analyze?target_text=${encodeURIComponent(currentPhrase)}&include_ai_feedback=true`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${authToken}`,
            "Content-Type": "multipart/form-data",
          },
          body: formData,
        },
      );

      if (!response.ok) {
        throw new Error(`Analysis failed: ${response.status}`);
      }

      const result = await response.json();
      setFeedback(result);
      setShowFeedback(true);

      // Record the attempt via tRPC with AI feedback
      recordAttemptMutation.mutate({
        exerciseType: id ?? "repeat_after_me",
        targetText: currentPhrase,
        transcription: result.transcription,
        overallScore: result.overall_score,
        clarityScore: result.clarity_score,
        paceScore: result.pace_score,
        fluencyScore: result.fluency_score,
        suggestions: result.suggestions,
        aiFeedback: result.ai_feedback ? {
          feedback: result.ai_feedback.feedback,
          encouragement: result.ai_feedback.encouragement,
          specificTips: result.ai_feedback.specific_tips,
          recommendedExercises: result.ai_feedback.recommended_exercises,
          difficultyAdjustment: result.ai_feedback.difficulty_adjustment,
        } : undefined,
      });
    } catch (error) {
      console.error("Analysis error:", error);
      alert("Failed to analyze recording. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  }

  function nextPhrase() {
    if (currentIndex < phrases.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setShowFeedback(false);
      setFeedback(null);
    } else {
      router.back();
    }
  }

  function getScoreColor(score: number) {
    if (score >= 80) return "text-green-600 dark:text-green-400";
    if (score >= 60) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  }

  return (
    <SafeAreaView edges={["bottom"]} style={{ flex: 1 }}>
      <View className="flex-1 bg-secondary/30 p-4">
        {/* Progress bar */}
        <View className="mb-4">
          <View className="mb-2 flex-row justify-between">
            <Text className="text-sm text-muted-foreground">
              {currentIndex + 1} of {phrases.length}
            </Text>
            <Text className="text-sm text-muted-foreground">
              {Math.round(progress)}%
            </Text>
          </View>
          <Progress value={progress} className="h-2" />
        </View>

        {/* Target phrase */}
        <Card className="mb-6 bg-secondary p-6">
          <Text className="mb-2 text-center text-sm text-muted-foreground">
            Say this phrase:
          </Text>
          <Text className="text-center text-2xl font-semibold text-foreground">
            {currentPhrase}
          </Text>
        </Card>

        {/* Recording area */}
        <View className="flex-1 items-center justify-center">
          {isProcessing ? (
            <View className="items-center">
              <Loader2
                size={48}
                strokeWidth={3}
                className="animate-spin text-foreground"
              />
              <Text className="mt-4 text-muted-foreground">Analyzing...</Text>
            </View>
          ) : recording ? (
            <View className="items-center">
              <WaveformAnimation metering={metering} />
              <Text className="mt-4 text-muted-foreground">Recording...</Text>
            </View>
          ) : showFeedback && feedback ? (
            <Card className="w-full bg-secondary p-4">
              {/* AI Encouragement */}
              {feedback.ai_feedback && (
                <Text className="mb-3 text-center text-base font-medium text-primary">
                  {feedback.ai_feedback.encouragement}
                </Text>
              )}

              {/* Scores */}
              <View className="mb-4 flex-row justify-around">
                <View className="items-center">
                  <Text
                    className={`text-3xl font-bold ${getScoreColor(feedback.overall_score)}`}
                  >
                    {Math.round(feedback.overall_score)}%
                  </Text>
                  <Text className="text-xs text-muted-foreground">Overall</Text>
                </View>
                <View className="items-center">
                  <Text
                    className={`text-3xl font-bold ${getScoreColor(feedback.clarity_score)}`}
                  >
                    {Math.round(feedback.clarity_score)}%
                  </Text>
                  <Text className="text-xs text-muted-foreground">Clarity</Text>
                </View>
                <View className="items-center">
                  <Text
                    className={`text-3xl font-bold ${getScoreColor(feedback.pace_score)}`}
                  >
                    {Math.round(feedback.pace_score)}%
                  </Text>
                  <Text className="text-xs text-muted-foreground">Pace</Text>
                </View>
              </View>

              <Text className="mb-2 text-sm text-muted-foreground">
                You said: "{feedback.transcription}"
              </Text>

              {/* AI Feedback */}
              {feedback.ai_feedback && (
                <View className="mt-3 rounded-lg bg-primary/10 p-3">
                  <Text className="mb-2 text-sm text-foreground">
                    {feedback.ai_feedback.feedback}
                  </Text>

                  {feedback.ai_feedback.specific_tips.length > 0 && (
                    <View className="mt-2">
                      <Text className="mb-1 text-xs font-semibold text-muted-foreground">
                        Tips:
                      </Text>
                      {feedback.ai_feedback.specific_tips.slice(0, 2).map((tip, i) => (
                        <Text key={i} className="text-xs text-muted-foreground">
                          • {tip}
                        </Text>
                      ))}
                    </View>
                  )}
                </View>
              )}

              {/* Fallback to rule-based suggestions if no AI */}
              {!feedback.ai_feedback && feedback.suggestions.length > 0 && (
                <View className="mt-2">
                  {feedback.suggestions.slice(0, 2).map((s, i) => (
                    <Text key={i} className="text-sm text-muted-foreground">
                      • {s}
                    </Text>
                  ))}
                </View>
              )}

              <View className="mt-4 flex-row gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onPress={() => {
                    setShowFeedback(false);
                    setFeedback(null);
                  }}
                >
                  <Text className="text-foreground">Try Again</Text>
                </Button>
                <Button className="flex-1" onPress={nextPhrase}>
                  <Text className="text-primary-foreground">
                    {currentIndex < phrases.length - 1 ? "Next" : "Done"}
                  </Text>
                </Button>
              </View>
            </Card>
          ) : (
            <View className="items-center">
              <Text className="mb-4 text-muted-foreground">
                Tap to start recording
              </Text>
            </View>
          )}
        </View>

        {/* Record button */}
        {!showFeedback && !isProcessing && (
          <View className="items-center pb-4">
            <Button
              size="lg"
              className="h-20 w-20 rounded-full"
              onPress={recording ? stopRecording : startRecording}
            >
              <Mic
                size={32}
                className={recording ? "text-red-500" : "text-primary-foreground"}
              />
            </Button>
            <Text className="mt-2 text-sm text-muted-foreground">
              {recording ? "Tap to stop" : "Tap to record"}
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
