import os
import asyncio
from speechmatics.models import ConnectionSettings, TranscriptionConfig, AudioSettings
from speechmatics.client import SpeechmaticsClient
from dotenv import load_dotenv

load_dotenv()

# Setup connection to Speechmatics 2026 Cloud
# Pro Tip: Using the 'low_delay' operating point for the fastest possible response
CONNECTION_SETTINGS = ConnectionSettings(
    url="wss://eu2.rt.speechmatics.io/v2", 
    auth_token=os.getenv("SPEECHMATICS_API_KEY"),
)

class BridgeAudioEngine:
    def __init__(self, asl_callback):
        self.client = SpeechmaticsClient(CONNECTION_SETTINGS)
        self.asl_callback = asl_callback # This triggers Gemini -> Avatar

    def _on_transcript(self, message):
        """Callback when Speechmatics finishes transcribing a sentence."""
        if message['metadata']['transcript_type'] == 'final':
            transcript = message['alternatives'][0]['content']
            print(f"[Speechmatics] Final Transcript: {transcript}")
            # Send the text to Gemini to be turned into ASL grammar
            asyncio.create_task(self.asl_callback(transcript))

    async def run_stt_pipeline(self, audio_generator):
        """
        Processes real-time audio bytes from the blind user's mic.
        audio_generator: an async iterator yielding raw PCM audio bytes.
        """
        self.client.add_event_handler("AddTranscript", self._on_transcript)

        config = TranscriptionConfig(
            language="en",
            operating_point="low_delay", # Crucial for real-time feel
            enable_partials=True,         # Shows text as it's being spoken
            max_delay=0.5                 # 500ms maximum latency
        )

        audio_settings = AudioSettings(encoding="pcm_f32le", sample_rate=16000)

        print("[Vultr] Audio Pipeline Active: Listening...")
        try:
            await self.client.run(audio_generator, config, audio_settings)
        except Exception as e:
            print(f"Speechmatics Engine Error: {e}")

    async def generate_speech(self, text, emotion_style):
        """
        Uses Speechmatics TTS to speak to the blind user.
        In 2026, we can specify 'styles' to match Gemini's detected emotion.
        """
        # Logic to call the Speechmatics TTS endpoint 
        # using the 'emotion_style' (e.g., 'cheerful', 'sad', 'whispered')
        print(f"[Speechmatics] Speaking: '{text}' in a {emotion_style} tone.")
        # ... (TTS API Call code)