"""
Pronunciation Analysis Module - Speech clarity and pronunciation feedback.

Provides:
- Pronunciation scoring (PCC - Percent Consonants Correct)
- Clarity assessment
- Pace analysis
- Per-word feedback
- Improvement suggestions
"""

import io
import logging
from typing import Optional, List
from dataclasses import dataclass, field
from enum import Enum

from api.config import settings

if settings.ENVIRONMENT == "development":
    logging.basicConfig(level=logging.DEBUG)
else:
    logging.basicConfig(level=logging.WARNING)


class ErrorType(str, Enum):
    """Types of pronunciation errors."""
    SUBSTITUTION = "substitution"  # Wrong sound
    OMISSION = "omission"          # Missing sound
    ADDITION = "addition"          # Extra sound
    DISTORTION = "distortion"      # Unclear sound


@dataclass
class PhonemeError:
    """Individual phoneme-level error."""
    word: str
    position: int  # Position in word
    expected: str
    actual: Optional[str]
    error_type: ErrorType
    suggestion: str


@dataclass
class WordScore:
    """Per-word pronunciation score."""
    word: str
    score: float  # 0-100
    start_time: Optional[float] = None
    end_time: Optional[float] = None
    errors: List[PhonemeError] = field(default_factory=list)


@dataclass
class AIFeedback:
    """AI-generated personalized feedback."""
    feedback: str
    encouragement: str
    specific_tips: List[str]
    recommended_exercises: List[str]
    difficulty_adjustment: Optional[str] = None  # "easier", "same", "harder"


@dataclass
class PronunciationFeedback:
    """Complete pronunciation analysis result."""
    overall_score: float           # 0-100
    clarity_score: float           # 0-100
    pace_score: float              # 0-100
    fluency_score: float           # 0-100
    word_scores: List[WordScore]
    suggestions: List[str]
    phoneme_errors: List[PhonemeError]
    transcription: str
    target_text: str
    duration_seconds: Optional[float] = None
    ai_feedback: Optional[AIFeedback] = None  # GPT-4o powered feedback


class PronunciationAnalyzer:
    """
    Analyze pronunciation against target text.

    Uses ASR with forced alignment to compare user speech
    against expected pronunciation. Integrates GPT-4o for
    personalized feedback via GitHub Models API.
    """

    def __init__(self):
        self._asr = None
        self._ai_feedback = None

    def _get_ai_feedback_generator(self):
        """Get AI feedback generator instance."""
        if self._ai_feedback is None:
            from api.endpoints.v1.processing.ai_feedback import get_ai_feedback_generator
            self._ai_feedback = get_ai_feedback_generator()
        return self._ai_feedback

    def _get_asr(self):
        """Get ASR instance for transcription."""
        if self._asr is None:
            from api.endpoints.v1.processing.therapy_asr import get_therapy_asr
            self._asr = get_therapy_asr()
        return self._asr

    async def analyze(
        self,
        audio_bytes: bytes,
        target_text: str,
        user_baseline: Optional[dict] = None,
        user_context: Optional[dict] = None,
        include_ai_feedback: bool = True
    ) -> PronunciationFeedback:
        """
        Analyze pronunciation of audio against target text.

        Args:
            audio_bytes: User's recorded audio
            target_text: Expected text/phrase
            user_baseline: Optional baseline metrics for comparison
            user_context: Optional user profile (speech condition, severity)
            include_ai_feedback: Whether to generate GPT-4o feedback

        Returns:
            PronunciationFeedback with scores, suggestions, and AI feedback
        """
        logging.info(f"Analyzing pronunciation for target: {target_text}")

        # 1. Transcribe the audio
        asr = self._get_asr()
        result = asr.transcribe(audio_bytes)
        transcription = result.text.strip().lower()
        target_clean = target_text.strip().lower()

        logging.debug(f"Transcription: {transcription}")
        logging.debug(f"Target: {target_clean}")

        # 2. Compare transcription to target
        word_scores, phoneme_errors = self._compare_texts(
            transcription, target_clean
        )

        # 3. Calculate scores
        overall_score = self._calculate_overall_score(word_scores)
        clarity_score = self._calculate_clarity_score(word_scores, phoneme_errors)
        pace_score = self._calculate_pace_score(result.word_timestamps)
        fluency_score = self._calculate_fluency_score(transcription, target_clean)

        # 4. Generate rule-based suggestions
        suggestions = self._generate_suggestions(phoneme_errors, word_scores)

        # 5. Generate AI-powered feedback (GPT-4o via GitHub Models)
        ai_feedback = None
        if include_ai_feedback:
            try:
                ai_generator = self._get_ai_feedback_generator()
                # Convert phoneme errors to dict format for AI
                errors_dict = [
                    {
                        "word": e.word,
                        "expected": e.expected,
                        "actual": e.actual,
                        "error_type": e.error_type.value
                    }
                    for e in phoneme_errors
                ]

                ai_result = await ai_generator.generate_feedback(
                    target_text=target_text,
                    transcription=transcription,
                    overall_score=overall_score,
                    clarity_score=clarity_score,
                    pace_score=pace_score,
                    fluency_score=fluency_score,
                    errors=errors_dict,
                    user_context=user_context
                )

                ai_feedback = AIFeedback(
                    feedback=ai_result.feedback,
                    encouragement=ai_result.encouragement,
                    specific_tips=ai_result.specific_tips,
                    recommended_exercises=ai_result.recommended_exercises,
                    difficulty_adjustment=ai_result.difficulty_adjustment
                )
                logging.info("AI feedback generated successfully")
            except Exception as e:
                logging.warning(f"AI feedback generation failed: {e}")
                ai_feedback = None

        return PronunciationFeedback(
            overall_score=overall_score,
            clarity_score=clarity_score,
            pace_score=pace_score,
            fluency_score=fluency_score,
            word_scores=word_scores,
            suggestions=suggestions,
            phoneme_errors=phoneme_errors,
            transcription=transcription,
            target_text=target_text,
            ai_feedback=ai_feedback
        )

    def _compare_texts(
        self,
        transcription: str,
        target: str
    ) -> tuple[List[WordScore], List[PhonemeError]]:
        """Compare transcribed text to target text."""
        trans_words = transcription.split()
        target_words = target.split()

        word_scores = []
        phoneme_errors = []

        # Simple word-level comparison (can be enhanced with phoneme alignment)
        max_len = max(len(trans_words), len(target_words))

        for i in range(max_len):
            target_word = target_words[i] if i < len(target_words) else ""
            trans_word = trans_words[i] if i < len(trans_words) else ""

            if not target_word:
                # Extra word in transcription
                phoneme_errors.append(PhonemeError(
                    word=trans_word,
                    position=i,
                    expected="",
                    actual=trans_word,
                    error_type=ErrorType.ADDITION,
                    suggestion=f"Extra word '{trans_word}' detected"
                ))
                continue

            if not trans_word:
                # Missing word
                word_scores.append(WordScore(
                    word=target_word,
                    score=0.0,
                    errors=[PhonemeError(
                        word=target_word,
                        position=i,
                        expected=target_word,
                        actual=None,
                        error_type=ErrorType.OMISSION,
                        suggestion=f"Try to include the word '{target_word}'"
                    )]
                ))
                phoneme_errors.append(word_scores[-1].errors[0])
                continue

            # Compare words
            score, errors = self._compare_words(target_word, trans_word, i)
            word_scores.append(WordScore(
                word=target_word,
                score=score,
                errors=errors
            ))
            phoneme_errors.extend(errors)

        return word_scores, phoneme_errors

    def _compare_words(
        self,
        target_word: str,
        trans_word: str,
        position: int
    ) -> tuple[float, List[PhonemeError]]:
        """Compare two words and return score and errors."""
        errors = []

        # Exact match
        if target_word == trans_word:
            return 100.0, []

        # Calculate similarity (simple Levenshtein-based)
        similarity = self._word_similarity(target_word, trans_word)
        score = similarity * 100

        # Detect error type
        if len(trans_word) > len(target_word):
            error_type = ErrorType.ADDITION
            suggestion = f"'{trans_word}' has extra sounds, expected '{target_word}'"
        elif len(trans_word) < len(target_word):
            error_type = ErrorType.OMISSION
            suggestion = f"Some sounds missing in '{trans_word}', expected '{target_word}'"
        else:
            error_type = ErrorType.SUBSTITUTION
            suggestion = f"'{trans_word}' should be '{target_word}'"

        if score < 100:
            errors.append(PhonemeError(
                word=target_word,
                position=position,
                expected=target_word,
                actual=trans_word,
                error_type=error_type,
                suggestion=suggestion
            ))

        return score, errors

    def _word_similarity(self, word1: str, word2: str) -> float:
        """Calculate similarity between two words (0-1)."""
        if word1 == word2:
            return 1.0

        # Levenshtein distance normalized
        len1, len2 = len(word1), len(word2)
        if len1 == 0 or len2 == 0:
            return 0.0

        # Create distance matrix
        dp = [[0] * (len2 + 1) for _ in range(len1 + 1)]

        for i in range(len1 + 1):
            dp[i][0] = i
        for j in range(len2 + 1):
            dp[0][j] = j

        for i in range(1, len1 + 1):
            for j in range(1, len2 + 1):
                cost = 0 if word1[i-1] == word2[j-1] else 1
                dp[i][j] = min(
                    dp[i-1][j] + 1,      # deletion
                    dp[i][j-1] + 1,      # insertion
                    dp[i-1][j-1] + cost  # substitution
                )

        distance = dp[len1][len2]
        max_len = max(len1, len2)

        return 1.0 - (distance / max_len)

    def _calculate_overall_score(self, word_scores: List[WordScore]) -> float:
        """Calculate overall pronunciation score."""
        if not word_scores:
            return 0.0
        return sum(ws.score for ws in word_scores) / len(word_scores)

    def _calculate_clarity_score(
        self,
        word_scores: List[WordScore],
        errors: List[PhonemeError]
    ) -> float:
        """Calculate speech clarity score."""
        if not word_scores:
            return 0.0

        # Penalize based on error types
        error_penalties = {
            ErrorType.DISTORTION: 15,
            ErrorType.SUBSTITUTION: 10,
            ErrorType.OMISSION: 20,
            ErrorType.ADDITION: 5,
        }

        base_score = 100.0
        for error in errors:
            base_score -= error_penalties.get(error.error_type, 10)

        return max(0.0, base_score)

    def _calculate_pace_score(
        self,
        word_timestamps: Optional[List[dict]]
    ) -> float:
        """Calculate pace/timing score."""
        if not word_timestamps or len(word_timestamps) < 2:
            return 75.0  # Default score if no timestamps

        # Calculate words per minute
        total_duration = word_timestamps[-1].get("end", 0) - word_timestamps[0].get("start", 0)
        if total_duration <= 0:
            return 75.0

        wpm = (len(word_timestamps) / total_duration) * 60

        # Ideal range: 100-150 WPM for clear speech
        if 100 <= wpm <= 150:
            return 100.0
        elif 80 <= wpm < 100 or 150 < wpm <= 180:
            return 85.0
        elif 60 <= wpm < 80 or 180 < wpm <= 200:
            return 70.0
        else:
            return 50.0

    def _calculate_fluency_score(self, transcription: str, target: str) -> float:
        """Calculate fluency based on text similarity."""
        return self._word_similarity(transcription, target) * 100

    def _generate_suggestions(
        self,
        errors: List[PhonemeError],
        word_scores: List[WordScore]
    ) -> List[str]:
        """Generate actionable improvement suggestions."""
        suggestions = []

        # Group errors by type
        error_types = {}
        for error in errors:
            error_types.setdefault(error.error_type, []).append(error)

        # Generate suggestions based on error patterns
        if ErrorType.OMISSION in error_types:
            omissions = error_types[ErrorType.OMISSION]
            words = [e.word for e in omissions[:3]]
            suggestions.append(
                f"Try to pronounce all sounds in: {', '.join(words)}"
            )

        if ErrorType.SUBSTITUTION in error_types:
            subs = error_types[ErrorType.SUBSTITUTION]
            if subs:
                suggestions.append(
                    f"Focus on the correct sound in '{subs[0].word}'"
                )

        if ErrorType.ADDITION in error_types:
            suggestions.append("Speak more clearly without adding extra sounds")

        # Low scoring words
        low_scores = [ws for ws in word_scores if ws.score < 70]
        if low_scores:
            words = [ws.word for ws in low_scores[:3]]
            suggestions.append(
                f"Practice these words: {', '.join(words)}"
            )

        # General encouragement if few errors
        if len(errors) <= 2:
            suggestions.append("Good job! Keep practicing for even better clarity.")

        return suggestions[:5]  # Limit to 5 suggestions


# Singleton instance
_analyzer_instance: Optional[PronunciationAnalyzer] = None


def get_pronunciation_analyzer() -> PronunciationAnalyzer:
    """Get or create PronunciationAnalyzer singleton."""
    global _analyzer_instance
    if _analyzer_instance is None:
        _analyzer_instance = PronunciationAnalyzer()
    return _analyzer_instance


async def analyze_pronunciation(
    audio_bytes: bytes,
    target_text: str,
    user_baseline: Optional[dict] = None,
    user_context: Optional[dict] = None,
    include_ai_feedback: bool = True
) -> PronunciationFeedback:
    """Convenience function for pronunciation analysis with AI feedback."""
    analyzer = get_pronunciation_analyzer()
    return await analyzer.analyze(
        audio_bytes,
        target_text,
        user_baseline,
        user_context,
        include_ai_feedback
    )
