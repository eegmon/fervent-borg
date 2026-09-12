import React, { useState } from "react";
import * as XLSX from "xlsx";
import {
  FileSpreadsheet,
  Download,
  Upload,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

const REQUIRED_COLS = [
  "수제번호",
  "형제번호",
  "죄명",
  "검사명",
  "피고인명",
  "현재 상황",
  "접수일시",
  "접수근거",
  "처분내용",
];

const PREVIEW_COLS = [
  { key: "수제번호", label: "수제번호" },
  { key: "형제번호", label: "형제번호" },
  { key: "죄명", label: "죄명" },
  { key: "검사명", label: "검사명" },
  { key: "피고인명", label: "피고인명" },
  { key: "현재 상황", label: "현재 상황" },
  { key: "접수일시", label: "접수일시" },
  { key: "처분내용", label: "처분내용" },
];

const MAX_IMPORT_FILE_BYTES = 10 * 1024 * 1024;
const MAX_IMPORT_ROWS = 5000;

/**
 * 엑셀 파일 일괄 사건 등록 탭
 */
export default function ExcelImportTab({ onBulkImport }) {
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [imported, setImported] = useState(false);

  const parseFile = (file) => {
    setError("");
    setRows([]);
    setImported(false);
    if (!file) return;
    const ext = file.name.split(".").pop().toLowerCase();
    if (!["xlsx", "xls"].includes(ext)) {
      setError(".xlsx 또는 .xls 파일만 지원합니다.");
      return;
    }
    if (file.size > MAX_IMPORT_FILE_BYTES) {
      setError("엑셀 파일은 10MB 이하만 업로드할 수 있습니다.");
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target.result), {
          type: "array",
          cellFormula: false,
          cellHTML: false,
          sheetRows: MAX_IMPORT_ROWS + 1,
        });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, {
          defval: "",
          raw: false,
        });
        // 헤더 행(예시 행)과 빈 행 필터링
        const filtered = data.filter((r) => {
          const key = r["형제번호"] || r["수제번호"] || "";
          return (
            key &&
            !String(key).startsWith("20xx") &&
            !String(key).startsWith("ex)")
          );
        });
        if (filtered.length === 0) {
          setError(
            "유효한 데이터 행이 없습니다. 예시 행을 제외한 실제 데이터를 포함해주세요.",
          );
          return;
        }
        setRows(filtered);
      } catch (err) {
        setError("파일을 읽는 중 오류가 발생했습니다: " + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleFileInput = (e) => parseFile(e.target.files[0]);
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    parseFile(e.dataTransfer.files[0]);
  };

  const handleImport = () => {
    if (!rows.length) return;
    onBulkImport(rows);
    setImported(true);
  };

  const downloadTemplate = () => {
    const headers = [
      "수제번호",
      "형제번호",
      "법원번호(최신)",
      "죄명",
      "검사명",
      "피고인명",
      "UUID",
      "현재 상황",
      "접수일시",
      "접수근거",
      "처분내용",
      "(불)공소장",
      "1심 사건번호",
      "1심 결과",
      "판결문",
      "항소 여부",
      "항소장",
      "2심 사건번호",
      "항소기각",
      "2심 결과",
      "판결문(항소)",
      "상고 여부",
      "상고장",
      "3심 사건번호",
      "파기환송",
      "3심 결과",
      "판결문(상고)",
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "사건원부");
    XLSX.writeFile(wb, "도스온라인_검찰청_사건원부_양식.xlsx");
  };

  const downloadAppealTemplate = () => {
    const headers = [
      "지불항번호",
      "고불항번호",
      "재불항번호",
      "대재불항번호",
      "죄명",
      "검사명",
      "피고인명",
      "항고처분",
      "항고일시",
      "항고근거",
      "항고결정",
      "항고결정통지서",
      "수제번호",
      "형제번호",
      "법원번호",
      "항고 상황",
      "검사장",
      "검찰총장",
      "UUID",
      "원처분상황",
      "접수일시",
      "접수근거",
      "기소여부",
      "공소장/불공소장",
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "항고대장");
    XLSX.writeFile(wb, "도스온라인_검찰청_항고대장_양식.xlsx");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* 헤더 */}
      <div className="glass-panel" style={{ padding: "18px 24px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <div
              style={{
                fontWeight: 800,
                fontSize: "0.95rem",
                color: "var(--text-main)",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <FileSpreadsheet size={16} color="var(--primary-amber)" />
              엑셀 파일 일괄 사건 등록
            </div>
            <div
              style={{
                fontSize: "0.72rem",
                color: "var(--text-muted)",
                marginTop: 4,
              }}
            >
              지정된 컬럼 형식의 .xlsx 파일을 업로드하면 사건 원부에 일괄
              등록됩니다. 예시 행(20xx수제xxx)은 자동으로 제외됩니다.
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={downloadTemplate}
              className="btn btn-secondary"
              style={{ fontSize: "0.8rem", gap: 6 }}
            >
              <Download size={14} />
              원부 양식
            </button>
            <button
              onClick={downloadAppealTemplate}
              className="btn btn-gold"
              style={{ fontSize: "0.8rem", gap: 6 }}
            >
              <Download size={14} />
              항고대장 양식
            </button>
          </div>
        </div>

        {/* 컬럼 안내 */}
        <div
          style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 6 }}
        >
          {REQUIRED_COLS.map((c) => (
            <span
              key={c}
              style={{
                fontSize: "0.7rem",
                padding: "2px 8px",
                background: "rgba(245,158,11,0.12)",
                border: "1px solid rgba(245,158,11,0.3)",
                borderRadius: 4,
                color: "#f59e0b",
              }}
            >
              {c}
            </span>
          ))}
          <span
            style={{
              fontSize: "0.7rem",
              color: "var(--text-muted)",
              alignSelf: "center",
            }}
          >
            외 17개 컬럼
          </span>
        </div>
      </div>

      {/* 드래그앤드롭 업로드 */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={() => document.getElementById("bulk-excel-input").click()}
        style={{
          border: `2px dashed ${isDragOver ? "var(--primary-amber)" : "var(--border-subtle)"}`,
          borderRadius: 12,
          padding: "40px 24px",
          textAlign: "center",
          cursor: "pointer",
          background: isDragOver ? "rgba(245,158,11,0.05)" : "transparent",
          transition: "all 0.2s",
        }}
      >
        <Upload
          size={32}
          color={isDragOver ? "var(--primary-amber)" : "var(--text-muted)"}
          style={{ margin: "0 auto 12px" }}
        />
        <div
          style={{
            fontWeight: 700,
            color: "var(--text-main)",
            fontSize: "0.9rem",
          }}
        >
          엑셀 파일을 드래그하거나 클릭하여 선택
        </div>
        <div
          style={{
            fontSize: "0.75rem",
            color: "var(--text-muted)",
            marginTop: 4,
          }}
        >
          {fileName ? `📄 ${fileName}` : ".xlsx, .xls 지원"}
        </div>
        <input
          id="bulk-excel-input"
          type="file"
          accept=".xlsx,.xls"
          style={{ display: "none" }}
          onChange={handleFileInput}
        />
      </div>

      {/* 오류 */}
      {error && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "12px 16px",
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: 8,
            color: "#f87171",
            fontSize: "0.82rem",
          }}
        >
          <AlertCircle size={15} />
          {error}
        </div>
      )}

      {/* 성공 */}
      {imported && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "12px 16px",
            background: "rgba(22,163,74,0.1)",
            border: "1px solid rgba(22,163,74,0.3)",
            borderRadius: 8,
            color: "#4ade80",
            fontSize: "0.82rem",
          }}
        >
          <CheckCircle2 size={15} />
          {rows.length}건이 사건 원부에 성공적으로 등록되었습니다.
        </div>
      )}

      {/* 미리보기 + 등록 버튼 */}
      {rows.length > 0 && (
        <div className="glass-panel" style={{ overflow: "hidden" }}>
          <div
            style={{
              padding: "14px 18px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottom: "1px solid var(--border-subtle)",
            }}
          >
            <div
              style={{
                fontWeight: 800,
                fontSize: "0.88rem",
                color: "var(--text-main)",
              }}
            >
              미리보기 —{" "}
              <span style={{ color: "var(--primary-amber)" }}>
                {rows.length}건
              </span>{" "}
              감지됨
            </div>
            <button
              onClick={handleImport}
              className="btn btn-gold"
              style={{ fontSize: "0.82rem" }}
              disabled={imported}
            >
              <CheckCircle2 size={14} />
              {imported ? "등록 완료" : `${rows.length}건 일괄 등록`}
            </button>
          </div>
          <div style={{ overflowX: "auto", maxHeight: 400 }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "0.78rem",
              }}
            >
              <thead>
                <tr
                  style={{
                    background: "var(--bg-elevated)",
                    position: "sticky",
                    top: 0,
                  }}
                >
                  <th
                    style={{
                      padding: "8px 12px",
                      textAlign: "left",
                      color: "var(--text-muted)",
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                    }}
                  >
                    #
                  </th>
                  {PREVIEW_COLS.map((c) => (
                    <th
                      key={c.key}
                      style={{
                        padding: "8px 12px",
                        textAlign: "left",
                        color: "var(--text-muted)",
                        fontWeight: 700,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr
                    key={i}
                    style={{
                      borderTop: "1px solid var(--border-subtle)",
                      background:
                        i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)",
                    }}
                  >
                    <td
                      style={{
                        padding: "7px 12px",
                        color: "var(--text-muted)",
                      }}
                    >
                      {i + 1}
                    </td>
                    {PREVIEW_COLS.map((c) => (
                      <td
                        key={c.key}
                        style={{
                          padding: "7px 12px",
                          color: "var(--text-main)",
                          whiteSpace: "nowrap",
                          maxWidth: 180,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {String(row[c.key] || "-")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
