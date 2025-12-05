"""
Therapy ASR Module - Multi-engine speech recognition for therapy applications.

Supports:
- Local Whisper (general speech, privacy-focused)
- SpeechBrain (fine-tuned for atypical speech)
- OpenAI Whisper API (fallback)
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


class ASREngine(str, Enum):
    """Available ASR engines."""
    WHISPER_LOCAL = "whisper_local"
    SPEECHBRAIN = "speechbrain"
    WHISPER_API = "whisper_api"
    AUTO = "auto"  # Automatically select based on user profile


@dataclass
class TranscriptionResult:
    """Structured transcription result."""
    text: str
    engine_used: ASREngine
    confidence: Optional[float] = None
    word_timestamps: Optional[list] = None
    language: Optional[str] = None


class TherapyASR:
    """
    Multi-engine ASR for therapy applications.

    Supports automatic engine selection based on user speech profile,
    with fallback chain for reliability.
    """

    def __init__(self, default_engine: ASREngine = ASREngine.AUTO):
        self.default_engine = default_engine
        self._whisper_local_model = None
        self._speechbrain_model = None
        self._openai_client = None

    def _get_openai_client(self):
        """Lazy load OpenAI client."""
        if self._openai_client is None:
            from openai import OpenAI
            self._openai_client = OpenAI(api_key=settings.OPENAI_API_KEY)
        return self._openai_client

    def _get_whisper_local(self):
        """Lazy load local Whisper model."""
        if self._whisper_local_model is None:
            try:
                import torch
                from transformers import WhisperProcessor, WhisperForConditionalGeneration

                model_name = "openai/whisper-base"  # Start with base, upgrade as needed
                logging.info(f"Loading local Whisper model: {model_name}")

                self._whisper_processor = WhisperProcessor.from_pretrained(model_name)
                self._whisper_local_model = WhisperForConditionalGeneration.from_pretrained(model_name)

                # Use GPU if available
                if torch.cuda.is_available():
                    self._whisper_local_model = self._whisper_local_model.to("cuda")
                elif torch.backends.mps.is_available():
                    self._whisper_local_model = self._whisper_local_model.to("mps")

                logging.info("Local Whisper model loaded successfully")
            except ImportError as e:
                logging.warning(f"Local Whisper not available: {e}")
                raise
        return self._whisper_local_model

    def _get_speechbrain(self):
        """Lazy load SpeechBrain model for atypical speech."""
        if self._speechbrain_model is None:
            try:
                import speechbrain as sb

                # Use pre-trained model, can be swapped for fine-tuned version
                model_source = "speechbrain/asr-wav2vec2-commonvoice-en"
                logging.info(f"Loading SpeechBrain model: {model_source}")

                self._speechbrain_model = sb.pretrained.EncoderASR.from_hparams(
                    source=model_source,
                    savedir="models/speechbrain_asr"
                )
                logging.info("SpeechBrain model loaded successfully")
            except ImportError as e:
                logging.warning(f"SpeechBrain not available: {e}")
                raise
        return self._speechbrain_model

    def _select_engine(self, user_profile: Optional[dict] = None) -> ASREngine:
        """Select appropriate ASR engine based on user profile."""
        if self.default_engine != ASREngine.AUTO:
            return self.default_engine

        if user_profile:
            # Use SpeechBrain for users with speech conditions
            speech_condition = user_profile.get("speech_condition")
            if speech_condition in ["dysarthria", "apraxia", "autism", "stuttering"]:
                return ASREngine.SPEECHBRAIN

            # Use local Whisper for privacy-focused users
            if user_profile.get("privacy_mode") == "local":
                return ASREngine.WHISPER_LOCAL

        # Default to API for best accuracy
        return ASREngine.WHISPER_API

    def transcribe(
        self,
        audio_data: bytes,
        filename: str = "audio.wav",
        content_type: str = "audio/wav",
        user_profile: Optional[dict] = None,
        engine: Optional[ASREngine] = None
    ) -> TranscriptionResult:
        """
        Transcribe audio using the most appropriate engine.

        Args:
            audio_data: Raw audio bytes
            filename: Original filename
            content_type: MIME type of audio
            user_profile: Optional user profile for engine selection
            engine: Force specific engine (overrides auto-selection)

        Returns:
            TranscriptionResult with text and metadata
        """
        selected_engine = engine or self._select_engine(user_profile)
        logging.info(f"Transcribing with engine: {selected_engine.value}")

        # Try selected engine with fallback chain
        fallback_order = [selected_engine]
        if selected_engine != ASREngine.WHISPER_API:
            fallback_order.append(ASREngine.WHISPER_API)

        last_error = None
        for eng in fallback_order:
            try:
                if eng == ASREngine.WHISPER_API:
                    return self._transcribe_whisper_api(audio_data, filename, content_type)
                elif eng == ASREngine.WHISPER_LOCAL:
                    return self._transcribe_whisper_local(audio_data)
                elif eng == ASREngine.SPEECHBRAIN:
                    return self._transcribe_speechbrain(audio_data)
            except Exception as e:
                logging.warning(f"Engine {eng.value} failed: {e}")
                last_error = e
                continue

        raise RuntimeError(f"All ASR engines failed. Last error: {last_error}")

    def _transcribe_whisper_api(
        self,
        audio_data: bytes,
        filename: str,
        content_type: str
    ) -> TranscriptionResult:
        """Transcribe using OpenAI Whisper API."""
        logging.info("Transcribing with OpenAI Whisper API")

        client = self._get_openai_client()
        file_data = (filename, audio_data, content_type)

        transcription = client.audio.transcriptions.create(
            model="whisper-1",
            file=file_data,
            response_format="verbose_json",
            timestamp_granularities=["word"]
        )

        # Extract word timestamps if available
        word_timestamps = None
        if hasattr(transcription, 'words'):
            word_timestamps = [
                {"word": w.word, "start": w.start, "end": w.end}
                for w in transcription.words
            ]

        return TranscriptionResult(
            text=transcription.text,
            engine_used=ASREngine.WHISPER_API,
            language=getattr(transcription, 'language', None),
            word_timestamps=word_timestamps
        )

    def _transcribe_whisper_local(self, audio_data: bytes) -> TranscriptionResult:
        """Transcribe using local Whisper model."""
        logging.info("Transcribing with local Whisper")

        import torch
        import librosa
        import numpy as np

        model = self._get_whisper_local()

        # Load audio from bytes
        audio_array, sr = librosa.load(io.BytesIO(audio_data), sr=16000)

        # Process audio
        input_features = self._whisper_processor(
            audio_array,
            sampling_rate=16000,
            return_tensors="pt"
        ).input_features

        # Move to same device as model
        device = next(model.parameters()).device
        input_features = input_features.to(device)

        # Generate transcription
        with torch.no_grad():
            predicted_ids = model.generate(input_features)

        transcription = self._whisper_processor.batch_decode(
            predicted_ids,
            skip_special_tokens=True
        )[0]

        return TranscriptionResult(
            text=transcription.strip(),
            engine_used=ASREngine.WHISPER_LOCAL
        )

    def _transcribe_speechbrain(self, audio_data: bytes) -> TranscriptionResult:
        """Transcribe using SpeechBrain (optimized for atypical speech)."""
        logging.info("Transcribing with SpeechBrain")

        import tempfile
        import os

        model = self._get_speechbrain()

        # SpeechBrain requires file path, write temp file
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            f.write(audio_data)
            temp_path = f.name

        try:
            transcription = model.transcribe_file(temp_path)

            # Handle different return types
            if isinstance(transcription, list):
                text = transcription[0] if transcription else ""
            else:
                text = str(transcription)

            return TranscriptionResult(
                text=text.strip(),
                engine_used=ASREngine.SPEECHBRAIN
            )
        finally:
            os.unlink(temp_path)


# Singleton instance for reuse
_therapy_asr_instance: Optional[TherapyASR] = None


def get_therapy_asr() -> TherapyASR:
    """Get or create TherapyASR singleton."""
    global _therapy_asr_instance
    if _therapy_asr_instance is None:
        _therapy_asr_instance = TherapyASR()
    return _therapy_asr_instance


def transcribe_for_therapy(
    audio_data: bytes,
    filename: str = "audio.wav",
    content_type: str = "audio/wav",
    user_profile: Optional[dict] = None,
    engine: Optional[ASREngine] = None
) -> TranscriptionResult:
    """
    Convenience function to transcribe audio for therapy.

    This is the main entry point for therapy transcription.
    """
    asr = get_therapy_asr()
    return asr.transcribe(
        audio_data=audio_data,
        filename=filename,
        content_type=content_type,
        user_profile=user_profile,
        engine=engine
    )
