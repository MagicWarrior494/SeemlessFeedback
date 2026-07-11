import React, { useCallback, useEffect, useRef, useState } from "react";
import { uploadRecording } from "../api/client";
import RecordButton from "../components/RecordButton";
import RecordingTimer from "../components/RecordingTimer";
import { useAudioRecorder } from "../hooks/useAudioRecorder";
import { useMicrophonePermission } from "../hooks/useMicrophonePermission";
import { blobToDataUrl, getBlobDurationSec } from "../utils/audioData";
import { addHistoryEntry } from "../utils/historyStorage";

const API_BASE_URL = "http://127.0.0.1:8000";

function transcriptToText(transcriptValue) {
  if (!transcriptValue) {
    return "";
  }

  if (transcriptValue.error) {
    return `Backend Notice: ${transcriptValue.error}`;
  }

  if (Array.isArray(transcriptValue)) {
    return transcriptValue
      .map((line) => {
        const speaker = line.speaker || "Speaker";
        const text = line.text || "";
        return `${speaker}: ${text}`;
      })
      .join("\n");
  }

  return String(transcriptValue);
}

function getSummaryFromResponse(data) {
  if (!data) {
    return "";
  }

  return (
    data.summary ||
    data.summarization ||
    data.result ||
    data.text ||
    ""
  );
}

async function requestSummary(transcriptText, speakerCount) {
  const payload = {
    transcript: transcriptText,
    speaker_count: Number(speakerCount),
    speakerCount: Number(speakerCount),
  };

  const response = await fetch(`${API_BASE_URL}/summarize`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Summarizer failed with status ${response.status}`);
  }

  const data = await response.json();
  const summary = getSummaryFromResponse(data);

  if (!summary) {
    throw new Error("Summarizer did not return a summary.");
  }

  return summary;
}

export default function RecordPage({ onHistoryUpdate }) {
  const [status, setStatus] = useState(null);
  const [pipelineStatus, setPipelineStatus] = useState("");
  const [workflowStep, setWorkflowStep] = useState("record");
  const [pendingRecording, setPendingRecording] = useState(null);
  const [speakerCount, setSpeakerCount] = useState(2);
  const [transcript, setTranscript] = useState(null);
  const [transcriptDraft, setTranscriptDraft] = useState("");
  const [summaryDraft, setSummaryDraft] = useState("");
  const [pipelineSummary, setPipelineSummary] = useState("");
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
  const taskPollRef = useRef(null);

  const { needsPermission, requestAccess, refresh } = useMicrophonePermission();

  const onPermissionGranted = useCallback(() => {
    refresh();
  }, [refresh]);

  const loadFeedbackMetadata = useCallback(async () => {
    setMetadataLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/teachers`);
      if (!response.ok) {
        throw new Error("Could not load saved teachers.");
      }
      setTeachers(await response.json());
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
        setCourses((current) => [...current.filter((course) => course.course_id !== item.course_id), item]
          .sort((a, b) => a.name.localeCompare(b.name)));
        setSelectedCourse(String(item.course_id));
        setNewCourseName("");
        setCourseMode("select");
      } else {
        setTeachers((current) => [...current.filter((teacher) => teacher.teacher_id !== item.teacher_id), item]
          .sort((a, b) => a.name.localeCompare(b.name)));
        setSelectedTeacher(String(item.teacher_id));
        setNewTeacherName("");
        setTeacherMode("select");
      }
      setStatus(`${isCourse ? "Course" : "Teacher"} saved and selected.`);
    } catch (metadataError) {
      setStatus(metadataError.message);
    }
  };

  const handleTeacherChange = async (teacherId) => {
    setSelectedTeacher(teacherId);
    setSelectedCourse(""); // Reset selected course when teacher changes
    setCourses([]); // Clear current courses list while fetching

    if (teacherId) {
      try {
        const response = await fetch(`${API_BASE_URL}/api/teachers/${teacherId}/courses`);
        if (response.ok) {
          const teacherCourses = await response.json();
          setCourses(teacherCourses);
        } else {
          console.error("Failed to fetch courses for selected teacher.");
        }
      } catch (err) {
        console.error("Could not reach endpoint for teacher courses:", err);
      }
    }
  };

  const prepareAudioForReview = useCallback(async ({ blob, durationSec, mimeType, source }) => {
    setStatus("Preparing audio preview...");
    setPipelineStatus("");
    setWorkflowStep("audio-review");
    setTranscript(null);
    setTranscriptDraft("");
    setSummaryDraft("");
    setPipelineSummary("");
    setSelectedCourse("");
    setSelectedTeacher("");
    setCourseMode("select");
    setTeacherMode("select");
    setNewCourseName("");
    setNewTeacherName("");

    const measuredDuration = await getBlobDurationSec(blob);
    const finalDuration = Math.max(durationSec, measuredDuration ?? 0) || 1;

    let audioDataUrl = null;
    let previewWarning = null;

    if (blob.size === 0) {
      previewWarning = "No audio data in recording.";
    } else {
      try {
        audioDataUrl = await blobToDataUrl(blob);
      } catch {
        previewWarning = "Could not encode audio for playback.";
      }
    }

    setPendingRecording({
      blob,
      durationSec: finalDuration,
      audioDataUrl,
      mimeType: mimeType || blob.type,
      source,
    });
    setStatus(
      previewWarning
        ? `Recording ready, but ${previewWarning.toLowerCase()}`
        : `${source === "upload" ? "Uploaded audio" : "Recording"} ready for review.`
    );
  }, []);

  const handleComplete = useCallback(
    async ({ blob, durationSec, mimeType }) => {
      await prepareAudioForReview({
        blob,
        durationSec,
        mimeType,
        source: "recording",
      });
    },
    [prepareAudioForReview]
  );

  const resetWorkflow = () => {
    if (taskPollRef.current) {
      clearInterval(taskPollRef.current);
      taskPollRef.current = null;
    }

    setStatus(null);
    setPipelineStatus("");
    setWorkflowStep("record");
    setPendingRecording(null);
    setTranscript(null);
    setTranscriptDraft("");
    setSummaryDraft("");
    setPipelineSummary("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const hasAudioExtension = /\.(aac|aiff|flac|m4a|mp3|oga|ogg|opus|wav|webm|wma)$/i.test(file.name);

    if (!file.type.startsWith("audio/") && !hasAudioExtension) {
      setStatus("Choose an audio file to upload.");
      event.target.value = "";
      return;
    }

    await prepareAudioForReview({
      blob: file,
      durationSec: 0,
      mimeType: file.type,
      source: "upload",
    });
  };

  const sendToTranscriber = async () => {
    if (!pendingRecording) {
      setStatus("Record audio before sending it to transcription.");
      return;
    }

    const numericSpeakerCount = Number(speakerCount);
    if (!Number.isInteger(numericSpeakerCount) || numericSpeakerCount < 1) {
      setStatus("Enter the number of people talking before transcription.");
      return;
    }

    setStatus("Sending audio to transcriber...");
    setPipelineStatus("TRANSCRIBING");
    setWorkflowStep("transcribing");

    if (taskPollRef.current) {
      clearInterval(taskPollRef.current);
      taskPollRef.current = null;
    }

    const upload = await uploadRecording(pendingRecording.blob, {
      durationSec: pendingRecording.durationSec,
      speakerCount: numericSpeakerCount,
      speaker_count: numericSpeakerCount,
    });

    if (!upload.ok) {
      setStatus(`Upload Failed: ${upload.message}`);
      setPipelineStatus("Upload Aborted");
      setWorkflowStep("audio-review");
      return;
    }

    const taskId = upload.data?.task_id;
    if (!taskId) {
      setStatus("The backend did not return a task id.");
      setPipelineStatus("Task Scheduling Error");
      setWorkflowStep("audio-review");
      return;
    }

    setTranscript({ task_id: taskId });

    try {
      const pollInterval = setInterval(async () => {
        try {
          const statusResponse = await fetch(`${API_BASE_URL}/tasks/status/${taskId}`);
          const jobData = await statusResponse.json();
          const nextStatus = jobData.status || "UNKNOWN";

          setPipelineStatus(nextStatus);

          if (nextStatus === "TRANSCRIPT_READY") {
            clearInterval(pollInterval);
            taskPollRef.current = null;
            
            const nextTranscript = jobData.transcript;
            
            setTranscript({
              task_id: taskId,
              data: nextTranscript
            });
            
            setTranscriptDraft(transcriptToText(nextTranscript));
            setPipelineSummary(getSummaryFromResponse(jobData));
            setPipelineStatus("Transcript ready");
            setWorkflowStep("transcript-review");
            setStatus("Review and edit the transcript before summarizing.");
          } else if (nextStatus.includes("FAILED")) {
            clearInterval(pollInterval);
            taskPollRef.current = null;
            setPipelineStatus("Pipeline Failed");
            setStatus("Transcription failed. Please try again.");
            setWorkflowStep("audio-review");
          }
        } catch (pollError) {
          clearInterval(pollInterval);
          taskPollRef.current = null;
          console.error("Could not reach backend endpoints:", pollError);
          setPipelineStatus("Backend Offline");
          setStatus("Could not reach the backend.");
          setWorkflowStep("audio-review");
        }
      }, 2000);
      taskPollRef.current = pollInterval;
    } catch (networkError) {
      console.error("Could not reach backend endpoints:", networkError);
      setPipelineStatus("Backend Offline");
      setStatus("Could not reach the backend.");
      setWorkflowStep("audio-review");
    }
  };

  const sendToSummarizer = async () => {
    if (!transcriptDraft.trim()) {
      setStatus("Review or enter transcript text before summarizing.");
      return;
    }

    const taskId = transcript?.task_id || pendingRecording?.task_id;
    
    if (!taskId) {
      setStatus("Error: Missing Task ID. Cannot save edits.");
      setPipelineStatus("State Sync Error");
      return;
    }

    setStatus("Saving your transcript edits and initializing summarizer...");
    setPipelineStatus("SUMMARIZING");
    setWorkflowStep("summarizing");

    try {
      // 1. SAVE EDITS FIRST: Map the text block rows cleanly back to JSON dict keys
      const lines = transcriptDraft.split("\n").map(line => {
        const firstColonIndex = line.indexOf(":");
        if (firstColonIndex !== -1) {
          return {
            speaker: line.substring(0, firstColonIndex).trim(),
            text: line.substring(firstColonIndex + 1).trim()
          };
        }
        return { speaker: "Speaker", text: line.trim() };
      });

      const editResponse = await fetch(`${API_BASE_URL}/tasks/edit/${taskId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lines),
      });

      if (!editResponse.ok) {
        throw new Error("Backend failed to save text modifications before summarization.");
      }

      // 2. TRIGGER THE SUMMARY: Initiate isolated on-demand backend pipeline
      const summaryResponse = await fetch(`${API_BASE_URL}/tasks/summarize/${taskId}`, {
        method: "POST"
      });

      if (!summaryResponse.ok) {
        throw new Error("Summarization generation request failed.");
      }

      // 3. POLL FOR SUMMARY COMPLETION
      const summaryPoll = setInterval(async () => {
        try {
          const checkRes = await fetch(`${API_BASE_URL}/tasks/status/${taskId}`);
          const jobData = await checkRes.json();
          
          if (jobData.status === "COMPLETED" || jobData.summary) {
            clearInterval(summaryPoll);
            setSummaryDraft(jobData.summary || "Summary generation complete.");
            setPipelineStatus("Summary ready");
            setWorkflowStep("summary-review"); // <--- This unveils the final review panel!
            setStatus("Review and edit the summary before finalizing.");
          } else if (jobData.status === "SUMMARY_FAILED") {
            clearInterval(summaryPoll);
            setPipelineStatus("Summarizer Failed");
            setWorkflowStep("transcript-review");
            setStatus("Could not compile feedback summary.");
          }
        } catch (err) {
          clearInterval(summaryPoll);
          setPipelineStatus("Backend Offline");
          setWorkflowStep("transcript-review");
        }
      }, 2000);

    } catch (summaryError) {
      console.error("Could not summarize transcript:", summaryError);
      setPipelineStatus("Summarizer Failed");
      setWorkflowStep("transcript-review");
      setStatus(`Pipeline Error: ${summaryError.message}`);
    }
  };

  const finalizeFeedback = async () => {
    if (!pendingRecording) {
      setStatus("No recording is ready to finalize.");
      return;
    }

    if (!selectedCourse || !selectedTeacher) {
      setStatus("Select both a course and a teacher before finalizing.");
      return;
    }

    const taskId = transcript?.task_id || pendingRecording?.task_id;
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

    const entry = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      durationSec: pendingRecording.durationSec,
      audioDataUrl: pendingRecording.audioDataUrl,
      transcript: transcriptDraft,
      summary: summaryDraft,
      speakerCount: Number(speakerCount),
      uploadStatus: "Reviewed and finalized",
      mimeType: pendingRecording.mimeType,
      course: course?.name || "",
      teacher: teacher?.name || "",
    };

    try {
      addHistoryEntry(entry);
    } catch (err) {
      if (err?.name === "QuotaExceededError") {
        addHistoryEntry({ ...entry, audioDataUrl: null });
        setStatus("Feedback finalized. Audio was not saved locally because storage is full.");
      } else {
        throw err;
      }
    }

    onHistoryUpdate?.();
    setPipelineStatus("Done!");
    setWorkflowStep("complete");
    setStatus("Feedback finalized and saved to history.");
  };

  const { isRecording, elapsedSec, error, toggle, clearError } =
    useAudioRecorder({
      onRecordingComplete: handleComplete,
      onPermissionGranted,
      audioConstraints: {
        audio: {
          channelCount: 1,
          sampleRate: 44100,
        },
      },
      mimeType: "audio/wav",
    });

  const showMicBlocker = needsPermission || error === "denied";
  const isEditingWorkflow = workflowStep !== "record" || Boolean(pendingRecording);
  const isTranscribing = workflowStep === "transcribing";
  const isSummarizing = workflowStep === "summarizing";
  const canReviewAudio = pendingRecording && workflowStep === "audio-review";
  const canReviewTranscript = workflowStep === "transcript-review";
  const canReviewSummary = workflowStep === "summary-review" || workflowStep === "complete";

  const handleMicBlockerClick = async () => {
    const ok = await requestAccess();
    if (ok) {
      clearError();
      refresh();
    }
  };

  return (
    <div className="page page--record">
      <RecordingTimer elapsedSec={elapsedSec} visible={isRecording} />
      <div className="record-stage">
        {isEditingWorkflow && !isRecording ? (
          <button
            type="button"
            className="btn-ghost"
            onClick={resetWorkflow}
            style={{ minWidth: "140px" }}
          >
            Back
          </button>
        ) : (
          <div
            className={`record-button-wrap${showMicBlocker && !isRecording ? " record-button-wrap--blocked" : ""}`}
          >
            <RecordButton isRecording={isRecording} onClick={toggle} />
            {showMicBlocker && !isRecording && (
              <button
                type="button"
                className="mic-permission-blocker"
                onClick={handleMicBlockerClick}
              >
                Click for microphone permission
              </button>
            )}
          </div>
        )}
        {isEditingWorkflow && !isRecording ? (
          <p className="record-hint">Back to recording or upload</p>
        ) : (
          <>
            <p className="record-hint">
              {isRecording ? "Tap to stop" : "Tap to record"}
            </p>
            {!isRecording && (
              <label
                className="btn-ghost"
                style={{
                  display: "inline-flex",
                  cursor: "pointer",
                  marginTop: "0.75rem",
                }}
              >
                Upload audio
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*"
                  onChange={handleFileUpload}
                  style={{ display: "none" }}
                />
              </label>
            )}
          </>
        )}
        {error && error !== "denied" && (
          <p className="record-error">{error}</p>
        )}

        {status && <p className="record-status">{status}</p>}

        {pipelineStatus && (
          <p className="record-status" style={{ marginTop: "0.5rem" }}>
            AI Pipeline: <span className="badge badge--ok">{pipelineStatus}</span>
          </p>
        )}
      </div>

      {(pendingRecording || transcript || summaryDraft) && (
        <div style={{ padding: "0 2.5rem 3rem", maxWidth: "1040px", margin: "0 auto" }}>
          {canReviewAudio && (
            <div className="settings-panel">
              <h2>Review Audio</h2>
              <p className="settings-hint">
                Play the {pendingRecording.source === "upload" ? "uploaded audio" : "recording"} and enter how many people are speaking before transcription.
              </p>
              {pendingRecording.audioDataUrl ? (
                <audio
                  controls
                  src={pendingRecording.audioDataUrl}
                  style={{ width: "100%", marginTop: "1rem" }}
                />
              ) : (
                <p className="record-error">Audio preview is not available.</p>
              )}
              <label
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                  marginTop: "1rem",
                  color: "var(--text-muted)",
                }}
              >
                Number of people talking
                <input
                  type="number"
                  min="1"
                  max="12"
                  value={speakerCount}
                  disabled={!canReviewAudio}
                  onChange={(event) => setSpeakerCount(event.target.value)}
                  style={{
                    maxWidth: "180px",
                    padding: "0.75rem",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    background: "transparent",
                    color: "inherit",
                  }}
                />
              </label>
              <button
                type="button"
                className="btn-ghost"
                disabled={!canReviewAudio}
                onClick={sendToTranscriber}
                style={{ marginTop: "1rem" }}
              >
                Send to transcriber
              </button>
            </div>
          )}

          {isTranscribing && (
            <div className="settings-panel">
              <h2>Transcribing Audio</h2>
              <p className="settings-hint">
                The backend is processing the reviewed audio and speaker count.
              </p>
            </div>
          )}

          {canReviewTranscript && (
            <div className="settings-panel">
              <h2>Review Transcript</h2>
              <p className="settings-hint">
                Make corrections before this text is sent to the summarizer.
              </p>
              
              <textarea
                value={transcriptDraft}
                disabled={!canReviewTranscript}
                onChange={(event) => setTranscriptDraft(event.target.value)}
                rows={18}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  minHeight: "350px",
                  marginTop: "1rem",
                  padding: "1.25rem",
                  borderRadius: "8px",
                  border: "1px solid var(--border)",
                  background: "transparent",
                  color: "inherit",
                  fontSize: "1rem",
                  lineHeight: "1.55",
                  resize: "vertical",
                }}
              />

              {/* The old dropdown grid block was removed from here! */}

              <button
                type="button"
                className="btn-ghost"
                disabled={!canReviewTranscript}
                onClick={sendToSummarizer}
                style={{ marginTop: "1rem" }}
              >
                Send to summarizer
              </button>
            </div>
          )}

          {isSummarizing && (
            <div className="settings-panel">
              <h2>Summarizing Transcript</h2>
              <p className="settings-hint">
                The edited transcript is being turned into instructor-facing feedback.
              </p>
            </div>
          )}

          
          {summaryDraft && canReviewSummary && (
            <div className="settings-panel">
              <h2>Review Summary</h2>
              <p className="settings-hint">
                Select the teacher and course, then edit the summary before saving the final feedback.
              </p>

              {}
              <div className="feedback-metadata-grid" style={{ marginBottom: "1.5rem" }}>
                {/* 1. TEACHER DROPDOWN */}
                <section className="feedback-metadata-field">
                  <h3>1. Teacher</h3>
                  <select 
                    value={selectedTeacher} 
                    disabled={metadataLoading || workflowStep === "complete"} 
                    onChange={(event) => handleTeacherChange(event.target.value)}
                    style={{ 
                      width: "100%", 
                      padding: "0.75rem", 
                      borderRadius: "8px", 
                      border: "1px solid var(--border)", 
                      background: "#1e1e24", 
                      color: "#ffffff" 
                    }}
                  >
                    <option value="" style={{ background: "#1e1e24", color: "#ffffff" }}>
                      {metadataLoading ? "Loading teachers..." : "Choose a teacher"}
                    </option>
                    {teachers.map((teacher, idx) => (
                      <option 
                        key={teacher.teacher_id || teacher.id || idx} 
                        value={teacher.teacher_id || teacher.id}
                        style={{ background: "#1e1e24", color: "#ffffff" }}
                      >
                        {teacher.name}
                      </option>
                    ))}
                  </select>
                </section>

                {/* 2. COURSE DROPDOWN */}
                <section className="feedback-metadata-field">
                  <h3>2. Course</h3>
                  <select 
                    value={selectedCourse} 
                    disabled={!selectedTeacher || metadataLoading || workflowStep === "complete"} 
                    onChange={(event) => setSelectedCourse(event.target.value)}
                    style={{ 
                      width: "100%", 
                      padding: "0.75rem", 
                      borderRadius: "8px", 
                      border: "1px solid var(--border)", 
                      background: "#1e1e24", 
                      color: "#ffffff" 
                    }}
                  >
                    <option value="" style={{ background: "#1e1e24", color: "#ffffff" }}>
                      {!selectedTeacher ? "Select a teacher first" : "Choose a course"}
                    </option>
                    {courses.map((course, idx) => (
                      <option 
                        key={course.course_id || course.id || idx} 
                        value={course.course_id || course.id}
                        style={{ background: "#1e1e24", color: "#ffffff" }}
                      >
                        {course.name}
                      </option>
                    ))}
                  </select>
                </section>
              </div>

              {}
              <textarea
                value={summaryDraft}
                disabled={workflowStep === "complete"}
                onChange={(event) => setSummaryDraft(event.target.value)}
                rows={14}
                style={{
                  width: "100%",
                  minHeight: "220px",
                  padding: "1.25rem",
                  borderRadius: "8px",
                  border: "1px solid var(--border)",
                  background: "transparent",
                  color: "inherit",
                  fontSize: "1rem",
                  lineHeight: "1.55",
                  resize: "vertical",
                }}
              />

              {}
              <button
                type="button"
                className="btn-ghost"
                disabled={!canReviewSummary || workflowStep === "complete" || !selectedCourse || !selectedTeacher}
                onClick={finalizeFeedback}
                style={{ marginTop: "1rem" }}
              >
                Finalize feedback
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
