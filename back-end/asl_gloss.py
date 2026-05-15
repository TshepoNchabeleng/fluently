import requests

VULTR_INFERENCE_URL = "https://api.vultrinference.com/v1/chat/completions"

def get_asl_structure(english_text):
    """
    Uses a specialized open-source modle on vultr to convert
    spoken english into ASL syntax
    """
    headers = {"Authorization": f"Bearer {os.getenv('VULTR_API_KEY')}"}
    data = {
        "model": "llama-3-70b-instruct", #hosted on Vultr Serverless
        "messages": [
            {"role": "system", "content": ":convert english to ASL Gloss syntax. Example: 'How are you?' -> 'YOU HOW?'"},
            {"role": "user", "content": english_text}
        ]
    }
    response = requests.post(VULTR_INFERENCE_URL, headers=headers, json=data)
    return response.json()['choices'][0]['messsage']['content']