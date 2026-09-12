/**
 * server/index.js
 * Dose-PROS REST API 서버 (Express + Turso + bcrypt + JWT)
 */
import express from "express";
import cors from "cors";
import "dotenv/config";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

import { db, initDb } from "./db.js";
import { requireReadWrite } from "./middlewares/auth.js";
import { toCamel } from "./utils/helpers.js";
import { writeAuditLog } from "./services/auditService.js";

// 도메인별 라우터 임포트
import authRouter from "./routes/auth.routes.js";
import eventsRouter from "./routes/events.routes.js";
import reportsRouter from "./routes/reports.routes.js";
import appealsRouter from "./routes/appeals.routes.js";
import bookingsRouter from "./routes/bookings.routes.js";
import warrantsRouter from "./routes/warrants.routes.js";
import schedulesRouter from "./routes/schedules.routes.js";
import evidenceRouter from "./routes/evidence.routes.js";
import casesRouter from "./routes/cases.routes.js";
import approvalsRouter from "./routes/approvals.routes.js";
import adminRouter from "./routes/admin.routes.js";
import aiRouter from "./routes/ai.routes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error(
    "[FATAL] JWT_SECRET 환경변수가 설정되지 않았습니다. 서버를 종료합니다.",
  );
  process.exit(1);
}

// ── CORS 설정 ────────────────────────────────────────────────────────
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
      .map((o) => o.trim())
      .filter(Boolean)
  : process.env.NODE_ENV === "production" && process.env.RENDER_EXTERNAL_URL
    ? [process.env.RENDER_EXTERNAL_URL.replace(/\/$/, "")]
    : [];

if (process.env.NODE_ENV === "production" && allowedOrigins.length === 0) {
  console.error(
    "[FATAL] 운영 환경에서는 ALLOWED_ORIGINS 환경변수가 필요합니다.",
  );
  process.exit(1);
}

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowedOrigins.length === 0 || allowedOrigins.includes(origin))
        return cb(null, true);
      cb(new Error(`CORS: ${origin} 은 허용되지 않는 출처입니다.`));
    },
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 200,
  }),
);

app.use(express.json({ limit: "10mb" }));
app.disable("x-powered-by");
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains",
  );
  next();
});

// ── 읽기전용 계정 쓰기 요청 차단 ─────────────────────────────────────
app.use("/api", (req, res, next) => {
  const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
  if (!WRITE_METHODS.has(req.method)) return next();
  if (req.path === "/auth/return" || req.path === "/auth/login" || req.path === "/auth/register") return next();
  return requireReadWrite(req, res, next);
});

// ── 도메인 라우터 마운트 ──────────────────────────────────────────────
app.use("/api/auth", authRouter);
app.use("/api", eventsRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/appeals", appealsRouter);
app.use("/api/bookings", bookingsRouter);
app.use("/api/warrants", warrantsRouter);
app.use("/api/schedules", schedulesRouter);
app.use("/api", evidenceRouter);
app.use("/api", casesRouter);
app.use("/api", approvalsRouter);
app.use("/api", adminRouter);
app.use("/api", aiRouter);

// ── 운영 상태 확인 ───────────────────────────────────────────────────
app.get("/api/health", async (_req, res) => {
  try {
    await db.execute("SELECT 1");
    res.json({ status: "ok" });
  } catch (err) {
    console.error("[GET /health]", err.message);
    res.status(503).json({ status: "error" });
  }
});

// ── 정적 파일 서빙 (프로덕션) ────────────────────────────────────────
const distPath = join(__dirname, "..", "dist");
app.use(express.static(distPath));

// API 라우트가 아닌 모든 요청은 index.html로 (SPA 라우팅)
app.get("/{*splat}", (_req, res) => {
  res.sendFile(join(distPath, "index.html"));
});

// ── 전역 에러 핸들러 ─────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error("[Unhandled Error]", req.method, req.path, err);
  if (res.headersSent) return;
  res
    .status(500)
    .json({ success: false, message: "서버 오류가 발생했습니다." });
});

// ── 불기소 자동보존 스케줄러 ─────────────────────────────────────────
const NON_INDICT_KEYWORDS = [
  "불기소",
  "혐의없음",
  "무혐의",
  "기소유예",
  "공소권없음",
  "죄가안됨",
];

function isNonIndictDisposition(disposition) {
  if (!disposition) return false;
  return NON_INDICT_KEYWORDS.some((kw) => disposition.includes(kw));
}

function isCaseFullyNonIndict(disposition, suspectsDispositionsJson) {
  let dispositionsMap = {};
  try {
    if (suspectsDispositionsJson && suspectsDispositionsJson !== "{}") {
      const parsed = JSON.parse(suspectsDispositionsJson);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        dispositionsMap = parsed;
      }
    }
  } catch {}

  const entries = Object.values(dispositionsMap);
  if (entries.length > 0) {
    return entries.every((d) => isNonIndictDisposition(String(d || "")));
  }
  return isNonIndictDisposition(disposition);
}

async function runAutoArchiveScheduler() {
  try {
    const settingRows = await db.execute({
      sql: "SELECT key, value FROM system_settings WHERE key IN ('auto_archive_enabled', 'auto_archive_days')",
      args: [],
    });
    const settings = {};
    for (const row of settingRows.rows) settings[row.key] = row.value;

    if (settings["auto_archive_enabled"] === "0") return;

    const days = Math.max(1, Number(settings["auto_archive_days"] || 7));
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().replace("T", " ").substring(0, 19);

    const casesResult = await db.execute({
      sql: `SELECT id, hyeongje_no, suje_no, disposition,
                   COALESCE(suspects_dispositions, '{}') AS suspects_dispositions,
                   created_at
            FROM cases
            WHERE is_archived = 0
              AND deleted_at = ''
              AND created_at <= ?`,
      args: [cutoffStr],
    });

    let archivedCount = 0;
    for (const row of casesResult.rows) {
      const c = toCamel(row);
      if (!isCaseFullyNonIndict(c.disposition, c.suspectsDispositions)) continue;

      const appealCheck = await db.execute({
        sql: `SELECT id FROM appeals
              WHERE deleted_at = ''
                AND (hyeongje_no = ? OR suje_no = ? OR hyeongje_no = ? OR suje_no = ?)
              LIMIT 1`,
        args: [
          c.hyeongjeNo || "",
          c.hyeongjeNo || "",
          c.sujeNo || "",
          c.sujeNo || "",
        ],
      });
      if (appealCheck.rows.length > 0) continue;

      const nowStr = new Date()
        .toISOString()
        .replace("T", " ")
        .substring(0, 19);
      await db.execute({
        sql: "UPDATE cases SET is_archived=1, archived_at=?, archived_by=? WHERE id=?",
        args: [nowStr, "[자동보존]", c.id],
      });
      await writeAuditLog({
        action: "UPDATE",
        entityType: "case",
        entityId: c.id,
        entityLabel: c.hyeongjeNo || c.sujeNo || c.id,
        actorId: "SYSTEM",
        actorName: "자동보존 스케줄러",
        detail: `불기소 처분 후 ${days}일 경과, 항고 없음 — 자동 보존 처리 (처분: ${c.disposition || "-"})`,
      });
      archivedCount++;
    }

    if (archivedCount > 0) {
      console.log(
        `[자동보존] ${archivedCount}건 자동 보존 완료 (기준: ${days}일)`,
      );
    }
  } catch (e) {
    console.error("[자동보존 스케줄러 오류]", e.message);
  }
}

// ── 서버 시작 ────────────────────────────────────────────────────────
async function start() {
  await initDb();
  app.listen(PORT, () => {
    console.log(`[Dose-PROS API] http://localhost:${PORT}`);
  });
  setTimeout(() => {
    runAutoArchiveScheduler();
    setInterval(runAutoArchiveScheduler, 60 * 60 * 1000);
  }, 60 * 1000);
}

start().catch((err) => {
  console.error("[FATAL] 서버 시작 실패:", err);
  process.exit(1);
});
