import os
import json
import asyncio
import base64
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from google.genai import types
from dotenv import load_dotenv

# Your environment dependency processors
from speech_engine import BridgeAudioEngine
from asl_gloss import convert_to_asl_gloss

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

# System updates configured to optimize for sign language sentence structure conversion rules
ASL_PARSER_INSTRUCTION = """
You are an expert ASL Linguistics Translator.
Task: Convert the incoming fluent English text sentences into uppercase ASL Gloss syntax structures.
Rules: Omit lowercase auxiliary articles (to, the, a, is). Use core vocabulary keywords (e.g., "I want to learn sign language" -> "I WANT LEARN SIGN LANGUAGE").
Output: Clean text tokens only, no added metadata punctuation.
"""

@app.websocket("/ws/communication-bridge")
async def communication_bridge(websocket: WebSocket):
    await websocket.accept()
    audio_queue = asyncio.Queue()

    # Callback executed automatically when Speechmatics finishes interpreting a audio phrase
    async def on_speech_completed(text_transcript):
        if not text_transcript.strip():
            return
            
        try:
            # 1. Update text on the user layout
            await websocket.send_json({
                "event": "transcription",
                "data": {"text": text_transcript}
            })

            # 2. Query Gemini to structure the English string into ASL keywords
            response = client.models.generate_content(
                model=MODEL_ID,
                contents=text_transcript,
                config=types.GenerateContentConfig(
                    system_instruction=ASL_PARSER_INSTRUCTION,
                    max_output_tokens=30
                )
            )
            
            asl_gloss_output = response.text.strip().upper()
            print(f"[Pipeline Sync] English: '{text_transcript}' -> ASL Gloss: '{asl_gloss_output}'")

            # 3. Stream structural animation frames down to trigger the avatar positions
            await websocket.send_json({
                "event": "animate_avatar",
                "data": asl_gloss_output
            })
            
        except Exception as e:
            print(f"Linguistics Pipeline Translation Exception: {e}")

    audio_engine = BridgeAudioEngine(asl_callback=on_speech_completed)

    async def audio_generator():
        while True:
            chunk = await audio_queue.get()
            yield chunk

    # Non-blocking continuous connection worker routing thread loops
    async def read_client_inputs():
        try:
            while True:
                message = await websocket.receive_json()
                if message.get("type") == "audio_chunk":
                    audio_bytes = base64.b64decode(message["audio"])
                    await audio_queue.put(audio_bytes)
        except WebSocketDisconnect:
            print("Translation connection link disconnected.")
        except Exception as e:
            print(f"Ingestion worker exception: {e}")

    # Launch processing channels concurrently
    try:
        await asyncio.gather(
            read_client_inputs(),
            audio_engine.run_stt_pipeline(audio_generator())
        )
    except Exception as e:
        print(f"Platform engine processing failure: {e}")