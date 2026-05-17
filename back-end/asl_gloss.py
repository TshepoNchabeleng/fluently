import os
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

# We use Gemini Pro here because ASL grammar is complex.
# Pro is much better at 'Reasoning' than the faster Flash model.
client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))
MODEL_ID = "gemini-2.5-pro"

async def convert_to_asl_gloss(english_text: str):
    """
    Takes plain English and converts it into ASL Gloss syntax 
    to be performed by your AI Avatar.
    """
    
    prompt = f"""
    Translate the following English sentence into ASL Gloss.
    Rules:
    1. Use ALL CAPS.
    2. Use Topic-Comment structure (Object-Subject-Verb).
    3. Include facial expression markers in brackets (e.g., [nodding], [eyebrows-up]).
    4. Omit 'be' verbs (am, is, are, was, were).

    English: "{english_text}"
    ASL Gloss:
    """

    try:
        response = await client.aio.models.generate_content(
            model=MODEL_ID,
            contents=prompt
        )
        
        gloss_result = response.text.strip()
        print(f"[Brain] English: {english_text} -> Gloss: {gloss_result}")
        return gloss_result
        
    except Exception as e:
        print(f"ASL Gloss Error: {e}")
        return english_text.upper() # Fallback to simple caps