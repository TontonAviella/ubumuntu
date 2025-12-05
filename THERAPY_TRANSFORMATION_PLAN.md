# Ubumuntu - Speech Therapy Platform

## Executive Summary

Ubumuntu is an **active, interactive speech/communication therapy assistant** with custom ASR, TTS, therapy exercises, progress tracking, and AI-powered personalized feedback.

---

## 1. Current Architecture Analysis

### Tech Stack
```
├── apps/
│   ├── expo/          # React Native mobile (Expo SDK 51, NativeWind, tRPC)
│   ├── fastapi/       # Python backend (FastAPI, OpenAI Whisper API, GPT-4)
│   └── nextjs/        # Web dashboard (Next.js 14, Tailwind, Novel editor)
├── packages/
│   ├── api/           # tRPC router + FastAPI OpenAPI client
│   ├── db/            # Drizzle ORM (PostgreSQL/RDS)
│   ├── ui/            # shadcn/ui components
│   └── validators/    # Zod schemas
└── infra/             # SST Ion (AWS deployment)
```

### Current Data Flow
```
Mobile Recording (expo-av)
    → Upload to FastAPI
    → OpenAI Whisper API (transcription)
    → GPT-4 (SOAP note generation)
    → Store in PostgreSQL
    → Display in Next.js dashboard
```

### Key Limitations for Therapy Use
| Component | Current | Limitation |
|-----------|---------|------------|
| ASR | OpenAI Whisper API | Cloud-only, no fine-tuning for atypical speech |
| TTS | None | No voice output capability |
| Feedback | None | No real-time pronunciation feedback |
| UI | Staff-focused | Not designed for patient interaction |
| Analytics | Basic notes | No therapy progress metrics |
| Offline | None | Requires internet |

---

## 2. Transformation Architecture

### New Data Flow
```
┌─────────────────────────────────────────────────────────────────────┐
│                        THERAPY PLATFORM                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐        │
│  │   MOBILE     │     │   BACKEND    │     │   WEB        │        │
│  │   (Expo)     │     │  (FastAPI)   │     │  (Next.js)   │        │
│  └──────┬───────┘     └──────┬───────┘     └──────┬───────┘        │
│         │                    │                    │                 │
│  ┌──────▼───────┐     ┌──────▼───────┐     ┌──────▼───────┐        │
│  │ Recording    │     │ ASR Engine   │     │ Therapist    │        │
│  │ Therapy UI   │────▶│ Whisper/     │◀────│ Dashboard    │        │
│  │ AAC Board    │     │ SpeechBrain  │     │ Analytics    │        │
│  │ Progress     │     │              │     │              │        │
│  └──────┬───────┘     └──────┬───────┘     └──────────────┘        │
│         │                    │                                      │
│  ┌──────▼───────┐     ┌──────▼───────┐                             │
│  │ TTS Engine   │     │ Analysis     │                             │
│  │ WhisperSpeech│     │ Pronunciation│                             │
│  │ Coqui TTS    │     │ Clarity      │                             │
│  └──────────────┘     │ Progress     │                             │
│                       └──────────────┘                             │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Module Implementation Plan

### Module 1: Custom ASR for Atypical Speech

**Goal**: Replace cloud-only OpenAI Whisper with local/hybrid ASR that can handle speech impairments.

**Implementation Approach**:

```python
# apps/fastapi/api/endpoints/v1/processing/therapy_asr.py

from enum import Enum
from typing import Optional
import torch
from transformers import WhisperProcessor, WhisperForConditionalGeneration
import speechbrain as sb

class ASREngine(Enum):
    WHISPER_LOCAL = "whisper_local"      # Local Whisper for general use
    SPEECHBRAIN = "speechbrain"          # Fine-tuned for atypical speech
    WHISPER_API = "whisper_api"          # Fallback to OpenAI API

class TherapyASR:
    def __init__(self, engine: ASREngine = ASREngine.WHISPER_LOCAL):
        self.engine = engine
        self._load_model()

    def _load_model(self):
        if self.engine == ASREngine.WHISPER_LOCAL:
            self.processor = WhisperProcessor.from_pretrained("openai/whisper-large-v3")
            self.model = WhisperForConditionalGeneration.from_pretrained("openai/whisper-large-v3")
        elif self.engine == ASREngine.SPEECHBRAIN:
            # Load fine-tuned SpeechBrain model for atypical speech
            self.model = sb.pretrained.EncoderDecoderASR.from_hparams(
                source="path/to/finetuned-model",
                savedir="models/speechbrain"
            )

    def transcribe(self, audio_bytes: bytes, user_profile: Optional[dict] = None) -> dict:
        """Transcribe with user-specific adaptations."""
        # Select engine based on user profile
        if user_profile and user_profile.get("speech_impairment"):
            return self._transcribe_speechbrain(audio_bytes)
        return self._transcribe_whisper(audio_bytes)

    def _transcribe_whisper(self, audio_bytes: bytes) -> dict:
        # Local Whisper transcription with word-level timestamps
        pass

    def _transcribe_speechbrain(self, audio_bytes: bytes) -> dict:
        # SpeechBrain transcription optimized for atypical speech
        pass
```

**Files to Modify/Create**:
- `apps/fastapi/api/endpoints/v1/processing/therapy_asr.py` (new)
- `apps/fastapi/api/endpoints/v1/processing/audio.py` (modify to use TherapyASR)
- `apps/fastapi/pyproject.toml` (add torch, transformers, speechbrain)

**Recommended Models**:
| Use Case | Model | Size | Notes |
|----------|-------|------|-------|
| General | Whisper large-v3 | 1.5GB | Best accuracy |
| Atypical Speech | SpeechBrain + PEFT | 500MB | Fine-tune on user data |
| Offline/Mobile | Vosk | 50MB | Lightweight fallback |

---

### Module 2: TTS for Communication Support

**Goal**: Add text-to-speech with voice cloning for AAC and therapy exercises.

**Implementation**:

```python
# apps/fastapi/api/endpoints/v1/processing/therapy_tts.py

from typing import Optional
import torch

class TherapyTTS:
    def __init__(self):
        self.engine = None
        self._load_whisperspeech()

    def _load_whisperspeech(self):
        from whisperspeech.pipeline import Pipeline
        self.pipe = Pipeline(s2a_ref='collabora/whisperspeech:s2a-q4-tiny-en+pl.model')

    def synthesize(
        self,
        text: str,
        voice_reference: Optional[bytes] = None,
        speed: float = 1.0
    ) -> bytes:
        """Generate speech from text, optionally cloning a voice."""
        if voice_reference:
            # Clone voice from reference audio
            audio = self.pipe.generate(text, speaker=voice_reference)
        else:
            audio = self.pipe.generate(text)
        return audio

    def generate_therapy_prompt(self, exercise_type: str, text: str) -> bytes:
        """Generate therapy exercise audio prompts."""
        prompts = {
            "repeat_after_me": f"Please repeat after me: {text}",
            "pronunciation": f"Let's practice saying: {text}. Listen carefully.",
            "slower": f"Now try saying it more slowly: {text}",
        }
        return self.synthesize(prompts.get(exercise_type, text))
```

**API Endpoint**:
```python
# apps/fastapi/api/endpoints/v1/routers/tts.py

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

class TTSRequest(BaseModel):
    text: str
    voice_id: Optional[str] = None
    speed: float = 1.0
    exercise_type: Optional[str] = None

@router.post("/synthesize")
async def synthesize_speech(request: TTSRequest):
    """Generate speech from text."""
    tts = TherapyTTS()
    audio = tts.synthesize(request.text, speed=request.speed)
    return StreamingResponse(io.BytesIO(audio), media_type="audio/wav")
```

---

### Module 3: Interactive Therapy Feedback System

**Goal**: Provide real-time feedback on pronunciation, clarity, and progress.

**Implementation**:

```python
# apps/fastapi/api/endpoints/v1/processing/pronunciation_analysis.py

import numpy as np
from dataclasses import dataclass
from typing import List, Tuple

@dataclass
class PronunciationFeedback:
    overall_score: float          # 0-100
    clarity_score: float          # 0-100
    pace_score: float             # 0-100
    word_scores: List[dict]       # Per-word breakdown
    suggestions: List[str]        # Improvement suggestions
    phoneme_errors: List[dict]    # Specific phoneme issues

class PronunciationAnalyzer:
    def __init__(self):
        self.target_phonemes = None

    def analyze(
        self,
        audio_bytes: bytes,
        target_text: str,
        user_baseline: Optional[dict] = None
    ) -> PronunciationFeedback:
        """Analyze pronunciation against target text."""

        # 1. Transcribe with forced alignment
        transcription = self._forced_align(audio_bytes, target_text)

        # 2. Extract acoustic features
        features = self._extract_features(audio_bytes)

        # 3. Compare against target phonemes
        phoneme_scores = self._score_phonemes(transcription, target_text)

        # 4. Calculate metrics
        clarity = self._calculate_clarity(features)
        pace = self._calculate_pace(transcription)

        # 5. Generate feedback
        return PronunciationFeedback(
            overall_score=np.mean([clarity, pace, phoneme_scores['mean']]),
            clarity_score=clarity,
            pace_score=pace,
            word_scores=phoneme_scores['words'],
            suggestions=self._generate_suggestions(phoneme_scores),
            phoneme_errors=phoneme_scores['errors']
        )

    def _forced_align(self, audio: bytes, text: str) -> dict:
        """Align audio to text at word/phoneme level."""
        # Use Kaldi or wav2vec2 for forced alignment
        pass

    def _calculate_clarity(self, features: dict) -> float:
        """Calculate speech clarity score."""
        # Analyze formants, spectral clarity, SNR
        pass

    def _generate_suggestions(self, scores: dict) -> List[str]:
        """Generate actionable improvement suggestions."""
        suggestions = []
        for error in scores['errors']:
            if error['type'] == 'substitution':
                suggestions.append(f"Try focusing on the '{error['target']}' sound in '{error['word']}'")
            elif error['type'] == 'omission':
                suggestions.append(f"Make sure to pronounce the '{error['target']}' in '{error['word']}'")
        return suggestions
```

**Therapy Exercise Types**:
```python
# apps/fastapi/api/endpoints/v1/therapy/exercises.py

class ExerciseType(Enum):
    REPEAT_AFTER_ME = "repeat_after_me"
    MINIMAL_PAIRS = "minimal_pairs"        # bat/pat, ship/chip
    TONGUE_TWISTERS = "tongue_twisters"
    WORD_CHAINS = "word_chains"
    SENTENCE_BUILDING = "sentence_building"
    CONVERSATION_PRACTICE = "conversation"

class TherapyExercise:
    def __init__(self, exercise_type: ExerciseType, difficulty: int = 1):
        self.type = exercise_type
        self.difficulty = difficulty

    def generate(self, focus_phonemes: List[str] = None) -> dict:
        """Generate exercise based on type and target phonemes."""
        generators = {
            ExerciseType.REPEAT_AFTER_ME: self._repeat_after_me,
            ExerciseType.MINIMAL_PAIRS: self._minimal_pairs,
            # ... etc
        }
        return generators[self.type](focus_phonemes)

    def evaluate(self, user_audio: bytes, target: str) -> dict:
        """Evaluate user's attempt at exercise."""
        analyzer = PronunciationAnalyzer()
        return analyzer.analyze(user_audio, target)
```

---

### Module 4: UI/UX Adaptation for Therapy

**Goal**: Transform staff-focused UI into patient/user-friendly therapy interface.

**New Expo Screens**:

```typescript
// apps/expo/src/app/(therapy)/_layout.tsx
// New therapy-focused navigation

export default function TherapyLayout() {
  return (
    <Stack>
      <Stack.Screen name="home" options={{ title: "My Therapy" }} />
      <Stack.Screen name="exercises" options={{ title: "Practice" }} />
      <Stack.Screen name="aac-board" options={{ title: "Communication" }} />
      <Stack.Screen name="progress" options={{ title: "My Progress" }} />
      <Stack.Screen name="session" options={{ title: "Session" }} />
    </Stack>
  );
}
```

**AAC Communication Board**:
```typescript
// apps/expo/src/app/(therapy)/aac-board.tsx

import { useState } from 'react';
import { View, TouchableOpacity, Image } from 'react-native';
import { Audio } from 'expo-av';

interface AACSymbol {
  id: string;
  label: string;
  imageUrl: string;
  audioUrl?: string;
}

export default function AACBoard() {
  const [selectedSymbols, setSelectedSymbols] = useState<AACSymbol[]>([]);

  const speakSymbol = async (symbol: AACSymbol) => {
    // Use TTS API to speak the symbol
    const response = await fetch(`${API_URL}/v1/tts/synthesize`, {
      method: 'POST',
      body: JSON.stringify({ text: symbol.label }),
    });
    const audio = await response.blob();
    // Play audio
  };

  const speakSentence = async () => {
    const sentence = selectedSymbols.map(s => s.label).join(' ');
    // TTS for full sentence
  };

  return (
    <View className="flex-1">
      {/* Symbol grid */}
      <View className="flex-row flex-wrap p-4">
        {symbols.map(symbol => (
          <TouchableOpacity
            key={symbol.id}
            onPress={() => speakSymbol(symbol)}
            className="w-24 h-24 m-2 items-center justify-center bg-white rounded-xl"
          >
            <Image source={{ uri: symbol.imageUrl }} className="w-16 h-16" />
            <Text className="text-sm mt-1">{symbol.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Sentence strip */}
      <View className="flex-row p-4 bg-gray-100">
        {selectedSymbols.map(s => (
          <View key={s.id} className="w-12 h-12 m-1">
            <Image source={{ uri: s.imageUrl }} className="w-full h-full" />
          </View>
        ))}
        <TouchableOpacity onPress={speakSentence}>
          <Text>Speak</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
```

**Therapy Exercise Screen**:
```typescript
// apps/expo/src/app/(therapy)/exercises/[exerciseId].tsx

export default function ExerciseScreen() {
  const [isListening, setIsListening] = useState(false);
  const [feedback, setFeedback] = useState<PronunciationFeedback | null>(null);

  const playTarget = async () => {
    // Play TTS of target phrase
  };

  const recordAttempt = async () => {
    // Record user's attempt
    // Send to API for analysis
    // Display feedback
  };

  return (
    <SafeAreaView className="flex-1 bg-blue-50">
      {/* Target phrase display */}
      <View className="p-6">
        <Text className="text-3xl font-bold text-center">{targetPhrase}</Text>
        <TouchableOpacity onPress={playTarget}>
          <Text>Listen</Text>
        </TouchableOpacity>
      </View>

      {/* Recording button */}
      <View className="flex-1 items-center justify-center">
        <TouchableOpacity
          onPress={recordAttempt}
          className={`w-32 h-32 rounded-full ${isListening ? 'bg-red-500' : 'bg-green-500'}`}
        >
          <Text className="text-white text-xl">
            {isListening ? 'Recording...' : 'Try It!'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Feedback display */}
      {feedback && (
        <View className="p-6 bg-white rounded-t-3xl">
          <Text className="text-2xl font-bold">Score: {feedback.overall_score}%</Text>
          <View className="mt-4">
            {feedback.suggestions.map((s, i) => (
              <Text key={i} className="text-gray-600">• {s}</Text>
            ))}
          </View>
          <TouchableOpacity className="mt-4 bg-blue-500 p-4 rounded-xl">
            <Text className="text-white text-center">Try Again</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}
```

---

### Module 5: Progress Tracking & Analytics

**Goal**: Track therapy progress with meaningful metrics.

**New Database Schema**:
```typescript
// packages/db/src/schema/therapy.ts

import { pgTable, uuid, text, timestamp, integer, jsonb, real } from 'drizzle-orm/pg-core';

export const UserProfile = pgTable('user_profile', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(),
  therapistId: text('therapist_id'),
  speechCondition: text('speech_condition'),  // dysarthria, apraxia, autism, etc.
  targetPhonemes: jsonb('target_phonemes'),   // Phonemes to focus on
  difficultyLevel: integer('difficulty_level').default(1),
  voiceProfileId: uuid('voice_profile_id'),   // For voice cloning
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const TherapySession = pgTable('therapy_session', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(),
  sessionType: text('session_type').notNull(), // exercise, conversation, aac
  startedAt: timestamp('started_at').defaultNow().notNull(),
  endedAt: timestamp('ended_at'),
  duration: integer('duration'),               // seconds
  exerciseCount: integer('exercise_count').default(0),
  averageScore: real('average_score'),
  metadata: jsonb('metadata'),
});

export const ExerciseAttempt = pgTable('exercise_attempt', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').references(() => TherapySession.id),
  userId: text('user_id').notNull(),
  exerciseType: text('exercise_type').notNull(),
  targetText: text('target_text').notNull(),
  transcription: text('transcription'),
  overallScore: real('overall_score'),
  clarityScore: real('clarity_score'),
  paceScore: real('pace_score'),
  phonemeErrors: jsonb('phoneme_errors'),
  audioUrl: text('audio_url'),                 // S3 URL for review
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const ProgressMetric = pgTable('progress_metric', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(),
  metricType: text('metric_type').notNull(),   // pcc, pwc, intelligibility
  value: real('value').notNull(),
  measuredAt: timestamp('measured_at').defaultNow().notNull(),
  notes: text('notes'),
});
```

**Progress Analytics API**:
```python
# apps/fastapi/api/endpoints/v1/analytics/progress.py

from fastapi import APIRouter
from datetime import datetime, timedelta

router = APIRouter()

@router.get("/user/{user_id}/summary")
async def get_progress_summary(user_id: str, days: int = 30):
    """Get user's progress summary."""
    return {
        "overall_improvement": calculate_improvement(user_id, days),
        "sessions_completed": count_sessions(user_id, days),
        "average_score": calculate_average_score(user_id, days),
        "phoneme_progress": get_phoneme_progress(user_id),
        "recommendations": generate_recommendations(user_id),
        "weekly_trend": get_weekly_trend(user_id),
    }

@router.get("/user/{user_id}/detailed")
async def get_detailed_progress(user_id: str):
    """Get detailed progress metrics for therapist review."""
    return {
        "pcc_history": get_metric_history(user_id, "pcc"),  # Percent Consonants Correct
        "pwc_history": get_metric_history(user_id, "pwc"),  # Percent Words Correct
        "intelligibility": get_metric_history(user_id, "intelligibility"),
        "session_history": get_session_history(user_id),
        "problem_areas": identify_problem_areas(user_id),
        "improvement_areas": identify_improvements(user_id),
    }
```

---

### Module 6: Offline & Privacy Mode

**Goal**: Enable offline functionality and ensure data privacy.

**Offline ASR (Expo)**:
```typescript
// apps/expo/src/lib/offline-asr.ts

import * as FileSystem from 'expo-file-system';

class OfflineASR {
  private modelPath: string;
  private isLoaded: boolean = false;

  async initialize() {
    // Download Vosk model on first use
    const modelUrl = 'https://storage.../vosk-model-small-en-us.zip';
    this.modelPath = `${FileSystem.documentDirectory}vosk-model/`;

    if (!await this.isModelDownloaded()) {
      await this.downloadModel(modelUrl);
    }
    this.isLoaded = true;
  }

  async transcribe(audioUri: string): Promise<string> {
    if (!this.isLoaded) await this.initialize();
    // Use react-native-vosk or similar
    return transcription;
  }
}
```

**Privacy Features**:
```python
# apps/fastapi/api/endpoints/v1/privacy.py

class PrivacyMode(Enum):
    CLOUD = "cloud"           # Full cloud processing
    HYBRID = "hybrid"         # Local ASR, cloud analysis
    LOCAL = "local"           # Fully offline
    HIPAA = "hipaa"           # HIPAA-compliant mode

class DataRetention:
    """Configure data retention policies."""

    @staticmethod
    def anonymize_audio(audio_bytes: bytes) -> bytes:
        """Remove identifying features from audio."""
        pass

    @staticmethod
    def delete_after_session(session_id: str):
        """Delete audio files after session analysis."""
        pass

    @staticmethod
    def export_user_data(user_id: str) -> dict:
        """GDPR-compliant data export."""
        pass
```

---

## 4. Implementation Roadmap

### Phase 1: Foundation (Weeks 1-4)
**Priority: Critical**

| Task | Files | Effort |
|------|-------|--------|
| Local Whisper ASR | `therapy_asr.py` | 1 week |
| Basic TTS (WhisperSpeech) | `therapy_tts.py` | 1 week |
| New DB schema | `packages/db/src/schema/therapy.ts` | 3 days |
| API endpoints | `routers/therapy.py`, `routers/tts.py` | 1 week |

**Deliverable**: Basic speech-in, speech-out capability

### Phase 2: Therapy Core (Weeks 5-8)
**Priority: High**

| Task | Files | Effort |
|------|-------|--------|
| Pronunciation analyzer | `pronunciation_analysis.py` | 2 weeks |
| Exercise system | `therapy/exercises.py` | 1 week |
| Expo therapy UI | `apps/expo/src/app/(therapy)/*` | 1 week |

**Deliverable**: Working therapy exercise flow with feedback

### Phase 3: AAC & Communication (Weeks 9-12)
**Priority: High**

| Task | Files | Effort |
|------|-------|--------|
| AAC board component | `aac-board.tsx` | 1 week |
| Symbol library integration | `lib/symbols.ts` | 3 days |
| Voice cloning setup | `therapy_tts.py` | 1 week |
| TTS customization UI | `settings/voice.tsx` | 3 days |

**Deliverable**: Functional AAC communication board

### Phase 4: Analytics & Progress (Weeks 13-16)
**Priority: Medium**

| Task | Files | Effort |
|------|-------|--------|
| Progress tracking API | `analytics/progress.py` | 1 week |
| Therapist dashboard | `apps/nextjs/app/therapist/*` | 2 weeks |
| Progress visualization | `components/charts/*` | 1 week |

**Deliverable**: Complete progress tracking system

### Phase 5: Offline & Polish (Weeks 17-20)
**Priority: Medium**

| Task | Files | Effort |
|------|-------|--------|
| Offline ASR (Vosk) | `offline-asr.ts` | 1 week |
| Local caching | `lib/cache.ts` | 3 days |
| SpeechBrain fine-tuning | `training/speechbrain/*` | 2 weeks |
| WCAG compliance | All UI files | 1 week |

**Deliverable**: Offline-capable, accessible app

---

## 5. Technology Recommendations

### ASR Stack
```yaml
Primary: OpenAI Whisper large-v3 (local)
  - Best accuracy for general speech
  - Self-hosted for privacy

Secondary: SpeechBrain with PEFT
  - Fine-tune for specific speech conditions
  - Per-user adaptation capability

Offline: Vosk small model
  - 50MB, runs on mobile
  - Acceptable accuracy for exercises
```

### TTS Stack
```yaml
Primary: WhisperSpeech
  - Apache 2.0 license
  - Voice cloning capable
  - 12x faster than real-time

Fallback: Coqui TTS (XTTS-v2)
  - Better voice quality
  - 6-second voice cloning
  - Check licensing for commercial use
```

### Analysis Tools
```yaml
Pronunciation: Custom + Praat backend
  - Formant analysis
  - Forced alignment
  - PCC/PWC metrics

Clarity: Speechace API (optional)
  - Professional-grade analysis
  - Real-time feedback
  - API costs apply
```

---

## 6. Key Files to Create/Modify

### New Files
```
apps/fastapi/api/endpoints/v1/
├── processing/
│   ├── therapy_asr.py         # Multi-engine ASR
│   ├── therapy_tts.py         # TTS with voice cloning
│   └── pronunciation_analysis.py
├── therapy/
│   ├── exercises.py           # Exercise generation
│   └── session.py             # Session management
├── analytics/
│   └── progress.py            # Progress tracking
└── routers/
    ├── therapy.py             # Therapy endpoints
    └── tts.py                 # TTS endpoints

apps/expo/src/app/(therapy)/
├── _layout.tsx
├── home.tsx
├── exercises/
│   ├── index.tsx
│   └── [exerciseId].tsx
├── aac-board.tsx
├── progress.tsx
└── session.tsx

packages/db/src/schema/
└── therapy.ts                 # New therapy tables
```

### Modified Files
```
apps/fastapi/
├── pyproject.toml            # Add torch, transformers, speechbrain
├── api/endpoints/v1/api.py   # Register new routers

packages/api/
└── src/router/               # Add therapy tRPC routes

apps/expo/
├── src/app/_layout.tsx       # Add therapy navigation
└── package.json              # Add audio processing deps
```

---

## 7. Dependencies to Add

### FastAPI (pyproject.toml)
```toml
[tool.poetry.dependencies]
torch = "^2.1.0"
transformers = "^4.36.0"
speechbrain = "^1.0.0"
whisperspeech = "^0.8.0"
praat-parselmouth = "^0.4.3"
librosa = "^0.10.1"
numpy = "^1.26.0"
scipy = "^1.11.0"
```

### Expo (package.json)
```json
{
  "dependencies": {
    "expo-av": "~14.0.0",
    "expo-file-system": "~17.0.0",
    "react-native-vosk": "^0.3.0",
    "@react-native-async-storage/async-storage": "^1.21.0"
  }
}
```

---

## 8. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| ASR accuracy (typical speech) | >95% WER | Automated testing |
| ASR accuracy (atypical speech) | >80% WER | User studies |
| TTS naturalness | MOS >4.0 | User ratings |
| Exercise completion rate | >70% | Analytics |
| User retention (30-day) | >50% | Analytics |
| Offline functionality | Works without internet | Testing |
| WCAG compliance | Level AA | Audit |
| Response latency | <500ms | Monitoring |

---

## 9. Risk Mitigation

| Risk | Mitigation |
|------|------------|
| ASR poor on atypical speech | SpeechBrain fine-tuning, user profiles |
| TTS voice quality | Multiple engine fallbacks |
| Offline model size too large | Tiered models, optional download |
| Privacy concerns | Local processing option, data retention policies |
| Accessibility gaps | WCAG audit, user testing with target populations |

---

## Next Steps

1. **Set up development environment** with new dependencies
2. **Implement Module 1** (Local Whisper ASR)
3. **Create basic therapy exercise flow** (end-to-end proof of concept)
4. **User testing** with speech pathologist feedback
5. **Iterate** based on feedback

Ready to begin implementation?
