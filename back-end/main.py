import os
import json
import asyncio
import base64
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from google import genai
from google.genai import types
from dotenv import load_dotenv

# Your custom modules
from speech_engine import BridgeAudioEngine
from asl_gloss import convert_to_asl_gloss

load_dotenv()

app = FastAPI()
client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))
MODEL_ID = "gemini-2.5-flash"

SYSTEM_INSTRUCTION = """
You are a 'Bridge' agent for deaf and blind communication.
- Input: Video frames of a person signing.
- Task 1: Translate ASL to fluent English.
- Task 2: Analyze facial micro-expressions and body language.
- Output: Strictly valid JSON: {"text": "translation", "emotion": "tone", "urgency": 1-10}
"""

@app.websocket("/ws/communication-bridge")
async def communication_bridge(websocket: WebSocket):
    await websocket.accept()

    # --- 1. SPEECHMATICS SETUP ---
    # We define the callback inside the loop so it can access this specific 'websocket'
    async def on_speech_completed(text):
        asl_syntax = await convert_to_asl_gloss(text)
        await websocket.send_json({
            "event": "animate_avatar",
            "data": asl_syntax
        })

    audio_engine = BridgeAudioEngine(asl_callback=on_speech_completed)
    # This queue will hold audio chunks from the frontend to feed into Speechmatics
    audio_queue = asyncio.Queue()

    async def audio_generator():
        while True:
            chunk = await audio_queue.get()
            yield chunk

    # --- 2. GEMINI LIVE SETUP ---
    async with client.aio.live.connect(
        model=MODEL_ID, 
        config=types.LiveConnectConfig(system_instruction=SYSTEM_INSTRUCTION)
    ) as session:

        async def handle_frontend_input():
            """Receives BOTH video frames and audio chunks from Figma/Frontend."""
            try:
                while True:
                    message = await websocket.receive_json()
                    
                    # Path A: Video frames for Gemini
                    if message.get("type") == "video_frame":
                        frame_data = base64.b64decode(message["frame"])
                        await session.send(
                            input=types.Blob(data=frame_data, mime_type="image/jpeg"),
                            end_of_turn=True
                        )
                    
                    # Path B: Audio chunks for Speechmatics
                    elif message.get("type") == "audio_chunk":
                        audio_data = base64.b64decode(message["audio"])
                        await audio_queue.put(audio_data)

            except WebSocketDisconnect:
                print("Client disconnected")
            except Exception as e:
                print(f"Input Error: {e}")

        async def handle_gemini_output():
            """Handles Gemini's vision interpretation."""
            async for response in session.receive():
                if response.server_content and response.server_content.model_turn:
                    for part in response.server_content.model_turn.parts:
                        if part.text:
                            try:
                                data = json.loads(part.text)
                                # Speak to the blind user via Speechmatics TTS
                                await trigger_speechmatics_voice(data)
                                # Update Figma UI for the deaf user
                                await websocket.send_json({"event": "translation", "data": data})
                            except json.JSONDecodeError:
                                pass

        # --- 3. RUN ALL ENGINES CONCURRENTLY ---
        try:
            await asyncio.gather(
                handle_frontend_input(),
                handle_gemini_output(),
                audio_engine.run_stt_pipeline(audio_generator()) # The Speechmatics 'Ear'
            )
        except Exception as e:
            print(f"Bridge Execution Error: {e}")

async def trigger_speechmatics_voice(interpretation):
    """
    Uses Speechmatics TTS. In 2026, we map Gemini's 'emotion' 
    to Speechmatics voice styles.
    """
    text = interpretation.get("text")
    emotion = interpretation.get("emotion", "neutral")
    
    print(f"[TTS] Style: {emotion} | Saying: {text}")