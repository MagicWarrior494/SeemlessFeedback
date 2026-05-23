import os
import json
import time
from google import genai
from google.genai import types

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