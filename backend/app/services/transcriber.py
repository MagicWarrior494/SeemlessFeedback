import os
import json
import time
from google import genai
from google.genai import types

# Load GEMINI_API_KEY from .env if not already present in environment variables
if "GEMINI_API_KEY" not in os.environ:
    for path in [".env", "../.env", "../../.env"]:
        if os.path.exists(path):
            try:
                with open(path, "r") as f:
                    for line in f:
                        if line.strip().startswith("GEMINI_API_KEY="):
                            key = line.split("=", 1)[1].strip().strip('"').strip("'")
                            os.environ["GEMINI_API_KEY"] = key
                            break
            except Exception as e:
                print(f"[Warning] Failed to read environment from {path}: {e}")

def transcribe_and_diarize_audio(file_path: str) -> list:
    """
    Uploads an audio file to Gemini, requests structured transcription 
    and diarization ONLY, and returns a list of speaker segments.
    """
    if not os.path.exists(file_path):
        return {"error": f"Audio file not found at path: {file_path}"}
        
    client = genai.Client()
    
    print(f"[AI Service] Uploading {file_path} to Gemini...")
    audio_file = client.files.upload(file=file_path)
    
    while audio_file.state.name == "PROCESSING":
        time.sleep(2)
        audio_file = client.files.get(name=audio_file.name)

    if audio_file.state.name == "FAILED":
        raise Exception("Gemini audio processing failed on upload.")

    # Modified prompt to remove summarization entirely
    prompt = (
        "Analyze this audio file. Accurately transcribe the text and use speaker "
        "diarization to separate the speakers (e.g., Speaker A, Speaker B). "
        "Return the final output matching the requested JSON schema structure perfectly."
    )

    print("[AI Service] Querying Gemini model...")
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=[audio_file, prompt],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=types.Schema(
                type=types.Type.OBJECT,
                properties={
                    "transcript": types.Schema(
                        type=types.Type.ARRAY,
                        items=types.Schema(
                            type=types.Type.OBJECT,
                            properties={
                                "speaker": types.Schema(type=types.Type.STRING),
                                "text": types.Schema(type=types.Type.STRING),
                            },
                        ),
                    ),
                },
                required=["transcript"],
            ),
        ),
    )

    client.files.delete(name=audio_file.name)
    
    # Return just the transcript list data
    result_data = json.loads(response.text)
    return result_data.get("transcript")


def generate_summary(transcript_data) -> str:
    """
    Generates a clean summary of the transcription segments.
    Accepts either a JSON string or a list of speaker segments.
    """
    if isinstance(transcript_data, str):
        try:
            transcript_list = json.loads(transcript_data)
        except Exception:
            transcript_list = []
    else:
        transcript_list = transcript_data

    if not transcript_list:
        return "No transcript content available to summarize."

    # Format transcript list into readable dialogue for the model
    dialogue_lines = []
    for segment in transcript_list:
        speaker = segment.get("speaker", "Unknown Speaker")
        text = segment.get("text", "")
        dialogue_lines.append(f"{speaker}: {text}")
    
    dialogue_text = "\n".join(dialogue_lines)

    client = genai.Client()
    prompt = (
        "You are an expert assistant. Read the following transcribed dialogue "
        "and provide a concise, high-quality, professional summary of the discussion. "
        "Highlight the key topics discussed, main points raised by each speaker, and any action items.\n\n"
        f"Dialogue:\n{dialogue_text}"
    )

    print("[AI Service] Generating summary from transcript using Gemini...")
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
    )

    return response.text.strip()