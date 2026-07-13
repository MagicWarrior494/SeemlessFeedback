import React, { useCallback, useEffect, useRef, useState } from "react";
import { addHistoryEntry } from "../utils/historyStorage";

const API_BASE_URL = "http://localhost:8000";

function getSummaryFromResponse(data) {
  if (!data) return "";
  return data.summary || data.summarization || data.result || data.text || "";
}

export default function TextFeedbackPage({ onHistoryUpdate, onBackToChoice }) {
  const [status, setStatus] = useState("");
  const [workflowStep, setWorkflowStep] = useState("text-entry");
  const [transcriptDraft, setTranscriptDraft] = useState("");
  const [summaryDraft, setSummaryDraft] = useState("");
  const [taskId, setTaskId] = useState("");
  const [courses, setCourses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState("");
  const [selectedTeacher, setSelectedTeacher] = useState("");
  const [courseMode, setCourseMode] = useState("select");
  const [teacherMode, setTeacherMode] = useState("select");
  const [newCourseName, setNewCourseName] = useState("");
  const [newTeacherName, setNewTeacherName] = useState("");
  const [metadataLoading, setMetadataLoading] = useState(false);
  const fileInputRef = useRef(null);

  const loadFeedbackMetadata = useCallback(async () => {
    setMetadataLoading(true);
    try {
      const [courseResponse, teacherResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/api/courses`),
        fetch(`${API_BASE_URL}/api/teachers`),
      ]);
      if (!courseResponse.ok || !teacherResponse.ok) {
        throw new Error("Could not load saved courses and teachers.");
      }
      setCourses(await courseResponse.json());
      setTeachers(await teacherResponse.json());
    } catch (metadataError) {
      setStatus(metadataError.message);
    } finally {
      setMetadataLoading(false);
    }
  }, []);

  useEffect(() => {
    if (workflowStep === "summary-review") {
      loadFeedbackMetadata();
    }
  }, [workflowStep, loadFeedbackMetadata]);

  const createMetadataItem = async (kind) => {
    const isCourse = kind === "course";
    const name = (isCourse ? newCourseName : newTeacherName).trim();
    if (!name) {
      setStatus(`Enter a ${kind} name first.`);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/${isCourse ? "courses" : "teachers"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const item = await response.json();
      if (!response.ok) {
        throw new Error(item.detail || `Could not save ${kind}.`);
      }
      if (isCourse) {
        setCourses((current) => [...current.filter((course) => course.id !== item.id), item].sort((a, b) => a.name.localeCompare(b.name)));
        setSelectedCourse(String(item.id));
        setNewCourseName("");
        setCourseMode("select");
      } else {
        setTeachers((current) => [...current.filter((teacher) => teacher.id !== item.id), item].sort((a, b) => a.name.localeCompare(b.name)));
        setSelectedTeacher(String(item.id));
        setNewTeacherName("");
        setTeacherMode("select");
      }
      setStatus(`${isCourse ? "Course" : "Teacher"} saved and selected.`);
    } catch (metadataError) {
      setStatus(metadataError.message);
    }
  };

  const handleTranscriptUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      setTranscriptDraft(text);
      setStatus(`${file.name} loaded. Review it before summarizing.`);
    } catch {
      setStatus("Could not read that text file.");
    }
  };

  const sendTextToSummarizer = async () => {
    if (!transcriptDraft.trim()) {
      setStatus("Paste or upload transcript text before summarizing.");
      return;
    }

    setStatus("Saving transcript and starting summarizer...");
    setWorkflowStep("summarizing");

    try {
      const taskResponse = await fetch(`${API_BASE_URL}/tasks/text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: transcriptDraft }),
      });
      const taskData = await taskResponse.json();
      if (!taskResponse.ok) {
        throw new Error(taskData.detail || "Could not create text feedback task.");
      }

      setTaskId(taskData.task_id);

      const summaryResponse = await fetch(`${API_BASE_URL}/tasks/summarize/${taskData.task_id}`, {
        method: "POST",
      });
      if (!summaryResponse.ok) {
        const data = await summaryResponse.json().catch(() => ({}));
        throw new Error(data.detail || "Summarization generation request failed.");
      }

      const summaryPoll = setInterval(async () => {
        try {
          const checkRes = await fetch(`${API_BASE_URL}/tasks/status/${taskData.task_id}`);
          const jobData = await checkRes.json();
          const nextSummary = getSummaryFromResponse(jobData);

          if (jobData.status === "COMPLETED" && nextSummary) {
            clearInterval(summaryPoll);
            setSummaryDraft(nextSummary);
            setWorkflowStep("summary-review");
            setStatus("Review and edit the summary before finalizing.");
          } else if (jobData.status === "SUMMARY_FAILED") {
            clearInterval(summaryPoll);
            setWorkflowStep("text-entry");
            setStatus("Could not compile feedback summary.");
          }
        } catch {
          clearInterval(summaryPoll);
          setWorkflowStep("text-entry");
          setStatus("Could not reach the backend.");
        }
      }, 2000);
    } catch (error) {
      setWorkflowStep("text-entry");
      setStatus(error.message);
    }
  };

  const finalizeFeedback = async () => {
    if (!selectedCourse || !selectedTeacher) {
      setStatus("Select both a course and a teacher before finalizing.");
      return;
    }
    if (!taskId) {
      setStatus("Missing task ID. Feedback could not be finalized.");
      return;
    }

    setStatus("Saving finalized feedback...");
    try {
      const response = await fetch(`${API_BASE_URL}/tasks/finalize/${taskId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          course_id: Number(selectedCourse),
          teacher_id: Number(selectedTeacher),
          summary: summaryDraft,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.detail || "Backend could not finalize feedback.");
      }
    } catch (finalizeError) {
      setStatus(finalizeError.message);
      return;
    }

    const course = courses.find((item) => String(item.id) === selectedCourse);
    const teacher = teachers.find((item) => String(item.id) === selectedTeacher);

    addHistoryEntry({
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      durationSec: 0,
      audioDataUrl: null,
      transcript: transcriptDraft,
      summary: summaryDraft,
      speakerCount: 0,
      uploadStatus: "Text feedback finalized",
      mimeType: "text/plain",
      course: course?.name || "",
      teacher: teacher?.name || "",
    });

    onHistoryUpdate?.();
    setWorkflowStep("complete");
    setStatus("Text feedback finalized and saved to history.");
  };

  return (
    <div className="page page--text-feedback">
      <button type="button" className="btn-ghost back-button" onClick={onBackToChoice}>
        Back
      </button>

      <section className="settings-panel text-feedback-panel">
        <p className="eyebrow">Text feedback</p>
        <h1>Upload text or paste a transcription</h1>
        <p className="settings-hint">
          Add the conversation transcript here, then send it through the same summary and final review flow.
        </p>

        {workflowStep === "text-entry" && (
          <>
            <textarea
              value={transcriptDraft}
              onChange={(event) => setTranscriptDraft(event.target.value)}
              rows={16}
              placeholder="Paste the conversation transcript here..."
              className="large-textarea"
            />
            <div className="text-feedback-actions">
              <label className="btn-ghost file-button">
                Upload text file
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.md,.csv,text/plain,text/markdown"
                  onChange={handleTranscriptUpload}
                />
              </label>
              <button type="button" className="btn-primary" onClick={sendTextToSummarizer}>
                Send to summarizer
              </button>
            </div>
          </>
        )}

        {workflowStep === "summarizing" && (
          <p className="record-status">AI Pipeline: <span className="badge badge--ok">SUMMARIZING</span></p>
        )}

        {(workflowStep === "summary-review" || workflowStep === "complete") && (
          <>
            <textarea
              value={summaryDraft}
              disabled={workflowStep === "complete"}
              onChange={(event) => setSummaryDraft(event.target.value)}
              rows={14}
              className="large-textarea"
            />
            <div className="feedback-metadata-grid">
              <section className="feedback-metadata-field">
                <h3>1. Course</h3>
                <div className="feedback-choice-tabs">
                  <button type="button" className={courseMode === "select" ? "is-active" : ""} onClick={() => setCourseMode("select")}>Select course</button>
                  <button type="button" className={courseMode === "new" ? "is-active" : ""} onClick={() => setCourseMode("new")}>New course</button>
                </div>
                {courseMode === "select" ? (
                  <select value={selectedCourse} disabled={metadataLoading || workflowStep === "complete"} onChange={(event) => setSelectedCourse(event.target.value)}>
                    <option value="">{metadataLoading ? "Loading courses..." : "Choose a saved course"}</option>
                    {courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}
                  </select>
                ) : (
                  <div className="feedback-new-item">
                    <input value={newCourseName} onChange={(event) => setNewCourseName(event.target.value)} placeholder="Course name" />
                    <button type="button" className="btn-ghost" onClick={() => createMetadataItem("course")}>Save course</button>
                  </div>
                )}
              </section>

              <section className="feedback-metadata-field">
                <h3>2. Teacher</h3>
                <div className="feedback-choice-tabs">
                  <button type="button" className={teacherMode === "select" ? "is-active" : ""} onClick={() => setTeacherMode("select")}>Select teacher</button>
                  <button type="button" className={teacherMode === "new" ? "is-active" : ""} onClick={() => setTeacherMode("new")}>New teacher</button>
                </div>
                {teacherMode === "select" ? (
                  <select value={selectedTeacher} disabled={metadataLoading || workflowStep === "complete"} onChange={(event) => setSelectedTeacher(event.target.value)}>
                    <option value="">{metadataLoading ? "Loading teachers..." : "Choose a saved teacher"}</option>
                    {teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}
                  </select>
                ) : (
                  <div className="feedback-new-item">
                    <input value={newTeacherName} onChange={(event) => setNewTeacherName(event.target.value)} placeholder="Teacher name" />
                    <button type="button" className="btn-ghost" onClick={() => createMetadataItem("teacher")}>Save teacher</button>
                  </div>
                )}
              </section>
            </div>
            <button
              type="button"
              className="btn-primary"
              disabled={workflowStep === "complete" || !selectedCourse || !selectedTeacher}
              onClick={finalizeFeedback}
            >
              Finalize feedback
            </button>
          </>
        )}

        {status && <p className="record-status">{status}</p>}
      </section>
    </div>
  );
}
