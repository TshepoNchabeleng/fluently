import os
import asyncio
from speechmatics.models import ConnectionSettings, TranscriptionConfig, AudioSettings
import speechmatics
from dotenv import load_dotenv

load_dotenv()

CONNECTION_SETTINGS = ConnectionSettings(
    url="wss://eu2.rt.speechmatics.com/v2",
    auth_token=os.getenv("SPEECHMATICS_API_KEY"),
)

class BridgeAudioEngine:
    def __init__(self, asl_callback):
        self.client = speechmatics.client.WebsocketClient(CONNECTION_SETTINGS)
        self.asl_callback = asl_callback
        self._loop: asyncio.AbstractEventLoop | None = None

    def _on_transcript(self, message):
        """
        Callback fired by Speechmatics on each final AddTranscript event.
        Correct schema: message['metadata']['transcript'] holds the full sentence string.
        The original code incorrectly accessed message['metadata']['transcript_type']
        and message['alternatives'][0]['content'] — neither field exists on AddTranscript.
        """
        transcript = message.get("metadata", {}).get("transcript", "").strip()
        if not transcript:
            return

        print(f"[Speechmatics] Final: {transcript}")

        # asyncio.create_task requires the call to originate inside the running loop.
        # Storing the loop reference at startup and using run_coroutine_threadsafe
        # makes this safe regardless of which thread speechmatics fires the callback from.
        if self._loop and self._loop.is_running():
            asyncio.run_coroutine_threadsafe(self.asl_callback(transcript), self._loop)

    async def run_stt_pipeline(self, audio_generator):
        """
        Streams real-time PCM audio bytes into Speechmatics.
        audio_generator: an async iterator yielding raw PCM audio bytes.
        """
        # Capture the running loop so _on_transcript can safely schedule coroutines.
        self._loop = asyncio.get_running_loop()

        # Register only for final transcripts — no partials needed in the pipeline.
        self.client.add_event_handler("AddTranscript", self._on_transcript)

        config = TranscriptionConfig(
            language="en",
            operating_point="low_delay",
            enable_partials=False,
            max_delay=0.7,
        )

        # FIXED: was pcm_f32le — frontend sends Int16Array which is pcm_s16le.
        # Mismatched encoding caused Speechmatics to receive corrupt audio and produce nothing.
        audio_settings = AudioSettings(encoding="pcm_s16le", sample_rate=16000)

        print("[Backend] Audio pipeline live — listening for speech...")
        try:
            await self.client.run(audio_generator, config, audio_settings)
        except Exception as e:
            print(f"[Speechmatics] Engine error: {e}")