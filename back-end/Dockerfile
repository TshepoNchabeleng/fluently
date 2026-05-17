FROM python:3.11-slim

WORKDIR /app

# Copy the requirements file from the back-end folder into the container
COPY requirements.txt .

# Install the dependencies required for your Gemini and Speechmatics engines
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of your back-end code (main.py, speech_engine.py, asl_gloss.py)
COPY . .

EXPOSE 8000

# Dynamically bind to Render's assigned port, or default to 8000 locally
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]