import os
import json
import asyncio
import base64
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from google.genai import types
from dotenv import load_dotenv

from speech_engine import BridgeAudioEngine
# NOTE: asl_gloss.py (Gemini Pro path) is available for high-quality offline batch translation.
# The real-time pipeline uses the Flash model below for minimum latency.

load_dotenv()
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))
MODEL_ID = "gemini-2.5-flash"

# Optimised for minimum token output and maximum ASL structural accuracy.
ASL_PARSER_INSTRUCTION = """
You are an expert ASL Linguistics Translator.
Task: Convert incoming English sentences into uppercase ASL Gloss syntax.
Rules:
  - Remove auxiliary/connecting words: to, the, a, an, is, are, am, was, were, be, been, being, of, for, in, on, at.
  - Keep core nouns, verbs, adjectives, pronouns, and time markers.
  - Preserve natural ASL Topic-Comment word order where possible.
  - Example: "I want to learn sign language" -> "I WANT LEARN SIGN LANGUAGE"
  - Example: "Can you help me please?" -> "YOU HELP ME PLEASE"
Output: Space-separated uppercase tokens only. No punctuation, no explanations.
"""

@app.websocket("/ws/communication-bridge")
async def communication_bridge(websocket: WebSocket):
    await websocket.accept()
    audio_queue: asyncio.Queue[bytes] = asyncio.Queue()

    async def on_speech_completed(text_transcript: str):
        if not text_transcript.strip():
            return

        try:
            # 1. Echo the raw English transcript to the client immediately.
            await websocket.send_json({
                "event": "transcription",
                "data": {"text": text_transcript}
            })

            # 2. Convert English -> ASL Gloss via Gemini Flash.
            response = client.models.generate_content(
                model=MODEL_ID,
                contents=text_transcript,
                config=types.GenerateContentConfig(
                    system_instruction=ASL_PARSER_INSTRUCTION,
                    max_output_tokens=50,
                    temperature=0.1,  # Low temp = consistent, deterministic gloss output.
                )
            )

            asl_gloss_output = response.text.strip().upper()
            print(f"[Pipeline] '{text_transcript}' -> '{asl_gloss_output}'")

            # 3. Push gloss tokens to the frontend avatar animation engine.
            await websocket.send_json({
                "event": "animate_avatar",
                "data": asl_gloss_output
            })

        except Exception as e:
            print(f"[Pipeline] Translation error: {e}")
            # Fallback: send capitalised English so avatar still has something to render.
            fallback = " ".join(
                w.upper() for w in text_transcript.split()
                if w.lower() not in {"to", "the", "a", "an", "is", "are", "am", "was"}
            )
            await websocket.send_json({"event": "animate_avatar", "data": fallback})

    audio_engine = BridgeAudioEngine(asl_callback=on_speech_completed)

    async def audio_generator():
        """Yields raw PCM bytes from the queue into the Speechmatics stream."""
        while True:
            chunk = await audio_queue.get()
            yield chunk

    async def read_client_inputs():
        """Decodes incoming WebSocket JSON packets and routes audio chunks to the queue."""
        try:
            while True:
                message = await websocket.receive_json()
                if message.get("type") == "audio_chunk":
                    audio_bytes = base64.b64decode(message["audio"])
                    await audio_queue.put(audio_bytes)
        except WebSocketDisconnect:
            print("[Backend] Client disconnected.")
        except Exception as e:
            print(f"[Backend] Input reader error: {e}")

    try:
        await asyncio.gather(
            read_client_inputs(),
            audio_engine.run_stt_pipeline(audio_generator())
        )
    except Exception as e:
        print(f"[Backend] Session error: {e}")