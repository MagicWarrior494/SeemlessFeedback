import React, { useState } from "react";
// 1. Import your logo asset file directly
import logoImg from "../assets/logo.png"; 

const API_BASE_URL = "http://127.0.0.1:8000";

export default function LoginPage({ onLoginSuccess }) {
  const [isRegistering, setIsRegistering] = useState(false); 
  const [role, setRole] = useState("student");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!email || !password) {
      setError("Please fill in all fields.");
      return;
    }

    try {
      if (isRegistering) {
        const response = await fetch(`${API_BASE_URL}/api/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, role }),
        });
        
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || "Registration failed.");
        
        setMessage("Account created successfully! You can now sign in.");
        setIsRegistering(false); 
      } else {
        const response = await fetch(`${API_BASE_URL}/api/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || "Invalid credentials.");
        
        onLoginSuccess(data.user);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={{ 
      display: "flex", justifyContent: "center", alignItems: "center", 
      minHeight: "100vh", width: "100vw", position: "fixed", 
      top: 0, left: 0, background: "#121214", zIndex: 9999 
    }}>
      <div className="settings-panel" style={{ width: "100%", maxWidth: "420px", padding: "2.5rem", borderRadius: "12px" }}>
        
        {/* Branding & Header Header */}
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          {/* 2. Larger Centered Logo Placement */}
          <img 
            src={logoImg} 
            alt="Seemless Brand Logo" 
            style={{ 
              width: "96px",        // Made it significantly larger for the landing page
              height: "96px", 
              objectFit: "contain",
              marginBottom: "1.25rem"
            }} 
          />
          <h1 style={{ fontSize: "1.8rem", fontWeight: "600", marginBottom: "0.5rem" }}>
            {isRegistering ? "Create an account" : "Welcome back"}
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
            {isRegistering ? "Sign up to start submitting feedback loops." : "Sign in to manage your feedback loops."}
          </p>
        </div>

        {/* Role Selector */}
        {isRegistering && (
          <div style={{ 
            display: "flex", background: "rgba(255, 255, 255, 0.05)", 
            padding: "4px", borderRadius: "8px", marginBottom: "2rem", border: "1px solid var(--border)"
          }}>
            <button
              type="button"
              onClick={() => setRole("student")}
              style={{
                flex: 1, padding: "0.6rem", borderRadius: "6px", border: "none", cursor: "pointer",
                background: role === "student" ? "var(--border)" : "transparent", color: "inherit",
              }}
            >
              Student
            </button>
            <button
              type="button"
              onClick={() => setRole("instructor")}
              style={{
                flex: 1, padding: "0.6rem", borderRadius: "6px", border: "none", cursor: "pointer",
                background: role === "instructor" ? "var(--border)" : "transparent", color: "inherit",
              }}
            >
              Instructor
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: "0.5rem", color: "var(--text-muted)" }}>
            Academic Email
            <input
              type="email"
              placeholder="you@university.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ padding: "0.75rem", borderRadius: "8px", border: "1px solid var(--border)", background: "transparent", color: "inherit" }}
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: "0.5rem", color: "var(--text-muted)" }}>
            Password
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ padding: "0.75rem", borderRadius: "8px", border: "1px solid var(--border)", background: "transparent", color: "inherit" }}
            />
          </label>

          {error && <p style={{ color: "#ff6b6b", fontSize: "0.85rem", margin: "0", textAlign: "center" }}>⚠️ {error}</p>}
          {message && <p style={{ color: "#2ecc71", fontSize: "0.85rem", margin: "0", textAlign: "center" }}>✅ {message}</p>}

          <button
            type="submit"
            className="btn-ghost"
            style={{ marginTop: "0.5rem", padding: "0.85rem", width: "100%", background: "var(--border)", fontWeight: "500" }}
          >
            {isRegistering ? "Sign Up" : "Sign In"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: "1.5rem" }}>
          <button
            type="button"
            onClick={() => {
              setIsRegistering(!isRegistering);
              setError("");
              setMessage("");
            }}
            style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", textDecoration: "underline" }}
          >
            {isRegistering ? "Already have an account? Sign In" : "Don't have an account? Create one"}
          </button>
        </div>

      </div>
    </div>
  );
}