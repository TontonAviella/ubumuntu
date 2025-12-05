"""
AI Feedback Module - GPT-4o powered speech therapy feedback.

Uses GitHub Models API for GPT-4o access.
"""

import os
import json
import logging
from typing import Optional, List
from dataclasses import dataclass

from openai import OpenAI

logger = logging.getLogger(__name__)


@dataclass
class AIFeedbackResult:
    """AI-generated feedback for speech therapy."""
    feedback: str
    encouragement: str
    specific_tips: List[str]
    recommended_exercises: List[str]
    difficulty_adjustment: Optional[str]  # "easier", "same", "harder"


class AIFeedbackGenerator:
    """
    Generate personalized speech therapy feedback using GPT-4o.

    Uses GitHub Models API (free for GitHub users).
    """

    def __init__(self):
        self.client: Optional[OpenAI] = None
        self.model = "gpt-4o"
        self._initialize_client()

    def _initialize_client(self):
        """Initialize the OpenAI client with GitHub Models."""
        github_token = os.getenv("GITHUB_TOKEN")

        if not github_token:
            raise ValueError(
                "GITHUB_TOKEN not found. Please set it in your .env file. "
                "Get your token at: https://github.com/settings/tokens"
            )

        # Use GitHub Models (free GPT-4o access)
        self.client = OpenAI(
            base_url="https://models.inference.ai.azure.com",
            api_key=github_token,
        )
        self.model = "gpt-4o"
        logger.info("AI Feedback: Using GitHub Models (GPT-4o)")

    async def generate_feedback(
        self,
        target_text: str,
        transcription: str,
        overall_score: float,
        clarity_score: float,
        pace_score: float,
        fluency_score: float,
        errors: List[dict],
        user_context: Optional[dict] = None
    ) -> AIFeedbackResult:
        """
        Generate personalized feedback for a speech exercise attempt.

        Args:
            target_text: The text the user was supposed to say
            transcription: What the ASR heard
            overall_score: 0-100 overall score
            clarity_score: 0-100 clarity score
            pace_score: 0-100 pace score
            fluency_score: 0-100 fluency score
            errors: List of pronunciation errors detected
            user_context: Optional user profile info (speech condition, etc.)

        Returns:
            AIFeedbackResult with personalized feedback
        """
        # Build context about user if available
        user_info = ""
        if user_context:
            condition = user_context.get("speech_condition", "")
            severity = user_context.get("severity_level", "")
            if condition:
                user_info = f"\nUser has {condition}"
                if severity:
                    user_info += f" (severity: {severity}/5)"
                user_info += ". Adjust feedback accordingly."

        # Format errors for the prompt
        error_summary = ""
        if errors:
            error_items = []
            for e in errors[:5]:  # Limit to 5 errors
                error_items.append(
                    f"- '{e.get('expected', '')}' → '{e.get('actual', '')}' ({e.get('error_type', '')})"
                )
            error_summary = "\n".join(error_items)

        system_prompt = """You are a supportive, encouraging speech therapist helping users improve their speech clarity.

Your feedback should be:
- Warm and encouraging, never discouraging
- Specific and actionable
- Age-appropriate and easy to understand
- Focused on progress, not perfection

Always acknowledge effort and provide constructive guidance."""

        user_prompt = f"""Please provide feedback for this speech exercise attempt:

**Target phrase:** "{target_text}"
**User said:** "{transcription}"

**Scores:**
- Overall: {overall_score:.0f}/100
- Clarity: {clarity_score:.0f}/100
- Pace: {pace_score:.0f}/100
- Fluency: {fluency_score:.0f}/100

**Pronunciation differences:**
{error_summary if error_summary else "No major differences detected"}
{user_info}

Please respond in this JSON format:
{{
    "feedback": "2-3 sentences of overall feedback",
    "encouragement": "A short encouraging message",
    "specific_tips": ["tip 1", "tip 2", "tip 3"],
    "recommended_exercises": ["exercise 1", "exercise 2"],
    "difficulty_adjustment": "easier" or "same" or "harder"
}}"""

        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.7,
            max_tokens=500,
            response_format={"type": "json_object"}
        )

        # Parse the response
        result = json.loads(response.choices[0].message.content)

        return AIFeedbackResult(
            feedback=result.get("feedback", "Good effort! Keep practicing."),
            encouragement=result.get("encouragement", "You're making progress!"),
            specific_tips=result.get("specific_tips", []),
            recommended_exercises=result.get("recommended_exercises", []),
            difficulty_adjustment=result.get("difficulty_adjustment", "same")
        )

    async def generate_session_summary(
        self,
        session_stats: dict,
        attempts: List[dict]
    ) -> str:
        """Generate an AI summary of a therapy session."""
        prompt = f"""Summarize this speech therapy session for the user:

**Session Stats:**
- Duration: {session_stats.get('duration_minutes', 0)} minutes
- Exercises completed: {session_stats.get('exercise_count', 0)}
- Average score: {session_stats.get('average_score', 0):.0f}/100
- Best score: {session_stats.get('best_score', 0):.0f}/100

**Exercise Types Practiced:** {', '.join(session_stats.get('exercise_types', []))}

Please provide a brief, encouraging 2-3 sentence summary of their session."""

        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": "You are a supportive speech therapist providing session summaries."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=150
        )

        return response.choices[0].message.content

    async def generate_weekly_insights(
        self,
        weekly_data: dict
    ) -> dict:
        """Generate AI-powered weekly progress insights."""
        prompt = f"""Analyze this user's weekly speech therapy progress:

**This Week:**
- Sessions: {weekly_data.get('sessions_this_week', 0)}
- Total practice time: {weekly_data.get('practice_minutes', 0)} minutes
- Average score: {weekly_data.get('avg_score', 0):.0f}/100
- Score change from last week: {weekly_data.get('score_change', 0):+.1f}%

**Strengths:** {', '.join(weekly_data.get('strengths', ['Consistent practice']))}
**Areas to improve:** {', '.join(weekly_data.get('weaknesses', ['Continue practicing']))}

Provide a JSON response with:
{{
    "summary": "2-3 sentence progress summary",
    "celebration": "Something specific to celebrate",
    "focus_area": "One specific thing to focus on next week",
    "goal": "A realistic goal for next week"
}}"""

        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": "You are an encouraging speech therapist analyzing weekly progress."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=300,
            response_format={"type": "json_object"}
        )

        return json.loads(response.choices[0].message.content)


# Singleton instance
_feedback_generator: Optional[AIFeedbackGenerator] = None


def get_ai_feedback_generator() -> AIFeedbackGenerator:
    """Get or create AIFeedbackGenerator singleton."""
    global _feedback_generator
    if _feedback_generator is None:
        _feedback_generator = AIFeedbackGenerator()
    return _feedback_generator
