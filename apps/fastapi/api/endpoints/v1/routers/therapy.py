"""
Therapy Router - API endpoints for speech therapy features.

Endpoints:
- POST /therapy/transcribe - Transcribe audio with therapy-optimized ASR
- POST /therapy/tts - Text-to-speech synthesis
- POST /therapy/analyze - Pronunciation analysis
- POST /therapy/exercise - Generate and evaluate exercises
"""

import io
import logging
from typing import Optional
from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile, Query
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

from api.config import settings
from api.endpoints.v1.auth.verify import verify_token
from api.endpoints.v1.processing.therapy_asr import (
    transcribe_for_therapy,
    ASREngine,
    TranscriptionResult
)
from api.endpoints.v1.processing.therapy_tts import (
    synthesize_speech,
    get_therapy_tts,
    TTSVoice,
    TTSEngine
)
from api.endpoints.v1.processing.pronunciation_analysis import (
    analyze_pronunciation,
    PronunciationFeedback,
    AIFeedback
)
from api.endpoints.v1.processing.ai_feedback import get_ai_feedback_generator

router = APIRouter()

if settings.ENVIRONMENT == "development":
    logging.basicConfig(level=logging.DEBUG)
else:
    logging.basicConfig(level=logging.WARNING)

# Allowed audio types
ALLOWED_AUDIO_TYPES = [
    "audio/mpeg", "audio/mp4", "audio/m4a", "audio/x-m4a",
    "audio/wav", "audio/x-wav", "audio/webm"
]
FILE_SIZE_LIMIT = 25 * 1024 * 1024  # 25 MB


# Request/Response Models
class TranscribeRequest(BaseModel):
    """Request model for transcription."""
    engine: Optional[ASREngine] = Field(None, description="ASR engine to use")
    user_profile: Optional[dict] = Field(None, description="User speech profile")


class TranscriptionResponse(BaseModel):
    """Response model for transcription."""
    text: str
    engine_used: str
    confidence: Optional[float] = None
    word_timestamps: Optional[list] = None


class TTSRequest(BaseModel):
    """Request model for TTS."""
    text: str = Field(..., min_length=1, max_length=5000)
    voice: TTSVoice = Field(default=TTSVoice.NEUTRAL)
    speed: float = Field(default=1.0, ge=0.5, le=2.0)
    engine: Optional[TTSEngine] = None


class PronunciationRequest(BaseModel):
    """Request model for pronunciation analysis."""
    target_text: str = Field(..., min_length=1, max_length=500)


class AIFeedbackResponse(BaseModel):
    """AI-generated feedback from GPT-4o."""
    feedback: str
    encouragement: str
    specific_tips: list[str]
    recommended_exercises: list[str]
    difficulty_adjustment: Optional[str] = None


class PronunciationResponse(BaseModel):
    """Response model for pronunciation analysis."""
    overall_score: float
    clarity_score: float
    pace_score: float
    fluency_score: float
    transcription: str
    target_text: str
    suggestions: list[str]
    word_scores: list[dict]
    ai_feedback: Optional[AIFeedbackResponse] = None  # GPT-4o powered feedback


class ExerciseRequest(BaseModel):
    """Request model for exercise generation."""
    exercise_type: str = Field(..., description="Type: repeat_after_me, minimal_pairs, etc.")
    difficulty: int = Field(default=1, ge=1, le=5)
    focus_phonemes: Optional[list[str]] = None


class ExerciseResponse(BaseModel):
    """Response model for exercise."""
    exercise_id: str
    exercise_type: str
    target_text: str
    instructions: str
    audio_prompt_available: bool


# Endpoints

@router.post("/transcribe", response_model=TranscriptionResponse, tags=["therapy"])
async def transcribe_therapy_audio(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    engine: Optional[ASREngine] = Query(None, description="ASR engine"),
    user: str = Depends(verify_token),
):
    """
    Transcribe audio using therapy-optimized ASR.

    Supports multiple engines:
    - whisper_api: OpenAI Whisper API (best accuracy)
    - whisper_local: Local Whisper (privacy-focused)
    - speechbrain: SpeechBrain (optimized for atypical speech)
    - auto: Automatic selection based on user profile
    """
    logging.info(f"Therapy transcription request from user: {user}")

    # Validate file
    if file.content_type not in ALLOWED_AUDIO_TYPES:
        raise HTTPException(status_code=400, detail="Invalid audio file type")

    contents = await file.read()
    if len(contents) > FILE_SIZE_LIMIT:
        raise HTTPException(status_code=400, detail="File size exceeds 25 MB limit")

    try:
        result = transcribe_for_therapy(
            audio_data=contents,
            filename=file.filename or "audio.wav",
            content_type=file.content_type,
            engine=engine
        )

        return TranscriptionResponse(
            text=result.text,
            engine_used=result.engine_used.value,
            confidence=result.confidence,
            word_timestamps=result.word_timestamps
        )

    except Exception as e:
        logging.error(f"Transcription failed: {e}")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")


@router.post("/tts", tags=["therapy"])
async def text_to_speech(
    request: TTSRequest,
    user: str = Depends(verify_token),
):
    """
    Convert text to speech.

    Returns audio stream (WAV format).
    """
    logging.info(f"TTS request from user: {user}")

    try:
        result = synthesize_speech(
            text=request.text,
            voice=request.voice,
            speed=request.speed
        )

        return StreamingResponse(
            io.BytesIO(result.audio_bytes),
            media_type=f"audio/{result.format}",
            headers={
                "Content-Disposition": f"attachment; filename=speech.{result.format}",
                "X-Engine-Used": result.engine_used.value
            }
        )

    except Exception as e:
        logging.error(f"TTS failed: {e}")
        raise HTTPException(status_code=500, detail=f"TTS failed: {str(e)}")


@router.post("/tts/prompt", tags=["therapy"])
async def generate_therapy_prompt(
    exercise_type: str = Query(..., description="Type: repeat_after_me, pronunciation, slower"),
    target_text: str = Query(..., description="Text to practice"),
    user: str = Depends(verify_token),
):
    """
    Generate audio prompt for therapy exercise.

    Pre-built prompts like "Please repeat after me: [text]"
    """
    logging.info(f"Therapy prompt request: {exercise_type}")

    try:
        tts = get_therapy_tts()
        result = tts.generate_therapy_prompt(exercise_type, target_text)

        return StreamingResponse(
            io.BytesIO(result.audio_bytes),
            media_type=f"audio/{result.format}",
            headers={
                "Content-Disposition": f"attachment; filename=prompt.{result.format}"
            }
        )

    except Exception as e:
        logging.error(f"Prompt generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Prompt generation failed: {str(e)}")


@router.post("/analyze", response_model=PronunciationResponse, tags=["therapy"])
async def analyze_pronunciation_endpoint(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    target_text: str = Query(..., description="Expected text/phrase"),
    include_ai_feedback: bool = Query(True, description="Include GPT-4o AI feedback"),
    user: str = Depends(verify_token),
):
    """
    Analyze pronunciation against target text.

    Returns scores for:
    - Overall pronunciation
    - Clarity
    - Pace
    - Fluency
    Plus per-word feedback, improvement suggestions, and AI-powered personalized feedback.

    AI feedback uses GPT-4o via GitHub Models API for free testing.
    """
    logging.info(f"Pronunciation analysis for user: {user}")

    # Validate file
    if file.content_type not in ALLOWED_AUDIO_TYPES:
        raise HTTPException(status_code=400, detail="Invalid audio file type")

    contents = await file.read()
    if len(contents) > FILE_SIZE_LIMIT:
        raise HTTPException(status_code=400, detail="File size exceeds 25 MB limit")

    try:
        # Now async with AI feedback integration
        feedback = await analyze_pronunciation(
            audio_bytes=contents,
            target_text=target_text,
            include_ai_feedback=include_ai_feedback
        )

        # Build AI feedback response if available
        ai_feedback_response = None
        if feedback.ai_feedback:
            ai_feedback_response = AIFeedbackResponse(
                feedback=feedback.ai_feedback.feedback,
                encouragement=feedback.ai_feedback.encouragement,
                specific_tips=feedback.ai_feedback.specific_tips,
                recommended_exercises=feedback.ai_feedback.recommended_exercises,
                difficulty_adjustment=feedback.ai_feedback.difficulty_adjustment
            )

        return PronunciationResponse(
            overall_score=feedback.overall_score,
            clarity_score=feedback.clarity_score,
            pace_score=feedback.pace_score,
            fluency_score=feedback.fluency_score,
            transcription=feedback.transcription,
            target_text=feedback.target_text,
            suggestions=feedback.suggestions,
            word_scores=[
                {
                    "word": ws.word,
                    "score": ws.score,
                    "errors": [
                        {
                            "type": e.error_type.value,
                            "expected": e.expected,
                            "actual": e.actual,
                            "suggestion": e.suggestion
                        }
                        for e in ws.errors
                    ]
                }
                for ws in feedback.word_scores
            ],
            ai_feedback=ai_feedback_response
        )

    except Exception as e:
        logging.error(f"Pronunciation analysis failed: {e}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


# ============================================================================
# Demo/Test Endpoints (no auth required)
# ============================================================================

@router.get("/demo/exercises", tags=["therapy-demo"])
async def demo_list_exercises():
    """[DEMO] List exercises without auth - returns actual practice exercises."""
    return {
        "exercises": [
            {
                "id": "ex-001",
                "title": "Simple Greetings",
                "category": "repeat_after_me",
                "difficulty": "easy",
                "target_text": "Hello, how are you today?",
                "instructions": "Listen carefully, then repeat the greeting clearly and naturally."
            },
            {
                "id": "ex-002",
                "title": "S Sound Practice",
                "category": "minimal_pairs",
                "difficulty": "medium",
                "target_text": "She sells seashells by the seashore",
                "instructions": "Focus on the 'S' and 'SH' sounds. Speak slowly at first."
            },
            {
                "id": "ex-003",
                "title": "R Sound Challenge",
                "category": "tongue_twisters",
                "difficulty": "hard",
                "target_text": "Red lorry, yellow lorry",
                "instructions": "Practice the 'R' and 'L' sounds. Start slow, then speed up."
            },
            {
                "id": "ex-004",
                "title": "Daily Introduction",
                "category": "repeat_after_me",
                "difficulty": "easy",
                "target_text": "My name is... and I am learning to speak clearly.",
                "instructions": "Replace '...' with your name. Speak with confidence!"
            },
            {
                "id": "ex-005",
                "title": "TH Sound Practice",
                "category": "minimal_pairs",
                "difficulty": "medium",
                "target_text": "Think through these three things thoroughly",
                "instructions": "Place your tongue between your teeth for the 'TH' sound."
            },
            {
                "id": "ex-006",
                "title": "Peter Piper",
                "category": "tongue_twisters",
                "difficulty": "hard",
                "target_text": "Peter Piper picked a peck of pickled peppers",
                "instructions": "Focus on the 'P' sounds. Keep your lips together firmly."
            },
            {
                "id": "ex-007",
                "title": "Counting Practice",
                "category": "repeat_after_me",
                "difficulty": "easy",
                "target_text": "One, two, three, four, five",
                "instructions": "Count clearly and pause briefly between each number."
            },
            {
                "id": "ex-008",
                "title": "W vs V Sounds",
                "category": "minimal_pairs",
                "difficulty": "medium",
                "target_text": "Very well, we will wait",
                "instructions": "Notice the difference: 'V' uses teeth on lip, 'W' uses rounded lips."
            }
        ]
    }


@router.post("/demo/feedback", tags=["therapy-demo"])
async def demo_ai_feedback(
    target_text: str = Query(..., description="Text to practice"),
    transcription: str = Query(..., description="What user said"),
    score: float = Query(75.0, description="Overall score 0-100"),
):
    """[DEMO] Get AI feedback without auth - for testing GPT-4o integration."""
    generator = get_ai_feedback_generator()

    feedback = await generator.generate_feedback(
        target_text=target_text,
        transcription=transcription,
        overall_score=score,
        clarity_score=score - 5,
        pace_score=score + 5,
        fluency_score=score,
        errors=[{
            "word": target_text.split()[0] if target_text else "word",
            "expected": target_text.split()[0] if target_text else "word",
            "actual": transcription.split()[0] if transcription else "word",
            "error_type": "substitution"
        }] if target_text != transcription else [],
        user_context=None
    )

    return {
        "target_text": target_text,
        "transcription": transcription,
        "scores": {
            "overall": score,
            "clarity": score - 5,
            "pace": score + 5,
            "fluency": score
        },
        "ai_feedback": {
            "feedback": feedback.feedback,
            "encouragement": feedback.encouragement,
            "specific_tips": feedback.specific_tips,
            "recommended_exercises": feedback.recommended_exercises,
            "difficulty_adjustment": feedback.difficulty_adjustment
        }
    }


@router.get("/demo/session-summary", tags=["therapy-demo"])
async def demo_session_summary():
    """[DEMO] Get AI session summary without auth."""
    generator = get_ai_feedback_generator()

    summary = await generator.generate_session_summary(
        session_stats={
            "duration_minutes": 12,
            "exercise_count": 6,
            "average_score": 78,
            "best_score": 92,
            "exercise_types": ["repeat_after_me", "minimal_pairs"]
        },
        attempts=[]
    )

    return {"summary": summary}


@router.get("/demo/weekly-insights", tags=["therapy-demo"])
async def demo_weekly_insights():
    """[DEMO] Get AI weekly insights without auth."""
    generator = get_ai_feedback_generator()

    insights = await generator.generate_weekly_insights(
        weekly_data={
            "sessions_this_week": 5,
            "practice_minutes": 40,
            "avg_score": 76,
            "score_change": 6.5,
            "strengths": ["Consistent daily practice", "Good pace control"],
            "weaknesses": ["S sounds", "Word endings"]
        }
    )

    return insights


# ============================================================================
# Authenticated Endpoints
# ============================================================================

@router.get("/exercises", tags=["therapy"])
async def list_exercise_types(
    user: str = Depends(verify_token),
):
    """List available therapy exercise types."""
    return {
        "exercises": [
            {
                "type": "repeat_after_me",
                "name": "Repeat After Me",
                "description": "Listen and repeat the target phrase"
            },
            {
                "type": "minimal_pairs",
                "name": "Minimal Pairs",
                "description": "Practice similar-sounding words (e.g., ship/chip)"
            },
            {
                "type": "tongue_twisters",
                "name": "Tongue Twisters",
                "description": "Practice challenging phrases for fluency"
            },
            {
                "type": "word_chains",
                "name": "Word Chains",
                "description": "Build vocabulary with connected words"
            },
            {
                "type": "sentence_building",
                "name": "Sentence Building",
                "description": "Progress from words to full sentences"
            }
        ]
    }


@router.post("/exercise/evaluate", response_model=PronunciationResponse, tags=["therapy"])
async def evaluate_exercise(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    exercise_type: str = Query(...),
    target_text: str = Query(...),
    include_ai_feedback: bool = Query(True),
    user: str = Depends(verify_token),
):
    """
    Evaluate user's exercise attempt.

    Same as /analyze but tracks exercise context.
    Includes GPT-4o AI feedback for personalized improvement tips.
    """
    # Reuse pronunciation analysis
    return await analyze_pronunciation_endpoint(
        background_tasks=background_tasks,
        file=file,
        target_text=target_text,
        include_ai_feedback=include_ai_feedback,
        user=user
    )


# Session Summary Models
class SessionSummaryRequest(BaseModel):
    """Request for session summary."""
    duration_minutes: int = Field(..., ge=1)
    exercise_count: int = Field(..., ge=1)
    average_score: float = Field(..., ge=0, le=100)
    best_score: float = Field(..., ge=0, le=100)
    exercise_types: list[str] = Field(default_factory=list)


class SessionSummaryResponse(BaseModel):
    """AI-generated session summary."""
    summary: str


class WeeklyInsightsRequest(BaseModel):
    """Request for weekly insights."""
    sessions_this_week: int = Field(..., ge=0)
    practice_minutes: int = Field(..., ge=0)
    avg_score: float = Field(..., ge=0, le=100)
    score_change: float = Field(default=0)  # Percentage change from last week
    strengths: list[str] = Field(default_factory=list)
    weaknesses: list[str] = Field(default_factory=list)


class WeeklyInsightsResponse(BaseModel):
    """AI-generated weekly insights."""
    summary: str
    celebration: str
    focus_area: str
    goal: str


@router.post("/session/summary", response_model=SessionSummaryResponse, tags=["therapy"])
async def get_session_summary(
    request: SessionSummaryRequest,
    user: str = Depends(verify_token),
):
    """
    Generate AI-powered session summary.

    Uses GPT-4o via GitHub Models to create personalized,
    encouraging session summaries.
    """
    logging.info(f"Session summary request from user: {user}")

    try:
        ai_generator = get_ai_feedback_generator()
        summary = await ai_generator.generate_session_summary(
            session_stats={
                "duration_minutes": request.duration_minutes,
                "exercise_count": request.exercise_count,
                "average_score": request.average_score,
                "best_score": request.best_score,
                "exercise_types": request.exercise_types
            },
            attempts=[]  # Can be extended to include attempt history
        )

        return SessionSummaryResponse(summary=summary)

    except Exception as e:
        logging.error(f"Session summary generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Summary generation failed: {str(e)}")


@router.post("/insights/weekly", response_model=WeeklyInsightsResponse, tags=["therapy"])
async def get_weekly_insights(
    request: WeeklyInsightsRequest,
    user: str = Depends(verify_token),
):
    """
    Generate AI-powered weekly progress insights.

    Uses GPT-4o to analyze weekly practice data and provide:
    - Progress summary
    - Celebration of achievements
    - Focus area for next week
    - Realistic goal setting
    """
    logging.info(f"Weekly insights request from user: {user}")

    try:
        ai_generator = get_ai_feedback_generator()
        insights = await ai_generator.generate_weekly_insights(
            weekly_data={
                "sessions_this_week": request.sessions_this_week,
                "practice_minutes": request.practice_minutes,
                "avg_score": request.avg_score,
                "score_change": request.score_change,
                "strengths": request.strengths,
                "weaknesses": request.weaknesses
            }
        )

        return WeeklyInsightsResponse(
            summary=insights.get("summary", ""),
            celebration=insights.get("celebration", ""),
            focus_area=insights.get("focus_area", ""),
            goal=insights.get("goal", "")
        )

    except Exception as e:
        logging.error(f"Weekly insights generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Insights generation failed: {str(e)}")
