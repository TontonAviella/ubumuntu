"""
Therapy TTS Module - Text-to-speech for therapy and AAC applications.

Supports:
- WhisperSpeech (fast, voice cloning)
- OpenAI TTS API (fallback)
- Edge TTS (lightweight fallback)
"""

import io
import logging
from enum import Enum
from typing import Optional
from dataclasses import dataclass

from api.config import settings

if settings.ENVIRONMENT == "development":
    logging.basicConfig(level=logging.DEBUG)
else:
    logging.basicConfig(level=logging.WARNING)


class TTSEngine(str, Enum):
    """Available TTS engines."""
    WHISPERSPEECH = "whisperspeech"
    OPENAI_TTS = "openai_tts"
    EDGE_TTS = "edge_tts"
    AUTO = "auto"


class TTSVoice(str, Enum):
    """Preset voice options."""
    NEUTRAL = "neutral"
    WARM = "warm"
    CLEAR = "clear"
    SLOW = "slow"  # For therapy exercises
    CUSTOM = "custom"  # Voice cloning


@dataclass
class TTSResult:
    """TTS synthesis result."""
    audio_bytes: bytes
    format: str  # wav, mp3
    sample_rate: int
    engine_used: TTSEngine
    duration_seconds: Optional[float] = None


class TherapyTTS:
    """
    TTS engine for therapy applications.

    Features:
    - Voice cloning from reference audio
    - Adjustable speed for therapy exercises
    - Multiple engine support with fallback
    """

    def __init__(self, default_engine: TTSEngine = TTSEngine.AUTO):
        self.default_engine = default_engine
        self._whisperspeech_pipe = None
        self._openai_client = None

    def _get_openai_client(self):
        """Lazy load OpenAI client."""
        if self._openai_client is None:
            from openai import OpenAI
            self._openai_client = OpenAI(api_key=settings.OPENAI_API_KEY)
        return self._openai_client

    def _get_whisperspeech(self):
        """Lazy load WhisperSpeech pipeline."""
        if self._whisperspeech_pipe is None:
            try:
                from whisperspeech.pipeline import Pipeline
                logging.info("Loading WhisperSpeech pipeline...")
                self._whisperspeech_pipe = Pipeline(
                    s2a_ref='collabora/whisperspeech:s2a-q4-tiny-en+pl.model'
                )
                logging.info("WhisperSpeech loaded successfully")
            except ImportError as e:
                logging.warning(f"WhisperSpeech not available: {e}")
                raise
        return self._whisperspeech_pipe

    def _select_engine(self, voice_reference: Optional[bytes] = None) -> TTSEngine:
        """Select TTS engine based on requirements."""
        if self.default_engine != TTSEngine.AUTO:
            return self.default_engine

        # Use WhisperSpeech for voice cloning
        if voice_reference:
            return TTSEngine.WHISPERSPEECH

        # Default to OpenAI for quality
        return TTSEngine.OPENAI_TTS

    def synthesize(
        self,
        text: str,
        voice: TTSVoice = TTSVoice.NEUTRAL,
        speed: float = 1.0,
        voice_reference: Optional[bytes] = None,
        engine: Optional[TTSEngine] = None,
        output_format: str = "wav"
    ) -> TTSResult:
        """
        Synthesize speech from text.

        Args:
            text: Text to synthesize
            voice: Voice preset to use
            speed: Speech rate (0.5 = slow, 1.0 = normal, 2.0 = fast)
            voice_reference: Audio bytes for voice cloning
            engine: Force specific engine
            output_format: Output format (wav, mp3)

        Returns:
            TTSResult with audio bytes
        """
        selected_engine = engine or self._select_engine(voice_reference)
        logging.info(f"Synthesizing with engine: {selected_engine.value}")

        # Fallback chain
        fallback_order = [selected_engine]
        if selected_engine != TTSEngine.OPENAI_TTS:
            fallback_order.append(TTSEngine.OPENAI_TTS)

        last_error = None
        for eng in fallback_order:
            try:
                if eng == TTSEngine.OPENAI_TTS:
                    return self._synthesize_openai(text, voice, speed, output_format)
                elif eng == TTSEngine.WHISPERSPEECH:
                    return self._synthesize_whisperspeech(
                        text, voice_reference, speed, output_format
                    )
                elif eng == TTSEngine.EDGE_TTS:
                    return self._synthesize_edge_tts(text, voice, speed, output_format)
            except Exception as e:
                logging.warning(f"Engine {eng.value} failed: {e}")
                last_error = e
                continue

        raise RuntimeError(f"All TTS engines failed. Last error: {last_error}")

    def _synthesize_openai(
        self,
        text: str,
        voice: TTSVoice,
        speed: float,
        output_format: str
    ) -> TTSResult:
        """Synthesize using OpenAI TTS API."""
        logging.info("Synthesizing with OpenAI TTS")

        client = self._get_openai_client()

        # Map voice presets to OpenAI voices
        voice_map = {
            TTSVoice.NEUTRAL: "alloy",
            TTSVoice.WARM: "nova",
            TTSVoice.CLEAR: "onyx",
            TTSVoice.SLOW: "alloy",  # Use speed parameter
            TTSVoice.CUSTOM: "alloy",
        }

        response = client.audio.speech.create(
            model="tts-1",
            voice=voice_map.get(voice, "alloy"),
            input=text,
            speed=speed,
            response_format="wav" if output_format == "wav" else "mp3"
        )

        audio_bytes = response.content

        return TTSResult(
            audio_bytes=audio_bytes,
            format=output_format,
            sample_rate=24000,
            engine_used=TTSEngine.OPENAI_TTS
        )

    def _synthesize_whisperspeech(
        self,
        text: str,
        voice_reference: Optional[bytes],
        speed: float,
        output_format: str
    ) -> TTSResult:
        """Synthesize using WhisperSpeech with optional voice cloning."""
        logging.info("Synthesizing with WhisperSpeech")

        import torch
        import numpy as np

        pipe = self._get_whisperspeech()

        # Generate audio
        if voice_reference:
            # Voice cloning mode
            import tempfile
            import os

            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
                f.write(voice_reference)
                ref_path = f.name

            try:
                audio = pipe.generate(text, speaker=ref_path)
            finally:
                os.unlink(ref_path)
        else:
            audio = pipe.generate(text)

        # Convert to bytes
        if isinstance(audio, torch.Tensor):
            audio_np = audio.cpu().numpy()
        else:
            audio_np = np.array(audio)

        # Ensure correct shape
        if audio_np.ndim > 1:
            audio_np = audio_np.squeeze()

        # Apply speed adjustment if needed
        if speed != 1.0:
            import librosa
            audio_np = librosa.effects.time_stretch(audio_np, rate=speed)

        # Convert to wav bytes
        import soundfile as sf
        buffer = io.BytesIO()
        sf.write(buffer, audio_np, 24000, format='WAV')
        buffer.seek(0)

        return TTSResult(
            audio_bytes=buffer.read(),
            format="wav",
            sample_rate=24000,
            engine_used=TTSEngine.WHISPERSPEECH,
            duration_seconds=len(audio_np) / 24000
        )

    def _synthesize_edge_tts(
        self,
        text: str,
        voice: TTSVoice,
        speed: float,
        output_format: str
    ) -> TTSResult:
        """Synthesize using Edge TTS (lightweight fallback)."""
        logging.info("Synthesizing with Edge TTS")

        import asyncio
        import edge_tts

        # Map voice presets to Edge TTS voices
        voice_map = {
            TTSVoice.NEUTRAL: "en-US-JennyNeural",
            TTSVoice.WARM: "en-US-AriaNeural",
            TTSVoice.CLEAR: "en-US-GuyNeural",
            TTSVoice.SLOW: "en-US-JennyNeural",
            TTSVoice.CUSTOM: "en-US-JennyNeural",
        }

        async def _generate():
            communicate = edge_tts.Communicate(
                text,
                voice_map.get(voice, "en-US-JennyNeural"),
                rate=f"{int((speed - 1) * 100):+d}%"
            )
            buffer = io.BytesIO()
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    buffer.write(chunk["data"])
            return buffer.getvalue()

        audio_bytes = asyncio.run(_generate())

        return TTSResult(
            audio_bytes=audio_bytes,
            format="mp3",
            sample_rate=24000,
            engine_used=TTSEngine.EDGE_TTS
        )

    def generate_therapy_prompt(
        self,
        exercise_type: str,
        target_text: str,
        **kwargs
    ) -> TTSResult:
        """
        Generate therapy exercise audio prompt.

        Args:
            exercise_type: Type of exercise (repeat_after_me, pronunciation, etc.)
            target_text: The text to practice
            **kwargs: Additional synthesis parameters

        Returns:
            TTSResult with exercise audio
        """
        prompts = {
            "repeat_after_me": f"Please repeat after me: {target_text}",
            "pronunciation": f"Let's practice saying: {target_text}. Listen carefully.",
            "slower": f"Now try saying it more slowly: {target_text}",
            "word_by_word": f"Let's break it down. {target_text}",
            "encouragement": f"Great try! Let's practice {target_text} again.",
        }

        prompt_text = prompts.get(exercise_type, target_text)

        # Use slower speed for therapy prompts
        speed = kwargs.pop("speed", 0.9)

        return self.synthesize(
            text=prompt_text,
            speed=speed,
            voice=TTSVoice.CLEAR,
            **kwargs
        )


# Singleton instance
_therapy_tts_instance: Optional[TherapyTTS] = None


def get_therapy_tts() -> TherapyTTS:
    """Get or create TherapyTTS singleton."""
    global _therapy_tts_instance
    if _therapy_tts_instance is None:
        _therapy_tts_instance = TherapyTTS()
    return _therapy_tts_instance


def synthesize_speech(
    text: str,
    voice: TTSVoice = TTSVoice.NEUTRAL,
    speed: float = 1.0,
    voice_reference: Optional[bytes] = None
) -> TTSResult:
    """Convenience function for TTS synthesis."""
    tts = get_therapy_tts()
    return tts.synthesize(
        text=text,
        voice=voice,
        speed=speed,
        voice_reference=voice_reference
    )
