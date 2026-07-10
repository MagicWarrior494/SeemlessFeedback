import React from "react";
// 1. Import your logo asset file directly
import logoImg from "../assets/logo.png"; 

const NAV_ITEMS = [
  { id: "record", label: "Record" },
  { id: "courses", label: "Courses" },
  { id: "history", label: "History" },
  { id: "about", label: "About" },
  { id: "settings", label: "Settings" },
];

export default function Sidebar({ active, onNavigate, userRole }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand" style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        {}
        <img 
          src={logoImg} 
          alt="Seemless Logo" 
          style={{ 
            width: "48px", 
            height: "48px", 
            objectFit: "contain" 
          }} 
        />
        <span className="sidebar-title">Seemless</span>
      </div>
      <nav className="sidebar-nav" aria-label="Main">
        {NAV_ITEMS.map((item) => {
          if (userRole === "student" && (item.id === "history" || item.id === "courses")) {
            return null;
          }

          return (
            <button
              key={item.id}
              type="button"
              className={`sidebar-link${active === item.id ? " sidebar-link--active" : ""}`}
              onClick={() => onNavigate(item.id)}
              aria-current={active === item.id ? "page" : undefined}
            >
              {item.item || item.label}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}