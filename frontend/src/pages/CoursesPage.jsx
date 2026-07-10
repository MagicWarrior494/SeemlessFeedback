import React, { useState, useEffect, useCallback } from "react";

const API_BASE_URL = "http://127.0.0.1:8000";

export default function CoursesPage({ user }) {
  const [courses, setCourses] = useState([]);
  const [newCourseName, setNewCourseName] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // Fetch the master list of courses
  const fetchCourses = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/courses`);
      if (response.ok) {
        const data = await response.json();
        // Filter the global list so this instructor only sees courses they own
        const myCourses = data.filter(c => c.instructor_email === user.email);
        setCourses(myCourses);
      }
    } catch (err) {
      console.error("Failed to load courses:", err);
    }
  }, [user.email]);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  const handleCreateCourse = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!newCourseName.trim()) {
      setError("Course name cannot be empty.");
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/courses`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Role": user.role // Sends 'instructor' matching backend check rules
        },
        body: JSON.stringify({
          course_name: newCourseName.trim(),
          instructor_id: user.user_id // Drops the real user hex string identifier
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Failed to create course.");

      setMessage(`Successfully created "${newCourseName}"!`);
      setNewCourseName("");
      fetchCourses(); // Refresh list display
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="page" style={{ padding: "2.5rem", maxWidth: "800px", margin: "0 auto" }}>
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "1.8rem", fontWeight: "600", marginBottom: "0.5rem" }}>Course Management</h1>
        <p style={{ color: "var(--text-muted)" }}>Create and monitor your active class feedback channels.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem", alignItems: "start" }}>
        
        {/* Creation Panel */}
        <div className="settings-panel" style={{ padding: "1.75rem", borderRadius: "12px" }}>
          <h2 style={{ fontSize: "1.2rem", marginBottom: "1.25rem" }}>Add New Course</h2>
          <form onSubmit={handleCreateCourse} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: "0.5rem", color: "var(--text-muted)" }}>
              Course Name
              <input
                type="text"
                placeholder="e.g., CSE 310"
                value={newCourseName}
                onChange={(e) => setNewCourseName(e.target.value)}
                style={{ padding: "0.75rem", borderRadius: "8px", border: "1px solid var(--border)", background: "transparent", color: "inherit" }}
              />
            </label>

            {error && <p style={{ color: "#ff6b6b", fontSize: "0.85rem", margin: "0" }}>⚠️ {error}</p>}
            {message && <p style={{ color: "#2ecc71", fontSize: "0.85rem", margin: "0" }}>✅ {message}</p>}

            <button type="submit" className="btn-ghost" style={{ padding: "0.75rem", background: "var(--border)", fontWeight: "500" }}>
              Create Course Shell
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
                  <span style={{ fontWeight: "500" }}>{course.course_name}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

      </div>
    </div>
  );
}