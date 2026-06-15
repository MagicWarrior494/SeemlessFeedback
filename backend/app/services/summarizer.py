import os
import json
from google import genai
from google.genai import types
# Fixed: Point to your actual database configuration module
from app.services.db import get_db_connection

def summarize_transcript(task_id: str) -> str:
    """
    Fetches a transcript from the database by task_id, generates a structured academic 
    summary using Gemini, saves the text back to the database, and returns it.
    """
    # 1. Fetch the transcript from the database
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT transcript, summary FROM jobs WHERE task_id = ?", (task_id,))
    row = cursor.fetchone()
    
    if not row:
        conn.close()
        raise ValueError(f"No job found with task_id: {task_id}")
    
    # If a summary already exists, return it to save API calls
    if row['summary']:
        conn.close()
        return row['summary']
        
    transcript_raw = row['transcript']
    if not transcript_raw:
        conn.close()
        raise ValueError(f"Job {task_id} does not have a transcript to summarize.")

    # Format the serialized JSON dialogue rows cleanly into text lines for the prompt context
    try:
        transcript_data = json.loads(transcript_raw)
        if isinstance(transcript_data, list):
            transcript = "\n".join([f"{seg.get('speaker', 'Unknown')}: {seg.get('text', '')}" for seg in transcript_data])
        else:
            transcript = str(transcript_raw)
    except Exception:
        transcript = str(transcript_raw)

    # 2. Initialize the Gemini Client
    client = genai.Client()

    try:
        # 3. Generate the summary using correct google-genai structural syntax parameters
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=f"""You are an academic feedback analysis assistant.

Your task is to analyze a transcript of a student discussion about a college course and extract useful, constructive feedback for the instructor.

IMPORTANT RULES:
- Focus ONLY on course-related feedback.
- Ignore unrelated conversation, unrelated jokes, tangents, greetings, or filler.
- Do NOT insult or attack the teacher.
- Do NOT exaggerate student opinions.
- Do NOT invent information not stated in the transcript.
- Preserve nuance and uncertainty.
- If students disagree, mention the disagreement.
- Prioritize actionable feedback the teacher can realistically improve.
- Treat repeated complaints or praise as more important signals.

Analyze the transcript and produce the following sections:

1. OVERALL SENTIMENT
Provide a short summary of the overall student attitude toward the course.

2. KEY POSITIVE FEEDBACK
List the main things students appreciated.

3. KEY CRITICAL FEEDBACK
List the major complaints or frustrations students discussed. Include:
- Issue title
- Brief explanation
- Estimated severity (Low, Medium, High)
- Evidence from transcript

4. REPEATED THEMES
Identify complaints or praise mentioned multiple times or agreed upon by multiple students.

5. ACTIONABLE SUGGESTIONS FOR THE TEACHER
Convert the feedback into constructive recommendations.

6. STUDENT DISAGREEMENTS OR MIXED OPINIONS
Identify areas where students had different perspectives.

7. IMPORTANT QUOTES
Extract a few short, representative quotes from the transcript.

OUTPUT FORMAT:
Use clean markdown formatting with headings and bullet points.
Be concise but specific.
Do not output JSON unless explicitly requested.

TRANSCRIPT:
{transcript}""",
            config=types.GenerateContentConfig(
                temperature=0.3, # Lower temperature for focused summaries
            )
        )
        summary_text = response.text.strip()
        
        # 4. Save the summary back to the database and update status to terminal state COMPLETED
        cursor.execute(
            "UPDATE jobs SET summary = ?, status = 'COMPLETED' WHERE task_id = ?", 
            (summary_text, task_id)
        )
        conn.commit()
        
        return summary_text

    except Exception as e:
        # Update state ticket tracking markers appropriately
        cursor.execute("UPDATE jobs SET status = 'SUMMARY_FAILED' WHERE task_id = ?", (task_id,))
        conn.commit()
        raise RuntimeError(f"Failed to generate summary: {e}")
        
    finally:
        conn.close()