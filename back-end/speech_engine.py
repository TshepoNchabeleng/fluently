import os
import asyncio
from speechmatics.models import ConnectionSettings, TranscriptionConfig, AudioSettings
import speechmatics # Import the root module
from dotenv import load_dotenv

load_dotenv()

# Using default SaaS endpoints provided by the library
CONNECTION_SETTINGS = ConnectionSettings(
    url="wss://eu2.rt.speechmatics.com/v2", 
    auth_token=os.getenv("SPEECHMATICS_API_KEY"),
)

class BridgeAudioEngine:
    def __init__(self, asl_callback):
        # FIX: Use speechmatics.client.WebsocketClient instead of SpeechmaticsClient
        self.client = speechmatics.client.WebsocketClient(CONNECTION_SETTINGS)
        self.asl_callback = asl_callback 

    def _on_transcript(self, message):
        """Callback when Speechmatics finishes transcribing a sentence."""
        if message['metadata']['transcript_type'] == 'final':
            transcript = message['alternatives'][0]['content']
            print(f"[Speechmatics] Final Transcript: {transcript}")
            asyncio.create_task(self.asl_callback(transcript))

    async def run_stt_pipeline(self, audio_generator):
        """
        Processes real-time audio bytes from the blind user's mic.
        audio_generator: an async iterator yielding raw PCM audio bytes.
        """
        # Note: Event names in the library map directly to strings like "AddTranscript"
        self.client.add_event_handler("AddTranscript", self._on_transcript)

        config = TranscriptionConfig(
            language="en",
            operating_point="low_delay", 
            enable_partials=True,         
            max_delay=0.5                 
        )

        audio_settings = AudioSettings(encoding="pcm_f32le", sample_rate=16000)

        print("[Render Backend] Audio Pipeline Active: Listening...")
        try:
            # We use the underlying async connection handler or wrapper run method
            await self.client.run(audio_generator, config, audio_settings)
        except Exception as e:
            print(f"Speechmatics Engine Error: {e}")