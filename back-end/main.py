import os
import json
import asyncio
import base64
from fastapi import FastAPI, WebSocket
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

# 1. Initialize Gemini Client
# Using Gemini 2.5 Flash for high-speed multimodal reasoning
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

    # Create a stateful Live session with Gemini
    async with client.aio.live.connect(
        model=MODEL_ID, 
        config=types.LiveConnectConfig(system_instruction=SYSTEM_INSTRUCTION)
    ) as session:

        async def handle_video_input():
            """Receives video frames from the Frontend and sends to Gemini."""
            try:
                while True:
                    # Expecting base64 or raw bytes from your Figma-built frontend
                    message = await websocket.receive_json()
                    if "frame" in message:
                        frame_data = base64.b64decode(message["frame"])
                        await session.send(
                            input=types.Blob(data=frame_data, mime_type="image/jpeg"),
                            end_of_turn=True
                        )
            except Exception as e:
                print(f"Video Input Error: {e}")

        async def handle_ai_response():
            """Handles Gemini's interpretation and routes it to Speechmatics."""
            async for response in session.receive():
                if response.server_content and response.server_content.model_turn:
                    for part in response.server_content.model_turn.parts:
                        if part.text:
                            # This is the translation + emotion JSON
                            data = json.loads(part.text)
                            
                            # STEP: Trigger Speechmatics TTS (Logic below)
                            await trigger_speechmatics_voice(data)
                            
                            # Send back to frontend for the 'Digital Twin' or UI updates
                            await websocket.send_json(data)

        await asyncio.gather(handle_video_input(), handle_ai_response())

async def trigger_speechmatics_voice(interpretation):
    """
    Takes the text and emotion from Gemini and uses Speechmatics
    to create the voice for the blind user.
    """
    # Logic to call Speechmatics TTS API with 'emotion' styling
    pass