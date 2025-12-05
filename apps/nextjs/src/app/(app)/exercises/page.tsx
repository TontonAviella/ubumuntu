"use client";

import { useState, useEffect, useRef } from "react";
import { Mic, Volume2, Square, Loader2, CheckCircle, X, AlertCircle, Globe, ArrowLeft, Image as ImageIcon } from "lucide-react";

import { Button } from "@shc/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@shc/ui/card";
import { saveAttempt } from "~/lib/exercise-storage";

interface Category {
  id: string;
  name: { en: string; fr: string };
  description: { en: string; fr: string };
  icon: string;
  subcategories: string[];
  exercise_count: number;
}

interface Exercise {
  id: string;
  type: string;
  title: string;
  category: string;
  subcategory: string;
  difficulty: string;
  target_text: string;
  instructions: string;
  image_url?: string;
  audio_hint?: string;
}

interface AIFeedback {
  feedback: string;
  encouragement: string;
  specific_tips: string[];
  recommended_exercises: string[];
  difficulty_adjustment: string;
}

interface PracticeResult {
  transcription: string;
  target_text: string;
  scores: {
    overall: number;
    clarity: number;
    pace: number;
    fluency: number;
  };
  ai_feedback: AIFeedback;
  word_analysis: WordAnalysis[];
}

interface WordAnalysis {
  target: string;
  spoken: string;
  match: boolean;
}

// Real speech comparison algorithm
function analyzeSpokenText(target: string, spoken: string): {
  scores: { overall: number; clarity: number; pace: number; fluency: number };
  word_analysis: WordAnalysis[];
} {
  const targetWords = target.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(Boolean);
  const spokenWords = spoken.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(Boolean);

  // Word-by-word analysis
  const word_analysis: WordAnalysis[] = [];
  let matchedWords = 0;

  for (let i = 0; i < targetWords.length; i++) {
    const targetWord = targetWords[i] ?? '';
    const spokenWord = spokenWords[i] ?? '';

    // Calculate Levenshtein distance for partial matches
    const distance = levenshteinDistance(targetWord, spokenWord);
    const maxLen = Math.max(targetWord.length, spokenWord.length);
    const similarity = maxLen > 0 ? (1 - distance / maxLen) : 0;

    const isMatch = similarity >= 0.7; // 70% similarity threshold
    if (isMatch) matchedWords++;

    word_analysis.push({
      target: targetWord,
      spoken: spokenWord || '(missing)',
      match: isMatch
    });
  }

  // Extra words spoken
  for (let i = targetWords.length; i < spokenWords.length; i++) {
    const extraWord = spokenWords[i] ?? '';
    word_analysis.push({
      target: '(extra)',
      spoken: extraWord,
      match: false
    });
  }

  // Calculate real scores
  const wordAccuracy = targetWords.length > 0 ? (matchedWords / targetWords.length) * 100 : 0;

  // Clarity: based on word accuracy
  const clarity = Math.round(wordAccuracy);

  // Fluency: penalize missing or extra words
  const wordCountDiff = Math.abs(targetWords.length - spokenWords.length);
  const fluencyPenalty = (wordCountDiff / Math.max(targetWords.length, 1)) * 30;
  const fluency = Math.round(Math.max(0, wordAccuracy - fluencyPenalty));

  // Pace: based on whether all words were captured (too fast = missing words)
  const completeness = spokenWords.length >= targetWords.length ? 100 : (spokenWords.length / targetWords.length) * 100;
  const pace = Math.round(Math.min(100, completeness));

  // Overall: weighted average
  const overall = Math.round(clarity * 0.4 + fluency * 0.35 + pace * 0.25);

  return {
    scores: { overall, clarity, pace, fluency },
    word_analysis
  };
}

// Levenshtein distance for string comparison
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0) as number[]);

  for (let i = 0; i <= m; i++) {
    if (dp[i]) dp[i]![0] = i;
  }
  for (let j = 0; j <= n; j++) {
    if (dp[0]) dp[0]![j] = j;
  }

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const row = dp[i];
      const prevRow = dp[i - 1];
      if (!row || !prevRow) continue;

      if (str1[i - 1] === str2[j - 1]) {
        row[j] = prevRow[j - 1] ?? 0;
      } else {
        row[j] = 1 + Math.min(
          prevRow[j] ?? 0,
          row[j - 1] ?? 0,
          prevRow[j - 1] ?? 0
        );
      }
    }
  }
  return dp[m]?.[n] ?? 0;
}

// SpeechRecognition types
interface SpeechRecognitionEvent {
  resultIndex: number;
  results: {
    [index: number]: {
      [index: number]: { transcript: string };
      isFinal: boolean;
    };
    length: number;
  };
}

interface SpeechRecognitionErrorEvent {
  error: string;
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

// Extend Window interface for SpeechRecognition
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition: new () => SpeechRecognitionInstance;
  }
}

export default function ExercisesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState<"en" | "fr">("en");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);

  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [activeExercise, setActiveExercise] = useState<Exercise | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [practiceResult, setPracticeResult] = useState<PracticeResult | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [imageError, setImageError] = useState<Set<string>>(new Set());

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const finalTranscriptRef = useRef<string>("");
  const recordingStartTimeRef = useRef<number>(0);

  // Fetch categories on mount
  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_FASTAPI_URL}/v1/therapy/demo/categories?language=${language}`)
      .then((res) => res.json())
      .then((data) => {
        setCategories(data.categories || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [language]);

  // Fetch exercises when category/subcategory changes
  useEffect(() => {
    if (selectedCategory) {
      setLoading(true);
      let url = `${process.env.NEXT_PUBLIC_FASTAPI_URL}/v1/therapy/demo/exercises?language=${language}`;
      if (selectedCategory) url += `&category=${selectedCategory}`;
      if (selectedSubcategory) url += `&subcategory=${selectedSubcategory}`;

      fetch(url)
        .then((res) => res.json())
        .then((data) => {
          setExercises(data.exercises || []);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [selectedCategory, selectedSubcategory, language]);

  // Text-to-Speech using browser API
  const handleListen = (exercise: Exercise) => {
    if (speakingId === exercise.id) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(exercise.target_text);
    utterance.rate = 0.85;
    utterance.pitch = 1;
    utterance.lang = language === "fr" ? "fr-FR" : "en-US";
    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);

    setSpeakingId(exercise.id);
    window.speechSynthesis.speak(utterance);
  };

  // Start practice session
  const handlePractice = (exercise: Exercise) => {
    setActiveExercise(exercise);
    setPracticeResult(null);
    setRecordingTime(0);
    setLiveTranscript("");
    setError(null);
    finalTranscriptRef.current = "";
  };

  // Start REAL speech recognition
  const startRecording = () => {
    setError(null);

    // Check browser support
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      setError("Speech recognition not supported in this browser. Please use Chrome or Edge.");
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language === "fr" ? "fr-FR" : "en-US";

    recognition.onstart = () => {
      setIsRecording(true);
      setRecordingTime(0);
      setLiveTranscript("");
      finalTranscriptRef.current = "";
      recordingStartTimeRef.current = Date.now();

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (!result) continue;
        const firstAlt = result[0];
        if (!firstAlt) continue;
        const transcript = firstAlt.transcript;
        if (result.isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      if (finalTranscript) {
        finalTranscriptRef.current += finalTranscript;
      }

      setLiveTranscript(finalTranscriptRef.current + interimTranscript);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error("Speech recognition error:", event.error);
      if (event.error === 'not-allowed') {
        setError("Microphone access denied. Please allow microphone access.");
      } else if (event.error === 'no-speech') {
        setError("No speech detected. Please try again and speak clearly.");
      } else {
        setError(`Speech recognition error: ${event.error}`);
      }
      stopRecording();
    };

    recognition.onend = () => {
      if (isRecording) {
        // Recognition ended but we're still recording - process results
        processResults();
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  // Stop recording and process
  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
  };

  // Process REAL results
  const processResults = async () => {
    if (!activeExercise) return;

    const spokenText = finalTranscriptRef.current.trim() || liveTranscript.trim();

    if (!spokenText) {
      setError("No speech detected. Please try again and speak clearly into your microphone.");
      setIsRecording(false);
      return;
    }

    setIsProcessing(true);
    setIsRecording(false);

    try {
      // Calculate REAL scores based on actual comparison
      const analysis = analyzeSpokenText(activeExercise.target_text, spokenText);

      // Get REAL AI feedback based on actual performance
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_FASTAPI_URL}/v1/therapy/demo/feedback?` +
        `target_text=${encodeURIComponent(activeExercise.target_text)}` +
        `&transcription=${encodeURIComponent(spokenText)}` +
        `&score=${analysis.scores.overall}`,
        { method: "POST" }
      );

      const data = await response.json();

      const result = {
        transcription: spokenText,
        target_text: activeExercise.target_text,
        scores: analysis.scores,
        ai_feedback: data.ai_feedback,
        word_analysis: analysis.word_analysis
      };

      setPracticeResult(result);

      // Save attempt to localStorage for Progress and Analytics
      const durationSeconds = Math.round((Date.now() - recordingStartTimeRef.current) / 1000);
      saveAttempt({
        exerciseId: activeExercise.id,
        exerciseTitle: activeExercise.title,
        exerciseCategory: activeExercise.category,
        targetText: activeExercise.target_text,
        transcription: spokenText,
        scores: analysis.scores,
        wordAnalysis: analysis.word_analysis,
        aiFeedback: data.ai_feedback,
        durationSeconds
      });

    } catch (error) {
      console.error("Failed to get AI feedback:", error);
      // Still show real scores even if AI feedback fails
      const analysis = analyzeSpokenText(activeExercise.target_text, spokenText);
      const fallbackFeedback = {
        feedback: `You said: "${spokenText}". Compare this to the target phrase and practice the words you missed.`,
        encouragement: "Keep practicing! Real improvement comes with consistent effort.",
        specific_tips: analysis.word_analysis
          .filter(w => !w.match)
          .slice(0, 3)
          .map(w => `Practice the word "${w.target}" - you said "${w.spoken}"`),
        recommended_exercises: ["Try this exercise again", "Practice similar sounds"],
        difficulty_adjustment: analysis.scores.overall >= 80 ? "harder" : "same"
      };

      setPracticeResult({
        transcription: spokenText,
        target_text: activeExercise.target_text,
        scores: analysis.scores,
        ai_feedback: fallbackFeedback,
        word_analysis: analysis.word_analysis
      });

      // Save attempt even when AI feedback fails
      const durationSeconds = Math.round((Date.now() - recordingStartTimeRef.current) / 1000);
      saveAttempt({
        exerciseId: activeExercise.id,
        exerciseTitle: activeExercise.title,
        exerciseCategory: activeExercise.category,
        targetText: activeExercise.target_text,
        transcription: spokenText,
        scores: analysis.scores,
        wordAnalysis: analysis.word_analysis,
        aiFeedback: fallbackFeedback,
        durationSeconds
      });
    }

    setIsProcessing(false);
  };

  // Handle stop button click
  const handleStopRecording = () => {
    stopRecording();
    // Small delay to ensure final transcript is captured
    setTimeout(() => {
      processResults();
    }, 300);
  };

  // Close practice modal
  const closePractice = () => {
    if (isRecording) {
      stopRecording();
    }
    setActiveExercise(null);
    setPracticeResult(null);
    setRecordingTime(0);
    setLiveTranscript("");
    setError(null);
  };

  // Score color helper
  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return "bg-green-50 dark:bg-green-900/20";
    if (score >= 60) return "bg-yellow-50 dark:bg-yellow-900/20";
    return "bg-red-50 dark:bg-red-900/20";
  };

  // Handle image errors
  const handleImageError = (exerciseId: string) => {
    setImageError(prev => new Set(prev).add(exerciseId));
  };

  // Get current category info
  const currentCategory = categories.find(c => c.id === selectedCategory);

  // Format subcategory name
  const formatSubcategoryName = (sub: string) => {
    return sub.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  if (loading && !selectedCategory) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Language Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {selectedCategory && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedCategory(null);
                setSelectedSubcategory(null);
                setExercises([]);
              }}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              {language === "fr" ? "Retour" : "Back"}
            </Button>
          )}
          <div>
            <h1 className="text-3xl font-bold">
              {selectedCategory
                ? currentCategory?.name[language] || selectedCategory
                : language === "fr" ? "Exercices de Parole" : "Speech Exercises"
              }
            </h1>
            <p className="text-muted-foreground">
              {selectedCategory
                ? currentCategory?.description[language]
                : language === "fr"
                  ? "Choisissez une catégorie pour commencer"
                  : "Choose a category to get started"
              }
            </p>
          </div>
        </div>

        {/* Language Toggle */}
        <div className="flex items-center gap-2 bg-muted rounded-lg p-1">
          <Button
            variant={language === "en" ? "default" : "ghost"}
            size="sm"
            onClick={() => setLanguage("en")}
            className="flex items-center gap-1"
          >
            <Globe className="w-4 h-4" />
            EN 🇬🇧
          </Button>
          <Button
            variant={language === "fr" ? "default" : "ghost"}
            size="sm"
            onClick={() => setLanguage("fr")}
            className="flex items-center gap-1"
          >
            <Globe className="w-4 h-4" />
            FR 🇫🇷
          </Button>
        </div>
      </div>

      {/* Categories Grid */}
      {!selectedCategory && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((category) => (
            <Card
              key={category.id}
              className="cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02]"
              onClick={() => setSelectedCategory(category.id)}
            >
              <CardHeader className="text-center">
                <div className="text-4xl mb-2">{category.icon}</div>
                <CardTitle className="text-lg">{category.name[language]}</CardTitle>
                <CardDescription>{category.description[language]}</CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-sm text-muted-foreground">
                  {category.exercise_count} {language === "fr" ? "exercices" : "exercises"}
                </p>
                <div className="flex flex-wrap gap-1 justify-center mt-2">
                  {category.subcategories.slice(0, 3).map((sub) => (
                    <span key={sub} className="text-xs px-2 py-1 bg-muted rounded-full">
                      {formatSubcategoryName(sub)}
                    </span>
                  ))}
                  {category.subcategories.length > 3 && (
                    <span className="text-xs px-2 py-1 bg-muted rounded-full">
                      +{category.subcategories.length - 3}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Subcategory Filter */}
      {selectedCategory && currentCategory && (
        <div className="flex flex-wrap gap-2">
          <Button
            variant={selectedSubcategory === null ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedSubcategory(null)}
          >
            {language === "fr" ? "Tout" : "All"}
          </Button>
          {currentCategory.subcategories.map((sub) => (
            <Button
              key={sub}
              variant={selectedSubcategory === sub ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedSubcategory(sub)}
            >
              {formatSubcategoryName(sub)}
            </Button>
          ))}
        </div>
      )}

      {/* Loading state for exercises */}
      {loading && selectedCategory && (
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      )}

      {/* Exercises Grid */}
      {selectedCategory && !loading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {exercises.map((exercise) => (
            <Card key={exercise.id} className="hover:shadow-lg transition-shadow overflow-hidden">
              {/* Image for visual exercises */}
              {exercise.image_url && !imageError.has(exercise.id) && (
                <div className="relative h-40 bg-muted">
                  <img
                    src={exercise.image_url}
                    alt={exercise.title}
                    className="w-full h-full object-cover"
                    onError={() => handleImageError(exercise.id)}
                  />
                </div>
              )}
              {exercise.image_url && imageError.has(exercise.id) && (
                <div className="h-40 bg-muted flex items-center justify-center">
                  <ImageIcon className="w-12 h-12 text-muted-foreground" />
                </div>
              )}
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{exercise.title}</CardTitle>
                  <span className={`px-2 py-1 rounded text-xs ${
                    exercise.difficulty === "easy" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" :
                    exercise.difficulty === "medium" ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300" :
                    "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                  }`}>
                    {exercise.difficulty}
                  </span>
                </div>
                <CardDescription className="capitalize">
                  {formatSubcategoryName(exercise.subcategory)}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-3 bg-muted rounded-lg">
                  <p className="font-medium text-center">"{exercise.target_text}"</p>
                </div>
                <p className="text-sm text-muted-foreground">{exercise.instructions}</p>
                {exercise.audio_hint && (
                  <p className="text-xs text-blue-600 dark:text-blue-400 italic">
                    🔊 {exercise.audio_hint}
                  </p>
                )}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleListen(exercise)}
                  >
                    <Volume2 className={`w-4 h-4 mr-2 ${speakingId === exercise.id ? "animate-pulse text-blue-500" : ""}`} />
                    {speakingId === exercise.id
                      ? (language === "fr" ? "Arrêter" : "Stop")
                      : (language === "fr" ? "Écouter" : "Listen")}
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={() => handlePractice(exercise)}
                  >
                    <Mic className="w-4 h-4 mr-2" />
                    {language === "fr" ? "Pratiquer" : "Practice"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {selectedCategory && !loading && exercises.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Mic className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">
              {language === "fr" ? "Aucun exercice disponible" : "No exercises available"}
            </h3>
            <p className="text-muted-foreground">
              {language === "fr" ? "Revenez plus tard" : "Check back later for new exercises"}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Practice Modal */}
      {activeExercise && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <CardHeader className="flex flex-row items-start justify-between">
              <div>
                <CardTitle>{activeExercise.title}</CardTitle>
                <CardDescription>
                  {language === "fr" ? "Analyse de Parole en Temps Réel" : "Real Speech Analysis"}
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={closePractice}>
                <X className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Image if available */}
              {activeExercise.image_url && !imageError.has(activeExercise.id) && (
                <div className="rounded-lg overflow-hidden">
                  <img
                    src={activeExercise.image_url}
                    alt={activeExercise.title}
                    className="w-full h-48 object-cover"
                    onError={() => handleImageError(activeExercise.id)}
                  />
                </div>
              )}

              {/* Target Text */}
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-center">
                <p className="text-sm text-muted-foreground mb-2">
                  {language === "fr" ? "Dites cette phrase:" : "Say this phrase:"}
                </p>
                <p className="text-xl font-medium">"{activeExercise.target_text}"</p>
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                </div>
              )}

              {/* Recording Controls */}
              {!practiceResult && !isProcessing && (
                <div className="flex flex-col items-center gap-4">
                  <Button
                    size="lg"
                    variant={isRecording ? "destructive" : "default"}
                    className="w-32 h-32 rounded-full"
                    onClick={isRecording ? handleStopRecording : startRecording}
                  >
                    {isRecording ? (
                      <Square className="w-12 h-12" />
                    ) : (
                      <Mic className="w-12 h-12" />
                    )}
                  </Button>
                  <p className="text-sm text-muted-foreground">
                    {isRecording
                      ? `${language === "fr" ? "Enregistrement..." : "Recording..."} ${recordingTime}s`
                      : language === "fr"
                        ? "Appuyez pour commencer - parlez clairement"
                        : "Tap to start - speak clearly"}
                  </p>

                  {/* Live Transcript */}
                  {isRecording && liveTranscript && (
                    <div className="w-full p-3 bg-muted rounded-lg">
                      <p className="text-xs text-muted-foreground mb-1">
                        {language === "fr" ? "Ce que j'entends:" : "What I hear:"}
                      </p>
                      <p className="text-sm font-medium">{liveTranscript}</p>
                    </div>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleListen(activeExercise)}
                    disabled={isRecording}
                  >
                    <Volume2 className="w-4 h-4 mr-2" />
                    {language === "fr" ? "Écouter d'abord" : "Listen first"}
                  </Button>
                </div>
              )}

              {/* Processing */}
              {isProcessing && (
                <div className="flex flex-col items-center gap-4 py-8">
                  <Loader2 className="w-12 h-12 animate-spin text-primary" />
                  <p className="text-muted-foreground">
                    {language === "fr" ? "Analyse de votre parole..." : "Analyzing your speech..."}
                  </p>
                </div>
              )}

              {/* REAL Results */}
              {practiceResult && (
                <div className="space-y-4">
                  {/* What you said vs Target */}
                  <div className="space-y-2">
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-xs text-muted-foreground mb-1">
                        {language === "fr" ? "Cible:" : "Target:"}
                      </p>
                      <p className="font-medium">{practiceResult.target_text}</p>
                    </div>
                    <div className={`p-3 rounded-lg ${getScoreBg(practiceResult.scores.overall)}`}>
                      <p className="text-xs text-muted-foreground mb-1">
                        {language === "fr" ? "Vous avez dit:" : "You said:"}
                      </p>
                      <p className="font-medium">
                        {practiceResult.transcription || (language === "fr" ? "(aucune parole détectée)" : "(no speech detected)")}
                      </p>
                    </div>
                  </div>

                  {/* Word-by-word analysis */}
                  {practiceResult.word_analysis.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {practiceResult.word_analysis.map((word, i) => (
                        <span
                          key={i}
                          className={`px-2 py-1 rounded text-sm ${
                            word.match
                              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                              : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                          }`}
                          title={word.match ? "Correct" : `Expected: ${word.target}, Got: ${word.spoken}`}
                        >
                          {word.target}
                          {!word.match && word.spoken !== '(missing)' && (
                            <span className="text-xs ml-1">→{word.spoken}</span>
                          )}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Scores */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className={`p-3 rounded-lg text-center ${getScoreBg(practiceResult.scores.overall)}`}>
                      <p className="text-sm text-muted-foreground">
                        {language === "fr" ? "Global" : "Overall"}
                      </p>
                      <p className={`text-2xl font-bold ${getScoreColor(practiceResult.scores.overall)}`}>
                        {practiceResult.scores.overall}%
                      </p>
                    </div>
                    <div className={`p-3 rounded-lg text-center ${getScoreBg(practiceResult.scores.clarity)}`}>
                      <p className="text-sm text-muted-foreground">
                        {language === "fr" ? "Précision" : "Accuracy"}
                      </p>
                      <p className={`text-2xl font-bold ${getScoreColor(practiceResult.scores.clarity)}`}>
                        {practiceResult.scores.clarity}%
                      </p>
                    </div>
                    <div className={`p-3 rounded-lg text-center ${getScoreBg(practiceResult.scores.pace)}`}>
                      <p className="text-sm text-muted-foreground">
                        {language === "fr" ? "Complétude" : "Completeness"}
                      </p>
                      <p className={`text-2xl font-bold ${getScoreColor(practiceResult.scores.pace)}`}>
                        {practiceResult.scores.pace}%
                      </p>
                    </div>
                    <div className={`p-3 rounded-lg text-center ${getScoreBg(practiceResult.scores.fluency)}`}>
                      <p className="text-sm text-muted-foreground">
                        {language === "fr" ? "Fluidité" : "Fluency"}
                      </p>
                      <p className={`text-2xl font-bold ${getScoreColor(practiceResult.scores.fluency)}`}>
                        {practiceResult.scores.fluency}%
                      </p>
                    </div>
                  </div>

                  {/* AI Feedback */}
                  <div className={`p-4 rounded-lg ${getScoreBg(practiceResult.scores.overall)}`}>
                    <p className={`font-medium mb-2 ${getScoreColor(practiceResult.scores.overall)}`}>
                      {practiceResult.ai_feedback.encouragement}
                    </p>
                    <p className="text-sm">{practiceResult.ai_feedback.feedback}</p>
                  </div>

                  {/* Tips */}
                  {practiceResult.ai_feedback.specific_tips.length > 0 && (
                    <div>
                      <p className="font-medium mb-2">
                        {language === "fr" ? "Conseils d'amélioration:" : "Tips for improvement:"}
                      </p>
                      <ul className="space-y-1">
                        {practiceResult.ai_feedback.specific_tips.map((tip, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                            {tip}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setPracticeResult(null);
                        setLiveTranscript("");
                        setError(null);
                        finalTranscriptRef.current = "";
                      }}
                    >
                      {language === "fr" ? "Réessayer" : "Try Again"}
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={closePractice}
                    >
                      {language === "fr" ? "Terminé" : "Done"}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
