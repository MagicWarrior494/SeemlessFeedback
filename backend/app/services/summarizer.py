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
            contents=f"""Your task is to analyze a transcript of a student discussion about a college course and extract useful, constructive feedback for the instructor.

IMPORTANT RULES:
- KEEP in mind that students may have an initial thought but may get sidetracked or interrupted. If a student is interrupted before completing a thought, you may briefly note the likely direction of the comment only if it is strongly supported by the surrounding conversation. Clearly label this as an inference rather than a confirmed statement. Keep this potential thought to a max of 1-2 sentences.
- In your feedback, extract a few short, representative quotes from the transcript for each main point discussed.
- If you research online for better context on a given topic, mention it in the summary and provide links to the sources used. Keep any outside research clearly separate from the transcript-based feedback.
- Don't use up more than 3,000 tokens in your response. If the transcript is too long, summarize the main points and ignore the rest.
- Focus ONLY on course-related feedback, unless the topic discussed is entirely off-topic and irrelevant to a course; if so, provide just a summary of each of the points discussed, and ignore all remaining rules and instructions. This exception is for testing purposes.

REMAINING RULES:
- Try to ignore unrelated conversations, jokes, tangents, greetings, or filler.
- Do NOT insult or attack the teacher themselves and focus on the course discussion. If the students do, ignore it and focus on the course discussion.
- If the students mention the teacher's personality, or other not-physicaly related attributes, don't ignore it, but focus on how it may affect the course and learning experience. For example, if the teacher is too strict, too lenient, too disorganized, too unprepared, or if a personal issue becomes distracting to the learning environment, focus only on the effect it has on the course; if it doesn't relate to the learning enviorment, ignore it.
- Do NOT make up any information or opinions that are not present in the transcript.
- Ignore any criticisms about the teacher's appearance.
- Do NOT exaggerate or undermine student opinions.
- Do NOT invent information not stated in the transcript.
- Preserve nuance and uncertainty. Mention if students are unsure or have mixed opinions on things.
- If students disagree, have mixed opinions, or agree, mention it.
- Prioritize actionable feedback the teacher can realistically improve.
- Treat repeated complaints or praise as more important signals.
- Do not infer widespread problems from isolated comments. If there is not enough evidence that an issue reflects the group’s opinion, clearly label it as an isolated concern.
- Rank issues by overall significance rather than only by the order they appear in the transcript.
- Preserve meaningful detail. Prefer several specific observations over one vague generalized statement.
- Separate confirmed transcript evidence from interpretation or inference.
- When possible, distinguish between objective observations and student opinions.
  - Example objective observation: “The due date changed twice.”
  - Example student opinion: “The course felt disorganized.”
- When possible, distinguish between course design issues and teaching method issues.
  - Course design may include assignments, rubrics, Canvas layout, workload, due dates, and materials.
  - Teaching methods may include lectures, demonstrations, critiques, communication, pacing, and availability.
- Be aware of negativity bias. Students may naturally focus more on negative experiences than positive ones.

Analyze the transcript and produce the following sections:

1. KEY POSITIVE FEEDBACK
List the main things students appreciated.
For each main point, include:
- Brief explanation
- Representative quote or evidence from transcript
- Frequency: Mentioned once / Mentioned by multiple students / Mentioned repeatedly
- Confidence: Low / Medium / High

2. KEY CRITICAL FEEDBACK
List the major complaints or frustrations students discussed. 
For each main point, include:
- Issue title
- Brief explanation
- Category: Course Design / Teaching Method / Communication / Workload / Materials / Other.
- Estimated severity: Low / Medium / High
- Frequency: Mentioned once / Mentioned by multiple students / Mentioned repeatedly
- Confidence: Low / Medium / High
- Evidence from transcript
- Note whether the issue is an objective observation, student opinion, or interpretation/inference

3. REPEATED THEMES
Identify complaints or praise mentioned multiple times or agreed upon by multiple students.

4. STUDENT DISAGREEMENTS OR MIXED OPINIONS
Identify areas where students had different perspectives.

5. OVERALL SENTIMENT
Provide a short summary of the overall student attitude toward the course.

6. ACTIONABLE SUGGESTIONS FOR THE TEACHER
Use the previous feedback/output into possible constructive recommendations.
Focus on realistic improvements the teacher could make.

7. EFFECTIVE PRACTICES TO CONTINUE
List things the teacher or course is already doing well and should continue doing.
8. LIMITED OR UNCERTAIN FEEDBACK
List any concerns that were mentioned but did not have enough evidence to treat as a major theme.

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