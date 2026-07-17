import React, { useCallback, useEffect, useState } from "react";
import Sidebar from "./components/Sidebar";
import AboutPage from "./pages/AboutPage";
import CoursesPage from "./pages/CoursesPage";
import FeedbackChoicePage from "./pages/FeedbackChoicePage";
import HistoryPage from "./pages/HistoryPage";
import LoginPage from "./pages/LoginPage";
import RecordPage from "./pages/RecordPage";
import SettingsPage from "./pages/SettingsPage";
import TextFeedbackPage from "./pages/TextFeedbackPage";
import logoImg from "./assets/logo.png";
import { clearHistory } from "./utils/historyStorage";

const PAGES = {
  "feedback-choice": FeedbackChoicePage,
  record: RecordPage,
  text: TextFeedbackPage,
  history: HistoryPage,
  settings: SettingsPage,
  about: AboutPage,
  courses: CoursesPage,
};

export default function App() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState("feedback-choice");
  const [history, setHistory] = useState([]);

  const refreshHistory = useCallback(async () => {
    if (!user) return;

    try {
      const response = await fetch("http://127.0.0.1:8000/tasks/history", {
        method: "GET",
        headers: {
          "X-User-Role": user.role,
          "X-User-Id": user.user_id,
        },
      });

      if (response.ok) {
        const backendJobsArray = await response.json();
        setHistory(backendJobsArray);
      } else if (response.status === 403) {
        setHistory([]);
      }
    } catch (err) {
      console.error("Could not sync master database history records:", err);
    }
  }, [user]);

  // Fetch once `user` is actually committed to state. Calling refreshHistory()
  // straight from the login handler runs a closure captured when user was still
  // null, so it bails at the !user guard and never fetches.
  useEffect(() => {
    if (user?.role === "instructor") {
      refreshHistory();
    }
  }, [user, refreshHistory]);

  const handleClearHistory = useCallback(() => {
    if (window.confirm("Clear all recording history from this browser?")) {
      clearHistory();
      setHistory([]);
    }
  }, []);

  const handleLogout = useCallback(() => {
    setUser(null);
    setPage("feedback-choice");
    setHistory([]);
  }, []);

  if (!user) {
    return (
      <LoginPage
        onLoginSuccess={(loggedInUser) => {
          setUser(loggedInUser);

          if (loggedInUser.role === "instructor") {
            setPage("history");
          } else {
            setPage("feedback-choice");
          }
        }}
      />
    );
  }

  const activePageKey =
    user.role === "student" && (page === "history" || page === "courses")
      ? "feedback-choice"
      : page;

  const Page = PAGES[activePageKey] || FeedbackChoicePage;

  return (
    <div className="app">
      <Sidebar
        active={activePageKey}
        onNavigate={(targetPage) => {
          if (user.role === "student" && (targetPage === "history" || targetPage === "courses")) return;
          setPage(targetPage);
        }}
        userRole={user.role}
      />

      <main className="main">
        <header className="topbar">
          <button
            type="button"
            className="topbar-brand"
            onClick={() => setPage(user.role === "student" ? "feedback-choice" : "history")}
          >
            <img src={logoImg} alt="Seemless logo" />
            <span>Seemless Feedback</span>
          </button>
          <div className="topbar-actions">
            <span className="workspace-badge">● {user.role} workspace</span>
            <button type="button" className="btn-ghost" onClick={handleLogout}>
              Log out
            </button>
          </div>
        </header>

        {activePageKey === "feedback-choice" ? (
          <FeedbackChoicePage onChoose={setPage} />
        ) : activePageKey === "record" ? (
          <RecordPage onHistoryUpdate={refreshHistory} onBackToChoice={() => setPage("feedback-choice")} />
        ) : activePageKey === "text" ? (
          <TextFeedbackPage onHistoryUpdate={refreshHistory} onBackToChoice={() => setPage("feedback-choice")} />
        ) : activePageKey === "history" && user.role === "instructor" ? (
          <HistoryPage entries={history} onClear={handleClearHistory} />
        ) : activePageKey === "courses" && user.role === "instructor" ? (
          <CoursesPage user={user} />
        ) : (
          <Page />
        )}
      </main>
    </div>
  );
}
