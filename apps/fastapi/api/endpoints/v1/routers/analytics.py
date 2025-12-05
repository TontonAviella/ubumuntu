"""
Analytics Router - Progress tracking and reporting endpoints.

Endpoints:
- GET /analytics/summary - User progress summary
- GET /analytics/detailed - Detailed metrics for therapist view
- GET /analytics/trends - Progress trends over time
- GET /analytics/recommendations - AI-powered recommendations
"""

import logging
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from api.config import settings
from api.endpoints.v1.auth.verify import verify_token

router = APIRouter()

if settings.ENVIRONMENT == "development":
    logging.basicConfig(level=logging.DEBUG)
else:
    logging.basicConfig(level=logging.WARNING)


# ============================================================================
# Response Models
# ============================================================================

class ProgressSummary(BaseModel):
    """Summary of user's therapy progress."""
    total_sessions: int
    total_exercises: int
    total_practice_minutes: int
    current_streak_days: int
    average_score: float
    improvement_percent: float
    last_session_date: Optional[str]
    top_achievements: list[str]


class MetricTrend(BaseModel):
    """Single metric trend data point."""
    date: str
    value: float
    metric_type: str


class DetailedProgress(BaseModel):
    """Detailed progress for therapist view."""
    user_id: str
    period_days: int

    # Core metrics
    pcc_current: float  # Percent Consonants Correct
    pcc_baseline: float
    pcc_improvement: float

    pwc_current: float  # Percent Words Correct
    pwc_baseline: float
    pwc_improvement: float

    clarity_current: float
    clarity_baseline: float
    clarity_improvement: float

    # Session stats
    sessions_completed: int
    exercises_completed: int
    total_practice_minutes: int

    # Problem areas
    problem_phonemes: list[str]
    improving_phonemes: list[str]

    # Recommendations
    recommendations: list[str]


class ExerciseStats(BaseModel):
    """Statistics for a specific exercise type."""
    exercise_type: str
    attempts: int
    average_score: float
    best_score: float
    improvement: float
    last_attempted: Optional[str]


class Recommendation(BaseModel):
    """AI-generated recommendation."""
    category: str  # exercise, frequency, focus_area
    title: str
    description: str
    priority: int  # 1=high, 2=medium, 3=low
    action_type: Optional[str]  # specific exercise to try


# ============================================================================
# Mock Data Functions (Replace with DB queries)
# ============================================================================

def _get_mock_summary(user_id: str, days: int) -> ProgressSummary:
    """Generate mock summary data. Replace with DB queries."""
    return ProgressSummary(
        total_sessions=23,
        total_exercises=156,
        total_practice_minutes=287,
        current_streak_days=5,
        average_score=72.5,
        improvement_percent=15.3,
        last_session_date=datetime.now().strftime("%Y-%m-%d"),
        top_achievements=[
            "Completed 20+ sessions",
            "5-day practice streak",
            "Mastered 'S' sound"
        ]
    )


def _get_mock_detailed(user_id: str, days: int) -> DetailedProgress:
    """Generate mock detailed data. Replace with DB queries."""
    return DetailedProgress(
        user_id=user_id,
        period_days=days,
        pcc_current=78.5,
        pcc_baseline=65.0,
        pcc_improvement=13.5,
        pwc_current=82.0,
        pwc_baseline=70.0,
        pwc_improvement=12.0,
        clarity_current=75.0,
        clarity_baseline=62.0,
        clarity_improvement=13.0,
        sessions_completed=23,
        exercises_completed=156,
        total_practice_minutes=287,
        problem_phonemes=["th", "r", "l"],
        improving_phonemes=["s", "ch", "sh"],
        recommendations=[
            "Focus on 'th' sound with tongue placement exercises",
            "Increase practice frequency to 15 min/day",
            "Try minimal pairs: 'think/sink', 'three/free'"
        ]
    )


def _get_mock_trends(user_id: str, days: int, metric: str) -> list[MetricTrend]:
    """Generate mock trend data. Replace with DB queries."""
    trends = []
    base_date = datetime.now()
    base_value = 65.0

    for i in range(min(days, 30)):
        date = base_date - timedelta(days=days - i - 1)
        # Simulate gradual improvement
        value = base_value + (i * 0.5) + (i % 3 - 1)
        trends.append(MetricTrend(
            date=date.strftime("%Y-%m-%d"),
            value=round(min(100, max(0, value)), 1),
            metric_type=metric
        ))

    return trends


def _get_mock_exercise_stats(user_id: str) -> list[ExerciseStats]:
    """Generate mock exercise stats. Replace with DB queries."""
    return [
        ExerciseStats(
            exercise_type="repeat_after_me",
            attempts=45,
            average_score=74.5,
            best_score=92.0,
            improvement=12.3,
            last_attempted=datetime.now().strftime("%Y-%m-%d")
        ),
        ExerciseStats(
            exercise_type="minimal_pairs",
            attempts=32,
            average_score=68.0,
            best_score=85.0,
            improvement=8.5,
            last_attempted=(datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
        ),
        ExerciseStats(
            exercise_type="tongue_twisters",
            attempts=18,
            average_score=62.5,
            best_score=78.0,
            improvement=5.2,
            last_attempted=(datetime.now() - timedelta(days=2)).strftime("%Y-%m-%d")
        ),
    ]


def _generate_recommendations(user_id: str) -> list[Recommendation]:
    """Generate AI-powered recommendations. Replace with ML model."""
    return [
        Recommendation(
            category="focus_area",
            title="Focus on 'TH' Sound",
            description="Your 'th' pronunciation scores are 15% below average. Try placing your tongue between your teeth.",
            priority=1,
            action_type="minimal_pairs"
        ),
        Recommendation(
            category="frequency",
            title="Increase Practice Time",
            description="Users who practice 15+ minutes daily see 2x faster improvement. You're averaging 10 minutes.",
            priority=2,
            action_type=None
        ),
        Recommendation(
            category="exercise",
            title="Try Tongue Twisters",
            description="Tongue twisters can help with your 'S' and 'SH' sounds. Start with 'She sells seashells'.",
            priority=2,
            action_type="tongue_twisters"
        ),
    ]


# ============================================================================
# Endpoints
# ============================================================================

@router.get("/summary", response_model=ProgressSummary, tags=["analytics"])
async def get_progress_summary(
    days: int = Query(default=30, ge=1, le=365, description="Period in days"),
    user: str = Depends(verify_token),
):
    """
    Get user's progress summary.

    Returns high-level stats suitable for the user dashboard.
    """
    logging.info(f"Progress summary request for user: {user}, days: {days}")

    # TODO: Replace with actual DB query
    return _get_mock_summary(user, days)


@router.get("/detailed", response_model=DetailedProgress, tags=["analytics"])
async def get_detailed_progress(
    days: int = Query(default=30, ge=1, le=365),
    user: str = Depends(verify_token),
):
    """
    Get detailed progress metrics.

    Returns comprehensive metrics suitable for therapist review.
    Includes PCC, PWC, clarity scores, and improvement tracking.
    """
    logging.info(f"Detailed progress request for user: {user}")

    # TODO: Replace with actual DB query
    return _get_mock_detailed(user, days)


@router.get("/trends", response_model=list[MetricTrend], tags=["analytics"])
async def get_progress_trends(
    metric: str = Query(
        default="overall",
        description="Metric type: overall, clarity, pace, pcc, pwc"
    ),
    days: int = Query(default=30, ge=7, le=365),
    user: str = Depends(verify_token),
):
    """
    Get progress trends over time.

    Returns time-series data for charting progress.
    """
    logging.info(f"Trends request for user: {user}, metric: {metric}")

    valid_metrics = ["overall", "clarity", "pace", "pcc", "pwc", "fluency"]
    if metric not in valid_metrics:
        metric = "overall"

    # TODO: Replace with actual DB query
    return _get_mock_trends(user, days, metric)


@router.get("/exercises", response_model=list[ExerciseStats], tags=["analytics"])
async def get_exercise_stats(
    user: str = Depends(verify_token),
):
    """
    Get statistics for each exercise type.

    Shows which exercises the user has tried and their performance.
    """
    logging.info(f"Exercise stats request for user: {user}")

    # TODO: Replace with actual DB query
    return _get_mock_exercise_stats(user)


@router.get("/recommendations", response_model=list[Recommendation], tags=["analytics"])
async def get_recommendations(
    user: str = Depends(verify_token),
):
    """
    Get AI-powered recommendations.

    Analyzes user's progress and suggests focus areas, exercises, and practice tips.
    """
    logging.info(f"Recommendations request for user: {user}")

    # TODO: Replace with ML model
    return _generate_recommendations(user)


@router.get("/streak", tags=["analytics"])
async def get_streak_info(
    user: str = Depends(verify_token),
):
    """
    Get practice streak information.

    Returns current streak, best streak, and streak history.
    """
    logging.info(f"Streak info request for user: {user}")

    # TODO: Replace with actual DB query
    return {
        "current_streak": 5,
        "best_streak": 12,
        "streak_history": [
            {"start": "2024-11-20", "end": "2024-12-01", "days": 12},
            {"start": "2024-12-03", "end": "2024-12-05", "days": 3},
            {"start": "2024-12-01", "end": None, "days": 5},  # Current
        ],
        "next_milestone": 7,
        "days_to_milestone": 2
    }


@router.get("/leaderboard", tags=["analytics"])
async def get_leaderboard(
    period: str = Query(default="week", description="week, month, all"),
    user: str = Depends(verify_token),
):
    """
    Get anonymized leaderboard.

    Optional gamification feature showing relative standing.
    """
    logging.info(f"Leaderboard request for period: {period}")

    # TODO: Replace with actual DB query
    return {
        "user_rank": 15,
        "total_users": 127,
        "percentile": 88,
        "top_10": [
            {"rank": 1, "score": 95.2, "exercises": 234},
            {"rank": 2, "score": 93.8, "exercises": 198},
            {"rank": 3, "score": 91.5, "exercises": 212},
        ]
    }
