import React, { useState, useEffect, useCallback } from "react";

const API_BASE_URL = "http://127.0.0.1:8000";

export default function CoursesPage({ user }) {
  const [courseName, setCourseName] = useState("");
  const [teacherName, setTeacherName] = useState("");
  const [linkAccount, setLinkAccount] = useState(true);
  const [courses, setCourses] = useState([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // Fetch courses assigned to this instructor/user
  const fetchCourses = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/courses`, {
        headers: {
          "X-User-Id": user?.user_id || user?.id || "",
          "X-User-Role": user?.role || "instructor"
        }
      });
      if (response.ok) {
        const data = await response.json();
        setCourses(data);
      }
    } catch (err) {
      console.error("Failed to load courses:", err);
    }
  }, [user]);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  const handleCreateCourseAssignment = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!courseName.trim() || !teacherName.trim()) {
      setError("Both Course Name and Instructor Name are required.");
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/courses/manage`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": user?.user_id || user?.id || "",
          "X-User-Role": user?.role || "instructor"
        },
        body: JSON.stringify({
          course_name: courseName.trim(),
          teacher_name: teacherName.trim(),
          link_account: linkAccount
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Failed to link course assignment.");

      setMessage(`Successfully linked "${courseName}" with ${teacherName}!`);
      setCourseName("");
      setTeacherName("");
      fetchCourses();
    } catch (err) {
      console.error("Course creation error:", err);
      setError(err.message || "Could not reach backend server.");
    }
  };

  return (
    <div className="page" style={{ padding: "2.5rem", maxWidth: "800px", margin: "0 auto" }}>
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "1.8rem", fontWeight: "600", marginBottom: "0.5rem" }}>Course & Instructor Setup</h1>
        <p style={{ color: "var(--text-muted)" }}>Create class channels and link your instructor profile to feedback streams.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem", alignItems: "start" }}>
        
        {/* Creation Panel */}
        <div className="settings-panel" style={{ padding: "1.75rem", borderRadius: "12px" }}>
          <h2 style={{ fontSize: "1.2rem", marginBottom: "1.25rem" }}>Add & Link Course</h2>
          <form onSubmit={handleCreateCourseAssignment} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            
            <label style={{ display: "flex", flexDirection: "column", gap: "0.5rem", color: "var(--text-muted)" }}>
              Course Name
              <input
                type="text"
                placeholder="e.g., CSE 310"
                value={courseName}
                onChange={(e) => setCourseName(e.target.value)}
                style={{ padding: "0.75rem", borderRadius: "8px", border: "1px solid var(--border)", background: "transparent", color: "inherit" }}
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: "0.5rem", color: "var(--text-muted)" }}>
              Instructor Display Name
              <input
                type="text"
                placeholder="e.g., Prof. Smith"
                value={teacherName}
                onChange={(e) => setTeacherName(e.target.value)}
                style={{ padding: "0.75rem", borderRadius: "8px", border: "1px solid var(--border)", background: "transparent", color: "inherit" }}
              />
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--text-muted)", fontSize: "0.85rem", cursor: "pointer", marginTop: "0.25rem" }}>
              <input
                type="checkbox"
                checked={linkAccount}
                onChange={(e) => setLinkAccount(e.target.checked)}
              />
              Link my account to this course and teacher combo
            </label>

            {error && <p style={{ color: "#ff6b6b", fontSize: "0.85rem", margin: "0" }}>⚠️ {error}</p>}
            {message && <p style={{ color: "#2ecc71", fontSize: "0.85rem", margin: "0" }}>✅ {message}</p>}

            <button type="submit" className="btn-ghost" style={{ padding: "0.75rem", background: "var(--border)", fontWeight: "500", marginTop: "0.5rem" }}>
              Save & Link Assignment
            </button>
          </form>
        </div>

        {/* Active List Display */}
        <div className="settings-panel" style={{ padding: "1.75rem", borderRadius: "12px" }}>
          <h2 style={{ fontSize: "1.2rem", marginBottom: "1.25rem" }}>Your Active Courses</h2>
          {courses.length === 0 ? (
            <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", fontStyle: "italic" }}>No active courses found. Create one to get started.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {courses.map((course) => (
                <li key={course.course_id} style={{ padding: "0.75rem 1rem", borderRadius: "8px", border: "1px solid var(--border)", background: "rgba(255,255,255,0.02)" }}>
                  <span style={{ fontWeight: "500" }}>{course.name}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

      </div>
    </div>
  );
}