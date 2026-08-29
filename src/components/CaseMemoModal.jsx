import React from "react";
import { X, MessageSquare } from "lucide-react";
import CaseMemoPanel from "./CaseMemoPanel";

export default function CaseMemoModal({ isOpen, onClose, caseItem, currentUser, onToast }) {
  if (!isOpen || !caseItem) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(3, 7, 18, 0.85)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        className="glass-panel gold-border"
        style={{
          width: "100%",
          maxWidth: 600,
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          borderRadius: 14,
          overflow: "hidden",
          boxShadow: "0 25px 60px rgba(0,0,0,0.8)",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 22px",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "rgba(15, 23, 42, 0.6)",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "rgba(245,158,11,0.15)",
                border: "1px solid rgba(245,158,11,0.4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <MessageSquare size={17} color="var(--primary-amber)" />
            </div>
            <div>
              <div
                style={{
                  fontWeight: 800,
                  fontSize: "0.95rem",
                  color: "var(--text-main)",
                }}
              >
                수사 메모
              </div>
              <div
                style={{
                  fontSize: "0.72rem",
                  color: "var(--primary-amber)",
                  fontFamily: "monospace",
                }}
              >
                {caseItem.hyeongjeNo && caseItem.hyeongjeNo !== "-" && caseItem.sujeNo
                  ? `${caseItem.hyeongjeNo}(${caseItem.sujeNo})`
                  : caseItem.hyeongjeNo || caseItem.sujeNo || "-"} ·{" "}
                {caseItem.suspectName}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-muted)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 4,
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 22px" }}>
          <CaseMemoPanel
            caseId={caseItem.id}
            hyeongjeNo={caseItem.hyeongjeNo}
            currentUser={currentUser}
            onToast={onToast}
          />
        </div>
      </div>
    </div>
  );
}
