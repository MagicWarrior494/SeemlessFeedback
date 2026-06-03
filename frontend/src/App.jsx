import React, { useCallback, useState } from "react";
import Sidebar from "./components/Sidebar";
import AboutPage from "./pages/AboutPage";
import HistoryPage from "./pages/HistoryPage";
import RecordPage from "./pages/RecordPage";
import SettingsPage from "./pages/SettingsPage";
import { clearHistory, loadHistory } from "./utils/historyStorage";

const PAGES = {
  record: RecordPage,
  history: HistoryPage,
  settings: SettingsPage,
  about: AboutPage,
};

export default function App() {
  const [page, setPage] = useState("record");
  const [history, setHistory] = useState(() => loadHistory());

  const refreshHistory = useCallback(() => {
    setHistory(loadHistory());
  }, []);

  const handleClearHistory = useCallback(() => {
    if (window.confirm("Clear all recording history from this browser?")) {
      clearHistory();
      setHistory([]);
    }
  }, []);

  const Page = PAGES[page];

  return (
    <div className="app">
      <Sidebar active={page} onNavigate={setPage} />
      <main className="main">
        {page === "record" ? (
          <RecordPage onHistoryUpdate={refreshHistory} />
        ) : page === "history" ? (
          <HistoryPage entries={history} onClear={handleClearHistory} />
        ) : (
          <Page />
        )}
      </main>
    </div>
  );
}
