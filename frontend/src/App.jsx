import React, { useCallback, useState } from "react";
import Sidebar from "./components/Sidebar";
import AboutPage from "./pages/AboutPage";
import HistoryPage from "./pages/HistoryPage";
import RecordPage from "./pages/RecordPage";
import SettingsPage from "./pages/SettingsPage";
import LoginPage from "./pages/LoginPage";
import CoursesPage from "./pages/CoursesPage";
import { clearHistory, loadHistory } from "./utils/historyStorage";

const PAGES = {
  record: RecordPage,
  history: HistoryPage,
  settings: SettingsPage,
  about: AboutPage,
  courses: CoursesPage,
};

export default function App() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState("record");
  const [history, setHistory] = useState([]); // Double semicolon typo cleaned up here

  const refreshHistory = useCallback(async () => {
    if (!user) return;

    try {
      // FIXED: Point directly to the exact IPv4 address your Uvicorn engine uses
      const response = await fetch("http://127.0.0.1:8000/tasks/history", {
        method: "GET",
        headers: {
          "X-User-Role": user.role
        }
      });

      if (response.ok) {
        const backendJobsArray = await response.json();
        setHistory(backendJobsArray);
      } else if (response.status === 403) {
        console.log("🛡️ Student account detected: Skipping backend history pulling index sync.");
        setHistory([]);
      }
    } catch (err) {
      console.error("Could not sync master database history records:", err);
    }
  }, [user]);

  const handleClearHistory = useCallback(() => {
    if (window.confirm("Clear all recording history from this browser?")) {
      clearHistory();
      setHistory([]);
    }
  }, []);

  if (!user) {
    return <LoginPage onLoginSuccess={(loggedInUser) => {
      setUser(loggedInUser);
      
      if (loggedInUser.role === "instructor") {
        setPage("history");
        setTimeout(() => {
          refreshHistory();
        }, 50);
      } else {
        setPage("record");
      }
    }} />;
  }

  const activePageKey = (user.role === "student" && page === "history") ? "record" : page;

  const Page = PAGES[activePageKey];

  return (
    <div className="app">
      {}
      <Sidebar 
        active={activePageKey} 
        onNavigate={(targetPage) => {
          if (user.role === "student" && targetPage === "history") return;
          setPage(targetPage);
        }} 
        userRole={user.role}
      />
      
      <main className="main" style={{ position: "relative" }}>
        {/* Sleek Minimal Role ID Badge Accent */}
        <div style={{
          position: "absolute",
          top: "1.5rem",
          right: "2.5rem",
          fontSize: "0.8rem",
          color: "var(--text-muted)",
          background: "rgba(255, 255, 255, 0.05)",
          padding: "4px 10px",
          borderRadius: "20px",
          border: "1px solid var(--border)",
          textTransform: "capitalize",
          zIndex: 10
        }}>
          ● {user.role} workspace
        </div>

        {/* FIXED: Uses activePageKey and checks roles directly before revealing layout elements */}
        {activePageKey === "record" ? (
          <RecordPage onHistoryUpdate={refreshHistory} />
        ) : (activePageKey === "history" && user.role === "instructor") ? (
          <HistoryPage entries={history} onClear={handleClearHistory} />
        ) : (activePageKey === "courses" && user.role === "instructor") ? (
          <CoursesPage user={user} /> // Safe mount verification parameters
        ) : (
          <Page />
        )}
      </main>``
    </div>
  );
}