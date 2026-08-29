import React, { useState, useRef, useEffect } from "react";
import { Search, X, ChevronDown } from "lucide-react";

/**
 * 죄명 검색 가능한 드롭다운 입력 컴포넌트
 *
 * Props:
 *   value        {string}   현재 선택된 죄명
 *   onChange     {fn}       (newValue: string) => void
 *   chargesData  {Array}    죄명 목록 ({ id, name } 또는 string)
 *   placeholder  {string}   입력창 placeholder
 *   required     {boolean}
 */
export default function ChargeSearchInput({
  value = "",
  onChange,
  chargesData = [],
  placeholder = "죄명 직접 입력 또는 목록 검색",
  required = false,
}) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  // 부모 value가 바뀌면 내부 query도 동기화
  useEffect(() => {
    setQuery(value);
  }, [value]);

  // 바깥 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handleOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const normalizedCharges = chargesData.map((c) =>
    typeof c === "string" ? { id: c, name: c } : { id: c.id ?? c.name, name: c.name ?? c }
  );

  const filtered = query.trim()
    ? normalizedCharges.filter((c) =>
        c.name.toLowerCase().includes(query.trim().toLowerCase())
      )
    : normalizedCharges;

  const handleInputChange = (e) => {
    const v = e.target.value;
    setQuery(v);
    onChange(v);
    setOpen(true);
  };

  const handleSelect = (name) => {
    setQuery(name);
    onChange(name);
    setOpen(false);
  };

  const handleClear = () => {
    setQuery("");
    onChange("");
    setOpen(false);
  };

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%" }}>
      {/* 입력 영역 */}
      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
        <Search
          size={13}
          style={{
            position: "absolute",
            left: 9,
            color: "var(--text-muted)",
            pointerEvents: "none",
            flexShrink: 0,
          }}
        />
        <input
          className="input-field"
          style={{ paddingLeft: 28, paddingRight: query ? 50 : 30 }}
          value={query}
          onChange={handleInputChange}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          required={required}
          autoComplete="off"
        />
        {/* 지우기 버튼 */}
        {query && (
          <button
            type="button"
            onClick={handleClear}
            style={{
              position: "absolute",
              right: 24,
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-muted)",
              padding: "2px",
              display: "flex",
              alignItems: "center",
            }}
            tabIndex={-1}
            aria-label="죄명 지우기"
          >
            <X size={12} />
          </button>
        )}
        {/* 드롭다운 토글 화살표 */}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          style={{
            position: "absolute",
            right: 6,
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--text-muted)",
            padding: "2px",
            display: "flex",
            alignItems: "center",
          }}
          tabIndex={-1}
          aria-label="죄명 목록 열기"
        >
          <ChevronDown
            size={13}
            style={{
              transition: "transform 0.15s",
              transform: open ? "rotate(180deg)" : "rotate(0deg)",
            }}
          />
        </button>
      </div>

      {/* 드롭다운 목록 */}
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            zIndex: 9999,
            background: "var(--bg-elevated, #1e2535)",
            border: "1px solid var(--border-subtle, rgba(255,255,255,0.1))",
            borderRadius: 8,
            maxHeight: 220,
            overflowY: "auto",
            boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
          }}
          role="listbox"
        >
          {filtered.length === 0 ? (
            <div
              style={{
                padding: "10px 12px",
                fontSize: "0.78rem",
                color: "var(--text-muted)",
                textAlign: "center",
              }}
            >
              일치하는 죄명이 없습니다. 직접 입력하세요.
            </div>
          ) : (
            filtered.map((c) => (
              <button
                key={c.id}
                type="button"
                role="option"
                aria-selected={c.name === value}
                onClick={() => handleSelect(c.name)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  background:
                    c.name === value
                      ? "rgba(245,158,11,0.18)"
                      : "transparent",
                  border: "none",
                  borderBottom: "1px solid rgba(255,255,255,0.05)",
                  padding: "8px 12px",
                  fontSize: "0.82rem",
                  color: c.name === value ? "var(--primary-amber)" : "var(--text-main)",
                  cursor: "pointer",
                  fontWeight: c.name === value ? 700 : 400,
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) => {
                  if (c.name !== value)
                    e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                }}
                onMouseLeave={(e) => {
                  if (c.name !== value)
                    e.currentTarget.style.background = "transparent";
                }}
              >
                {c.name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
