import React from "react";

const NAV_ITEMS = [
  { id: "record", label: "Record" },
  { id: "history", label: "History" },
  { id: "settings", label: "Settings" },
  { id: "about", label: "About" },
];

export default function Sidebar({ active, onNavigate }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="sidebar-logo" aria-hidden="true" />
        <span className="sidebar-title">Seemless</span>
      </div>
      <nav className="sidebar-nav" aria-label="Main">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`sidebar-link${active === item.id ? " sidebar-link--active" : ""}`}
            onClick={() => onNavigate(item.id)}
            aria-current={active === item.id ? "page" : undefined}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </aside>
  );
}
