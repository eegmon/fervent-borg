/**
 * server/routes/cases.routes.js
 * 사건(Cases) 원부 CRUD, 공식 사건번호 배정, 일괄등록/재배당, 보존, 피의자 프로필 라우트
 */
import { Router } from "express";
import { randomUUID } from "crypto";
import { db } from "../db.js";
import {
  requireAuth,
  requireSecretariat,
  requireCaseScope,
  scopedQuery,
  validateCaseAssignee,
  validateForcedCaseAssignee,
} from "../middlewares/auth.js";
import {
  ROLE_AUTHORITY,
  GLOBAL_DATA_ROLES,
  effectiveRoleLevel,
  hasGlobalDataAccess,
  hasSecretariatWorkAccess,
  isManagementAccount,
  isProsecutorGeneral,
} from "../config/roles.js";
import {
  toCamel,
  parseJsonArray,
  parseJsonObject,
  asyncWrap,
  validateFieldLengths,
  buildCaseDispositionSummary,
  normalizePrivateViewerIds,
  isPreBookingInvestigation,
  ALLOWED_EVIDENCE_MIME,
  EVIDENCE_MAX_BYTES,
} from "../utils/helpers.js";
import { writeAuditLog } from "../services/auditService.js";
import { sendNotificationToUser } from "../services/notificationService.js";

const router = Router();

// ── 1. 사건 목록 조회 (GET /api/cases) ────────────────────────────────
router.get(
  "/cases",
  requireAuth,
  asyncWrap(async (req, res) => {
    const result = await db.execute(scopedQuery("cases", req.user));
    const isSecretariat = hasSecretariatWorkAccess(req.user);
    const canViewPrivate = isProsecutorGeneral(req.user);

    const PRIVATE_MASKED_FIELDS = [
      "content",
      "notes",
      "bookingBasis",
      "suspectName",
      "suspectUuid",
    ];
    const rows = result.rows.map((row) => {
      const c = toCamel(row);
      c.suspects = Array.isArray(c.suspectsJson)
        ? c.suspectsJson
        : parseJsonArray(c.suspectsJson || c.suspects);
      c.suspectsDispositions = parseJsonObject(
        c.suspectsDispositions || c.suspects_dispositions,
      );
      if (c.suspects.length === 0 && c.suspectName) {
        c.suspects = [
          {
            id: c.suspectUuid || c.suspectName,
            name: c.suspectName,
            uuid: c.suspectUuid || "",
            role: "주범",
          },
        ];
      }
      if (
        c.visibility === "PRIVATE" &&
        !c.isArchived &&
        isSecretariat &&
        !canViewPrivate &&
        c.prosecutorId !== req.user.id &&
        c.createdBy !== req.user.id &&
        !parseJsonArray(c.privateViewerIds).includes(req.user.id)
      ) {
        for (const field of PRIVATE_MASKED_FIELDS) {
          c[field] = "";
        }
        c._privateMasked = true;
      }
      return c;
    });
    res.json(rows);
  }),
);

// ── 2. 사건번호 시작값 설정 (GET / PATCH /api/settings/case-number) ───
router.get(
  "/settings/case-number",
  requireAuth,
  requireSecretariat,
  asyncWrap(async (req, res) => {
    const result = await db.execute(
      `SELECT key, value FROM system_settings WHERE key LIKE 'case_number_%_start'`,
    );
    const settings = Object.fromEntries(
      result.rows.map((row) => [row.key, Number(row.value)]),
    );
    const getStart = (key, fallback = 1) =>
      Number.isFinite(settings[key]) ? settings[key] : fallback;
    res.json({
      hyeongjeStart: getStart("case_number_hyeongje_start", 280),
      teuggongStart: getStart("case_number_teuggong_start"),
      teughyeongStart: getStart("case_number_teughyeong_start"),
      teugapjeStart: getStart("case_number_teugapje_start"),
      apjeStart: getStart("case_number_apje_start"),
      naesaStart: getStart("case_number_naesa_start"),
    });
  }),
);

router.patch(
  "/settings/case-number",
  requireAuth,
  requireSecretariat,
  async (req, res) => {
    const hyeongjeStart = Number(req.body.hyeongjeStart);
    const starts = {
      hyeongje: hyeongjeStart,
      teuggong: Number(req.body.teuggongStart),
      teughyeong: Number(req.body.teughyeongStart),
      teugapje: Number(req.body.teugapjeStart),
      apje: Number(req.body.apjeStart),
      naesa: Number(req.body.naesaStart),
    };
    if (
      Object.values(starts).some(
        (value) => !Number.isInteger(value) || value < 1,
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "시작번호는 1 이상의 정수여야 합니다.",
      });
    }
    const now = new Date().toISOString().replace("T", " ").substring(0, 19);
    await db.batch(
      Object.entries(starts).map(([type, value]) => ({
        sql: `UPDATE system_settings SET value=?, updated_at=?, updated_by=? WHERE key='case_number_${type}_start'`,
        args: [String(value), now, req.user.id],
      })),
      "write",
    );
    res.json({
      success: true,
      hyeongjeStart,
      teuggongStart: starts.teuggong,
      teughyeongStart: starts.teughyeong,
      teugapjeStart: starts.teugapje,
      apjeStart: starts.apje,
      naesaStart: starts.naesa,
    });
  },
);

// ── 3. 공식 사건번호 배정 (POST /api/cases/assign-official-no) ────────
router.post(
  "/cases/assign-official-no",
  requireAuth,
  requireSecretariat,
  asyncWrap(async (req, res) => {
    const { caseId, prefix, manualNo, autoSeal } = req.body || {};
    if (!caseId || !prefix) {
      return res
        .status(400)
        .json({ success: false, message: "caseId와 prefix는 필수입니다." });
    }
    const ALLOWED_PREFIXES = new Set([
      "형제",
      "특공",
      "특형",
      "특압제",
      "압제",
    ]);
    if (!ALLOWED_PREFIXES.has(prefix)) {
      return res.status(400).json({
        success: false,
        message: "허용되지 않는 사건번호 유형입니다.",
      });
    }

    const currentYear = new Date().getFullYear();

    const caseRes = await db.execute({
      sql: "SELECT * FROM cases WHERE id = ? AND deleted_at = ''",
      args: [caseId],
    });
    if (caseRes.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "사건을 찾을 수 없습니다." });
    }
    const existingCase = toCamel(caseRes.rows[0]);

    let numPart;
    if (manualNo && String(manualNo).trim()) {
      numPart = String(manualNo).trim();
    } else {
      const settingKeyMap = {
        형제: "case_number_hyeongje_start",
        특공: "case_number_teuggong_start",
        특형: "case_number_teughyeong_start",
        특압제: "case_number_teugapje_start",
        압제: "case_number_apje_start",
      };
      const settingKey = settingKeyMap[prefix];

      const [settingRow, maxRow] = await Promise.all([
        db.execute({
          sql: "SELECT value FROM system_settings WHERE key = ?",
          args: [settingKey],
        }),
        db.execute({
          sql: `SELECT MAX(CAST(SUBSTR(hyeongje_no, LENGTH(?)+1) AS INTEGER)) AS maxNo
                FROM cases
                WHERE hyeongje_no GLOB ? AND deleted_at = ''`,
          args: [`${currentYear}${prefix}`, `${currentYear}${prefix}[0-9]*`],
        }),
      ]);

      const configuredStart = Number(settingRow.rows[0]?.value) || 1;
      const dbMax = maxRow.rows[0]?.maxNo || 0;
      numPart = Math.max(configuredStart, dbMax + 1);
    }

    const assignedNo = `${currentYear}${prefix}${numPart}`;
    const currentSuje =
      existingCase.sujeNo ||
      (existingCase.hyeongjeNo || "").replace("형제", "수제");

    const newDisposition = autoSeal
      ? `피의자(기소 - 사무국승인 [${assignedNo}])`
      : existingCase.disposition;

    await db.execute({
      sql: `UPDATE cases SET hyeongje_no=?, latest_hyeongje_no=?, suje_no=?, disposition=? WHERE id=? AND deleted_at=''`,
      args: [assignedNo, assignedNo, currentSuje, newDisposition, caseId],
    });

    await writeAuditLog({
      action: "UPDATE",
      entityType: "case",
      entityId: caseId,
      entityLabel: assignedNo,
      actorId: req.user.id,
      actorName: req.user.name,
      detail: `검찰사무국 공식 사건번호 배정: ${currentSuje} → ${assignedNo}`,
    });

    res.json({
      success: true,
      assignedNo,
      sujeNo: currentSuje,
      disposition: newDisposition,
    });
  }),
);

// ── 4. 단건 사건 등록 (POST /api/cases) ──────────────────────────────
router.post(
  "/cases",
  requireAuth,
  asyncWrap(async (req, res) => {
    const c = req.body;
    const lenErr = validateFieldLengths(c, {
      sujeNo: "short",
      hyeongjeNo: "short",
      latestHyeongjeNo: "short",
      prosecutorName: "short",
      suspectName: "short",
      suspectUuid: "short",
      bookingStatus: "short",
      bookingDate: "short",
      incidentDate: "short",
      bookingBasis: "url",
      disposition: "medium",
      chargeName: "medium",
      notes: "long",
      content: "long",
      confiscation: "medium",
    });
    if (lenErr)
      return res.status(400).json({ success: false, message: lenErr });
    const visibility = c.visibility === "PRIVATE" ? "PRIVATE" : "PUBLIC";
    const privateViewerIds = normalizePrivateViewerIds(c.privateViewerIds);
    const canAssignOthers =
      hasGlobalDataAccess(req.user) ||
      hasSecretariatWorkAccess(req.user) ||
      isManagementAccount(req.user);
    const assignedId = canAssignOthers
      ? c.prosecutorId || ""
      : req.user.id;
    const assignedName = canAssignOthers
      ? c.prosecutorName || ""
      : req.user.name;
    const suspects =
      Array.isArray(c.suspects) && c.suspects.length > 0
        ? c.suspects
        : c.suspectName
          ? [
              {
                id: c.suspectUuid || c.suspectName,
                name: c.suspectName,
                uuid: c.suspectUuid || "",
                role: "주범",
              },
            ]
          : [];
    const suspectsDispositions =
      c.suspectsDispositions && typeof c.suspectsDispositions === "object"
        ? c.suspectsDispositions
        : {};
    const finalDisposition =
      suspects.length > 1
        ? buildCaseDispositionSummary(
            suspects,
            suspectsDispositions,
            c.disposition || c.bookingStatus || "입건 : 수사 진행 중",
          )
        : c.disposition || c.bookingStatus || "입건 : 수사 진행 중";

    const id = `CASE-${Date.now()}-${randomUUID().slice(0, 8)}`;
    await db.execute({
      sql: `INSERT INTO cases (
            id, suje_no, hyeongje_no, latest_hyeongje_no,
            prosecutor_name, prosecutor_id, suspect_name, suspect_uuid,
            booking_status, booking_date, incident_date, booking_basis, disposition,
            re_appeal, court1_no, court1_result, court1_doc,
            court1_appealed, court1_appellant, court2_no, court2_dismissed,
            court2_result, court2_doc, court3_appealed, court3_appellant,
            court3_no, court3_remanded, court3_result, court3_doc,
            notes, content, confiscation, charge_name, visibility, created_by, private_viewer_ids,
            suspects_json, suspects_dispositions
          ) VALUES (
            ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?
          )`,
      args: [
        id,
        c.sujeNo ||
          (c.hyeongjeNo && c.hyeongjeNo.includes("수제") ? c.hyeongjeNo : ""),
        c.hyeongjeNo && !c.hyeongjeNo.includes("수제") ? c.hyeongjeNo : "-",
        c.latestHyeongjeNo || "",
        assignedName,
        assignedId,
        c.suspectName || "",
        c.suspectUuid || "",
        c.bookingStatus || "",
        c.bookingDate || "",
        c.incidentDate || c.bookingDate || "",
        c.bookingBasis || "",
        finalDisposition,
        c.reAppeal || "-",
        c.court1No || "",
        c.court1Result || "",
        c.court1Doc || "",
        c.court1Appealed || "",
        c.court1Appellant || "",
        c.court2No || "",
        c.court2Dismissed || "",
        c.court2Result || "",
        c.court2Doc || "",
        c.court3Appealed || "",
        c.court3Appellant || "",
        c.court3No || "",
        c.court3Remanded || "",
        c.court3Result || "",
        c.court3Doc || "",
        c.notes || "",
        c.content || "",
        c.confiscation || "",
        c.chargeName || "",
        visibility,
        req.user.id,
        JSON.stringify(privateViewerIds),
        JSON.stringify(suspects),
        JSON.stringify(suspectsDispositions),
      ],
    });
    await writeAuditLog({
      action: "CREATE",
      entityType: "case",
      entityId: id,
      entityLabel: c.hyeongjeNo || id,
      actorId: req.user.id,
      actorName: req.user.name,
      detail: `피의자: ${c.suspectName || ""}, 죄명: ${c.chargeName || ""}`,
    });

    if (assignedId && assignedId !== req.user.id) {
      sendNotificationToUser({
        userId: assignedId,
        type: "CASE_ASSIGNED",
        title: "📁 신규 사건 배당",
        message: `${req.user.name}님이 [${c.hyeongjeNo || c.sujeNo || "사건"}] 피의자 ${c.suspectName || "미지정"} 사건을 배당했습니다.`,
        linkTab: "mycases",
        linkId: id,
      }).catch(() => {});
    }

    res.json({ success: true, case: { ...c, id } });
  }),
);

// ── 5. 사건 접수 번들 (POST /api/cases/intake-bundle) ────────────────
router.post(
  "/cases/intake-bundle",
  requireAuth,
  asyncWrap(async (req, res) => {
    const c = req.body || {};
    const visibility = c.visibility === "PRIVATE" ? "PRIVATE" : "PUBLIC";
    const privateViewerIds = normalizePrivateViewerIds(c.privateViewerIds);
    const canAssignOthers =
      hasGlobalDataAccess(req.user) ||
      hasSecretariatWorkAccess(req.user) ||
      isManagementAccount(req.user);
    const assignedId = canAssignOthers
      ? String(c.prosecutorId || "")
      : req.user.id;
    const assignedName = canAssignOthers
      ? String(c.prosecutorName || "")
      : req.user.name;
    if (
      visibility === "PRIVATE" &&
      !isProsecutorGeneral(req.user) &&
      req.user.id !== assignedId
    ) {
      return res.status(403).json({
        success: false,
        message:
          "비공개 사건 공개대상은 검찰총장 또는 담당검사만 지정할 수 있습니다.",
      });
    }
    const id = `CASE-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const reportId = `RPT-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const bookingId = `BKG-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const isPreInvestigation = isPreBookingInvestigation(c.bookingStatus);
    let intakeCaseNo = c.sujeNo || c.hyeongjeNo || "";
    if (isPreInvestigation) {
      const year = new Date().getFullYear();
      const [settingResult, existingCases] = await Promise.all([
        db.execute({
          sql: "SELECT value FROM system_settings WHERE key='case_number_naesa_start'",
          args: [],
        }),
        db.execute({
          sql: "SELECT hyeongje_no FROM cases WHERE hyeongje_no LIKE ?",
          args: [`${year}내사%`],
        }),
      ]);
      const configuredStart = Math.max(
        1,
        Number(settingResult.rows[0]?.value) || 1,
      );
      const maxExisting = existingCases.rows.reduce((max, row) => {
        const match = String(row.hyeongje_no || "").match(
          new RegExp(`^${year}내사(\\d+)$`),
        );
        return match ? Math.max(max, Number(match[1])) : max;
      }, configuredStart - 1);
      intakeCaseNo = `${year}내사${Math.max(configuredStart, maxExisting + 1)}`;
    }
    const evidenceAttachments = Array.isArray(c.evidenceAttachments)
      ? c.evidenceAttachments
          .filter(
            (item) =>
              item &&
              typeof item.url === "string" &&
              item.url.startsWith("data:") &&
              ALLOWED_EVIDENCE_MIME.test(item.url) &&
              item.url.length <= EVIDENCE_MAX_BYTES,
          )
          .slice(0, 10)
      : [];
    const createdAt = new Date()
      .toISOString()
      .replace("T", " ")
      .substring(0, 16);
    if (assignedId && !(await validateCaseAssignee(assignedId))) {
      return res.status(400).json({
        success: false,
        message:
          "사무국 소속 또는 비활성 계정은 담당검사로 배정할 수 없습니다.",
      });
    }
    const suspects =
      Array.isArray(c.suspects) && c.suspects.length > 0
        ? c.suspects
        : c.suspectName
          ? [
              {
                id: c.suspectUuid || c.suspectName,
                name: c.suspectName,
                uuid: c.suspectUuid || "",
                role: "주범",
              },
            ]
          : [];
    const suspectsDispositions =
      c.suspectsDispositions && typeof c.suspectsDispositions === "object"
        ? c.suspectsDispositions
        : {};
    const finalDisposition =
      suspects.length > 1
        ? buildCaseDispositionSummary(
            suspects,
            suspectsDispositions,
            c.disposition || c.bookingStatus || "입건 : 수사 진행 중",
          )
        : c.disposition || c.bookingStatus || "입건 : 수사 진행 중";
    const caseArgs = [
      id,
      intakeCaseNo,
      c.hyeongjeNo && !c.hyeongjeNo.includes("수제") ? c.hyeongjeNo : "-",
      c.latestHyeongjeNo || "",
      assignedName,
      assignedId,
      c.suspectName || "",
      c.suspectUuid || "",
      c.bookingStatus || "",
      c.bookingDate || "",
      c.incidentDate || c.bookingDate || "",
      c.bookingBasis || "",
      finalDisposition,
      c.reAppeal || "-",
      c.court1No || "",
      c.court1Result || "",
      c.court1Doc || "",
      c.court1Appealed || "",
      c.court1Appellant || "",
      c.court2No || "",
      c.court2Dismissed || "",
      c.court2Result || "",
      c.court2Doc || "",
      c.court3Appealed || "",
      c.court3Appellant || "",
      c.court3No || "",
      c.court3Remanded || "",
      c.court3Result || "",
      c.court3Doc || "",
      c.notes || "",
      c.content || "",
      c.confiscation || "",
      c.chargeName || "",
      visibility,
      req.user.id,
      JSON.stringify(privateViewerIds),
      JSON.stringify(suspects),
      JSON.stringify(suspectsDispositions),
    ];
    const reportArgs = [
      reportId,
      c.reportNo || `RPT-${Date.now()}`,
      c.reportTitle || `사건 접수 보고서 [${intakeCaseNo}]`,
      assignedName,
      c.incidentDate || c.bookingDate || "",
      c.suspectName || "",
      c.suspectUuid || "",
      c.chargeName || "",
      c.content || "",
      c.bookingBasis || "",
      createdAt,
      c.hyeongjeNo && !c.hyeongjeNo.includes("수제") ? c.hyeongjeNo : "-",
      intakeCaseNo,
      JSON.stringify(evidenceAttachments),
    ];
    const bookingArgs = [
      bookingId,
      c.hyeongjeNo && !c.hyeongjeNo.includes("수제") ? c.hyeongjeNo : "-",
      intakeCaseNo,
      c.suspectName || "",
      c.suspectUuid || "",
      c.chargeName || "",
      c.bookingStatus || "수사중",
      c.bookingDate || "",
      c.bookingBasis || "",
      c.disposition || "",
      c.indictmentDecision || "",
      c.bookingDate || "",
      "",
      "",
    ];

    try {
      await db.batch(
        [
          {
            sql: `INSERT INTO cases (
                  id, suje_no, hyeongje_no, latest_hyeongje_no,
                  prosecutor_name, prosecutor_id, suspect_name, suspect_uuid,
                  booking_status, booking_date, incident_date, booking_basis, disposition,
                  re_appeal, court1_no, court1_result, court1_doc,
                  court1_appealed, court1_appellant, court2_no, court2_dismissed,
                  court2_result, court2_doc, court3_appealed, court3_appellant,
                  court3_no, court3_remanded, court3_result, court3_doc,
                  notes, content, confiscation, charge_name, visibility, created_by, private_viewer_ids,
                  suspects_json, suspects_dispositions
                ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            args: caseArgs,
          },
          {
            sql: `INSERT INTO reports (
                  id, report_no, report_title, prosecutor_name, incident_date,
                  suspect_name, suspect_uuid, charge_name, report_content, booking_basis,
                  created_at, hyeongje_no, suje_no, evidence_attachments
                ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            args: reportArgs,
          },
          {
            sql: `INSERT INTO bookings (
                  id, hyeongje_no, suje_no, suspect_name, suspect_uuid, charge_name,
                  disposition_status, booking_date, booking_basis, disposition_details,
                  indictment_decision, created_at, non_indictment_reason, execution_doc_url
                ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            args: bookingArgs,
          },
        ],
        "write",
      );

      await writeAuditLog({
        action: "CREATE",
        entityType: "case",
        entityId: id,
        entityLabel: intakeCaseNo || c.hyeongjeNo || id,
        actorId: req.user.id,
        actorName: req.user.name,
        detail: `사건 일괄 접수 (원부+보고서+입건): 피의자 ${c.suspectName || "-"}, 담당검사: ${assignedName}`,
      });

      if (assignedId && assignedId !== req.user.id) {
        sendNotificationToUser({
          userId: assignedId,
          type: "CASE_ASSIGNED",
          title: "📁 신규 사건 배당",
          message: `${req.user.name}님이 [${intakeCaseNo || c.hyeongjeNo || "사건"}] 피의자 ${c.suspectName || "미지정"} 사건을 배당했습니다.`,
          linkTab: "mycases",
          linkId: id,
        }).catch(() => {});
      }

      res.json({
        success: true,
        case: {
          ...c,
          id,
          sujeNo: intakeCaseNo,
          hyeongjeNo: isPreInvestigation ? "-" : c.hyeongjeNo,
          prosecutorId: assignedId,
          prosecutorName: assignedName,
        },
        reportId,
        bookingId,
      });
    } catch (err) {
      console.error("[POST /cases/intake-bundle]", err);
      res
        .status(500)
        .json({ success: false, message: "사건 접수 중 저장에 실패했습니다." });
    }
  }),
);

// ── 6. 엑셀 일괄 등록 (POST /api/cases/bulk-import) ──────────────────
router.post(
  "/cases/bulk-import",
  requireAuth,
  requireSecretariat,
  async (req, res) => {
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    if (rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "일괄 등록할 사건 데이터가 없습니다.",
      });
    }
    if (rows.length > 500) {
      return res.status(400).json({
        success: false,
        message: "한 번에 최대 500건까지 등록할 수 있습니다.",
      });
    }

    try {
      const now = new Date();
      const prosecutorNameSet = new Set(
        rows.map((r) => String(r["검사명"] || "").trim()).filter(Boolean),
      );
      const prosecutorMap = new Map();
      if (prosecutorNameSet.size > 0) {
        const placeholders = [...prosecutorNameSet].map(() => "?").join(",");
        const prosResult = await db.execute({
          sql: `SELECT id, name FROM prosecutors WHERE name IN (${placeholders})`,
          args: [...prosecutorNameSet],
        });
        for (const row of prosResult.rows) {
          prosecutorMap.set(row.name, row.id);
        }
      }

      const txStatements = [];
      rows.forEach((r, i) => {
        const caseId = `BULK-${now.getTime()}-${i}-${randomUUID().slice(0, 8)}`;
        const rawSujeNo = String(r["수제번호"] || "").trim();
        const rawHyeongjeNo = String(r["형제번호"] || "").trim();
        const prosecutorName = String(r["검사명"] || "").trim();
        const prosecutorId = prosecutorMap.get(prosecutorName) || prosecutorName;
        const suspectName = String(r["피고인명"] || r["피의자명"] || "").trim();
        const suspectUuid = String(r["UUID"] || "").trim();
        const bookingStatus = String(r["현재 상황"] || "접수").trim();
        const bookingDate = String(r["접수일시"] || "").trim();
        const incidentDate =
          String(r["사건 발생일"] || r["발생일시"] || "").trim() || bookingDate;
        const bookingBasis = String(r["접수근거"] || "").trim();
        const disposition = String(r["처분내용"] || "").trim();
        const chargeName = String(r["죄명"] || "").trim();

        const sujeNo =
          rawSujeNo || (rawHyeongjeNo.includes("수제") ? rawHyeongjeNo : "");
        const hyeongjeNo =
          rawHyeongjeNo && !rawHyeongjeNo.includes("수제")
            ? rawHyeongjeNo
            : "-";
        const latestHyeongjeNo =
          rawHyeongjeNo && !rawHyeongjeNo.includes("수제")
            ? rawHyeongjeNo
            : rawSujeNo || "-";

        txStatements.push({
          sql: `INSERT INTO cases (
                id, suje_no, hyeongje_no, latest_hyeongje_no,
                prosecutor_name, prosecutor_id, suspect_name, suspect_uuid,
                booking_status, booking_date, incident_date, booking_basis,
                disposition, re_appeal, charge_name, visibility, created_by,
                suspects_json, suspects_dispositions
              ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          args: [
            caseId,
            sujeNo,
            hyeongjeNo,
            latestHyeongjeNo,
            prosecutorName,
            prosecutorId,
            suspectName,
            suspectUuid,
            bookingStatus,
            bookingDate,
            incidentDate,
            bookingBasis,
            disposition,
            "-",
            chargeName,
            "PUBLIC",
            req.user.id,
            JSON.stringify(
              suspectName
                ? [{ id: suspectUuid || suspectName, name: suspectName, uuid: suspectUuid, role: "주범" }]
                : [],
            ),
            JSON.stringify({}),
          ],
        });
      });

      await db.batch(txStatements, "write");

      await writeAuditLog({
        action: "CREATE",
        entityType: "case",
        entityId: `BULK-${now.getTime()}`,
        entityLabel: `엑셀 일괄 등록 ${rows.length}건`,
        actorId: req.user.id,
        actorName: req.user.name,
        detail: `엑셀 파일 기반 사건 일괄 ${rows.length}건 DB 저장 완료`,
      });

      res.json({ success: true, count: rows.length });
    } catch (err) {
      console.error("[POST /api/cases/bulk-import]", err);
      res.status(500).json({
        success: false,
        message: "엑셀 일괄 등록 중 DB 저장에 실패했습니다.",
      });
    }
  },
);

// ── 7. 사건 수정 (PUT /api/cases/:id) ────────────────────────────────
router.put(
  "/cases/:id",
  requireAuth,
  requireCaseScope,
  asyncWrap(async (req, res) => {
    const c = req.body;

    if (!hasGlobalDataAccess(req.user) && !hasSecretariatWorkAccess(req.user)) {
      const ownerCheck = await db.execute({
        sql: "SELECT prosecutor_id, prosecutor_name, created_by FROM cases WHERE id = ? AND deleted_at = ''",
        args: [req.params.id],
      });
      const orow = ownerCheck.rows[0];
      if (orow) {
        const isOwner =
          orow.prosecutor_name === req.user.name ||
          orow.created_by === req.user.id;
        let isSuperior = false;
        if (!isOwner && orow.prosecutor_id) {
          const sr = await db.execute({
            sql: "SELECT role_level, dept FROM prosecutors WHERE id = ?",
            args: [orow.prosecutor_id],
          });
          if (sr.rows.length > 0) {
            const target = toCamel(sr.rows[0]);
            const sameDept =
              (req.user.dept || "") && req.user.dept === target.dept;
            const higherAuth =
              (ROLE_AUTHORITY[effectiveRoleLevel(req.user)] || 0) >
              (ROLE_AUTHORITY[target.roleLevel] || 0);
            isSuperior = sameDept && higherAuth;
          }
        }
        if (!isOwner && !isSuperior) {
          return res.status(403).json({
            success: false,
            message: "담당검사 또는 작성자만 사건 원부를 수정할 수 있습니다.",
          });
        }
      }
    }

    if (c.forceReassign) {
      const isSeniorProsecutorReassign =
        effectiveRoleLevel(req.user) === "SENIOR_PROSECUTOR";
      const hasReassignAuth =
        hasSecretariatWorkAccess(req.user) ||
        GLOBAL_DATA_ROLES.has(effectiveRoleLevel(req.user));

      if (!hasReassignAuth) {
        if (isSeniorProsecutorReassign) {
          const caseOwnerRes = await db.execute({
            sql: `SELECT p.dept FROM cases c JOIN prosecutors p ON c.prosecutor_id = p.id
                WHERE c.id = ? AND c.deleted_at = ''`,
            args: [req.params.id],
          });
          const newAssigneeRes = await db.execute({
            sql: "SELECT dept FROM prosecutors WHERE id = ?",
            args: [c.prosecutorId || ""],
          });
          const currentDept = caseOwnerRes.rows[0]?.dept || "";
          const newDept = newAssigneeRes.rows[0]?.dept || "";
          const requesterDept = req.user.dept || "";
          if (
            !requesterDept ||
            requesterDept !== currentDept ||
            requesterDept !== newDept
          ) {
            return res.status(403).json({
              success: false,
              message: "부서장은 동일 부서 내 사건만 재배당할 수 있습니다.",
            });
          }
        } else {
          return res.status(403).json({
            success: false,
            message: "사무국 탭에서만 강제 재배당할 수 있습니다.",
          });
        }
      }
      if (!(await validateForcedCaseAssignee(c.prosecutorId))) {
        return res.status(400).json({
          success: false,
          message: "활성 상태의 담당검사를 선택해주세요.",
        });
      }
    }

    const isSeniorInDept = (() => {
      if (effectiveRoleLevel(req.user) !== "SENIOR_PROSECUTOR") return false;
      return true;
    })();
    const canEditOthers =
      hasGlobalDataAccess(req.user) ||
      hasSecretariatWorkAccess(req.user) ||
      isManagementAccount(req.user) ||
      (c.forceReassign && isSeniorInDept);
    const assignedId = canEditOthers
      ? String(c.prosecutorId || "")
      : req.user.id;
    const assignedName = canEditOthers
      ? String(c.prosecutorName || "")
      : req.user.name;

    try {
      const oldRes = await db.execute({
        sql: "SELECT * FROM cases WHERE id = ?",
        args: [req.params.id],
      });
      if (oldRes.rows.length > 0) {
        const old = toCamel(oldRes.rows[0]);
        const trackFields = [
          ["hyeongjeNo", "형제번호"],
          ["prosecutorName", "담당검사"],
          ["suspectName", "피의자명"],
          ["suspectUuid", "피의자 UUID"],
          ["bookingStatus", "입건상태"],
          ["bookingDate", "접수일"],
          ["incidentDate", "사건 발생일"],
          ["disposition", "처분내역"],
          ["chargeName", "죄명"],
          ["notes", "비고"],
          ["content", "사건 내용"],
          ["confiscation", "몰수추징"],
          ["court1No", "1심 사건번호"],
          ["court1Result", "1심 판결"],
          ["court2No", "2심 사건번호"],
          ["court2Result", "2심 판결"],
          ["court3No", "3심 사건번호"],
          ["court3Result", "3심 판결"],
        ];
        const now = new Date().toISOString().replace("T", " ").substring(0, 19);
        const changedFields = [];
        const changedDetails = [];
        for (const [field, label] of trackFields) {
          const oldVal = String(old[field] || "");
          const newVal = String(c[field] || "");
          if (oldVal !== newVal) {
            changedFields.push(label);
            const oldDisp =
              oldVal.length > 30 ? oldVal.slice(0, 30) + "…" : oldVal;
            const newDisp =
              newVal.length > 30 ? newVal.slice(0, 30) + "…" : newVal;
            changedDetails.push(
              `${label}: "${oldDisp || "(없음)"}" → "${newDisp || "(없음)"}"`,
            );
            const histId = `CH-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
            await db.execute({
              sql: `INSERT INTO case_history (id, case_id, hyeongje_no, actor_id, actor_name, field_name, old_value, new_value, created_at)
                  VALUES (?,?,?,?,?,?,?,?,?)`,
              args: [
                histId,
                req.params.id,
                c.sujeNo || old.sujeNo || c.hyeongjeNo || old.hyeongjeNo,
                req.user.id,
                req.user.name,
                label,
                oldVal,
                newVal,
                now,
              ],
            });
          }
        }
        req._changedFields = changedFields;
        req._changedDetails = changedDetails;
      }
    } catch (e) {
      console.warn("[case history write error]", e.message);
    }

    const sujeNo =
      c.sujeNo ||
      (c.hyeongjeNo && c.hyeongjeNo.includes("수제") ? c.hyeongjeNo : "");
    const hyeongjeNo =
      c.hyeongjeNo && !c.hyeongjeNo.includes("수제") ? c.hyeongjeNo : "-";

    const newVisibility = c.visibility === "PRIVATE" ? "PRIVATE" : "PUBLIC";
    const newPrivateViewerIds = normalizePrivateViewerIds(c.privateViewerIds);
    if (c.visibility !== undefined && !isProsecutorGeneral(req.user)) {
      const visCheck = await db.execute({
        sql: "SELECT created_by, prosecutor_id, visibility FROM cases WHERE id = ? AND deleted_at = ''",
        args: [req.params.id],
      });
      const vrow = visCheck.rows[0];
      const oldVisibility = vrow?.visibility || "PUBLIC";
      const visibilityChanged = oldVisibility !== newVisibility;
      if (
        visibilityChanged &&
        vrow &&
        vrow.created_by !== req.user.id &&
        vrow.prosecutor_id !== req.user.id
      ) {
        return res.status(403).json({
          success: false,
          message:
            "사건의 공개범위는 담당검사 또는 작성자만 변경할 수 있습니다.",
        });
      }
    }

    const suspectsForUpdate =
      Array.isArray(c.suspects) && c.suspects.length > 0
        ? c.suspects
        : c.suspectName
          ? [
              {
                id: c.suspectUuid || c.suspectName,
                name: c.suspectName,
                uuid: c.suspectUuid || "",
                role: "주범",
              },
            ]
          : [];
    let dispositionMapForUpdate =
      c.suspectsDispositions && typeof c.suspectsDispositions === "object"
        ? { ...c.suspectsDispositions }
        : {};

    if (typeof c.disposition === "string" && c.disposition.trim()) {
      const dispText = c.disposition.trim();
      if (suspectsForUpdate.length <= 1 || Object.keys(dispositionMapForUpdate).length === 0) {
        suspectsForUpdate.forEach((s, idx) => {
          const key = s.id || s.uuid || s.name || `suspect-${idx}`;
          dispositionMapForUpdate[key] = dispText;
          if (s.name) dispositionMapForUpdate[s.name] = dispText;
          if (s.uuid) dispositionMapForUpdate[s.uuid] = dispText;
        });
      }
    }

    const effectiveDisposition =
      suspectsForUpdate.length > 1
        ? buildCaseDispositionSummary(
            suspectsForUpdate,
            dispositionMapForUpdate,
            c.disposition || c.bookingStatus || "입건 : 수사 진행 중",
          )
        : c.disposition || c.bookingStatus || "입건 : 수사 진행 중";

    await db.execute({
      sql: `UPDATE cases SET
            suje_no=?, hyeongje_no=?, latest_hyeongje_no=?,
            prosecutor_name=?, prosecutor_id=?,
            suspect_name=?, suspect_uuid=?,
            booking_status=?, booking_date=?, incident_date=?, booking_basis=?, disposition=?,
            re_appeal=?,
            court1_no=?, court1_result=?, court1_doc=?, court1_appealed=?, court1_appellant=?,
            court2_no=?, court2_dismissed=?, court2_result=?, court2_doc=?,
            court3_appealed=?, court3_appellant=?, court3_no=?, court3_remanded=?, court3_result=?, court3_doc=?,
            charge_name=?, notes=?, content=?, confiscation=?,
            supervisor_designated=?, supervisor_id=?, supervisor_name=?,
            visibility=?, private_viewer_ids=?,
            suspects_json=?, suspects_dispositions=?
          WHERE id=?`,
      args: [
        sujeNo,
        hyeongjeNo,
        c.latestHyeongjeNo || hyeongjeNo,
        assignedName,
        assignedId,
        c.suspectName || "",
        c.suspectUuid || "",
        c.bookingStatus || "",
        c.bookingDate || "",
        c.incidentDate || "",
        c.bookingBasis || "",
        effectiveDisposition,
        c.reAppeal || "-",
        c.court1No || "",
        c.court1Result || "",
        c.court1Doc || "",
        c.court1Appealed || "",
        c.court1Appellant || "",
        c.court2No || "",
        c.court2Dismissed || "",
        c.court2Result || "",
        c.court2Doc || "",
        c.court3Appealed || "",
        c.court3Appellant || "",
        c.court3No || "",
        c.court3Remanded || "",
        c.court3Result || "",
        c.court3Doc || "",
        c.chargeName || "",
        c.notes || "",
        c.content || "",
        c.confiscation || "",
        c.supervisorDesignated ? 1 : 0,
        c.supervisorId || "",
        c.supervisorName || "",
        newVisibility,
        JSON.stringify(newPrivateViewerIds),
        JSON.stringify(suspectsForUpdate),
        JSON.stringify(dispositionMapForUpdate),
        req.params.id,
      ],
    });
    const changedDetails = req._changedDetails || [];
    const changedSummary =
      changedDetails.length > 0
        ? `\n변경 내역:\n${changedDetails.join("\n")}`
        : "";
    await writeAuditLog({
      action: "UPDATE",
      entityType: "case",
      entityId: req.params.id,
      entityLabel: c.sujeNo || c.hyeongjeNo || req.params.id,
      actorId: req.user.id,
      actorName: req.user.name,
      detail: c.forceReassign
        ? `강제 재배당: ${assignedName} (${assignedId})${changedSummary}`
        : `처분: ${c.disposition || ""}, 상태: ${c.bookingStatus || ""}${changedSummary}`,
    });

    try {
      const targetId = assignedId || null;
      if (targetId && targetId !== req.user.id) {
        await sendNotificationToUser({
          userId: targetId,
          type: "CASE_UPDATED",
          title: "사건 원부 수정",
          message: c.forceReassign
            ? `[${c.sujeNo || c.hyeongjeNo || "-"}] 사건이 귀하에게 재배당되었습니다.`
            : `[${c.sujeNo || c.hyeongjeNo || "-"}] 담당 사건 원부가 수정되었습니다.`,
          linkTab: "mycases",
          linkId: req.params.id,
        });
      }
    } catch (e) {
      console.warn("[SSE CASE_UPDATED send error]", e.message);
    }

    res.json({ success: true, id: req.params.id });
  }),
);

// ── 8. 사건 보존 / 보존 해제 (PATCH /api/cases/:id/archive) ─────────
router.patch(
  "/cases/:id/archive",
  requireAuth,
  requireSecretariat,
  requireCaseScope,
  async (req, res) => {
    const isArchived = Boolean(req.body.isArchived);
    const nowStr = isArchived
      ? new Date().toISOString().replace("T", " ").substring(0, 19)
      : "";
    const actorName = isArchived ? req.user.name : "";

    try {
      await db.execute({
        sql: `UPDATE cases SET is_archived=?, archived_at=?, archived_by=? WHERE id=?`,
        args: [isArchived ? 1 : 0, nowStr, actorName, req.params.id],
      });

      await writeAuditLog({
        action: "UPDATE",
        entityType: "case",
        entityId: req.params.id,
        entityLabel: req.params.id,
        actorId: req.user.id,
        actorName: req.user.name,
        detail: isArchived
          ? "사건 보존 처리 (서고 이동)"
          : "사건 보존 해제 (원부 복원)",
      });

      res.json({
        success: true,
        isArchived,
        archivedAt: nowStr,
        archivedBy: actorName,
      });
    } catch (err) {
      console.error("[PATCH /api/cases/:id/archive]", err);
      res
        .status(500)
        .json({ success: false, message: "사건 보존 처리 중 오류 발생" });
    }
  },
);

// ── 9. 사건 일괄 재배당 (POST /api/cases/bulk-reassign) ───────────────
router.post(
  "/cases/bulk-reassign",
  requireAuth,
  requireSecretariat,
  async (req, res) => {
    const {
      caseIds,
      toProsecutorId,
      toProsecutorName,
      reason = "사무국 일괄 재배당",
    } = req.body || {};

    if (!Array.isArray(caseIds) || caseIds.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "재배당할 사건 목록이 없습니다." });
    }
    if (caseIds.length > 100) {
      return res.status(400).json({
        success: false,
        message: "한 번에 최대 100건까지 재배당할 수 있습니다.",
      });
    }
    if (!toProsecutorId || !toProsecutorName) {
      return res
        .status(400)
        .json({ success: false, message: "새 담당검사를 선택해주세요." });
    }

    if (!(await validateForcedCaseAssignee(toProsecutorId))) {
      return res.status(400).json({
        success: false,
        message: "활성 상태의 담당검사(사무국 외)를 선택해주세요.",
      });
    }

    try {
      const now = new Date().toISOString().replace("T", " ").substring(0, 19);
      const safeCaseIds = caseIds
        .map((id) => String(id).trim())
        .filter(Boolean)
        .slice(0, 100);

      const existingRes = await db.execute({
        sql: `SELECT id, hyeongje_no, prosecutor_id, prosecutor_name FROM cases
              WHERE id IN (${safeCaseIds.map(() => "?").join(",")}) AND deleted_at = ''`,
        args: safeCaseIds,
      });
      const existingCases = existingRes.rows.map(toCamel);

      await db.batch(
        safeCaseIds.map((id) => ({
          sql: "UPDATE cases SET prosecutor_id = ?, prosecutor_name = ? WHERE id = ? AND deleted_at = ''",
          args: [toProsecutorId, toProsecutorName, id],
        })),
        "write",
      );

      const historyInserts = existingCases
        .filter(
          (c) =>
            c.prosecutorId !== toProsecutorId ||
            c.prosecutorName !== toProsecutorName,
        )
        .map((c) => ({
          sql: `INSERT INTO case_history (id, case_id, hyeongje_no, actor_id, actor_name, field_name, old_value, new_value, created_at)
                VALUES (?,?,?,?,?,?,?,?,?)`,
          args: [
            `CH-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
            c.id,
            c.hyeongjeNo || "",
            req.user.id,
            req.user.name,
            "담당검사",
            c.prosecutorName || "",
            toProsecutorName,
            now,
          ],
        }));

      if (historyInserts.length > 0) {
        await db.batch(historyInserts, "write");
      }

      await writeAuditLog({
        action: "UPDATE",
        entityType: "case",
        entityId: safeCaseIds.join(","),
        entityLabel: `일괄 재배당 ${safeCaseIds.length}건`,
        actorId: req.user.id,
        actorName: req.user.name,
        detail: `→ ${toProsecutorName} (${toProsecutorId}), 사유: ${reason}`,
      });

      res.json({
        success: true,
        updatedCount: existingCases.length,
        toProsecutorId,
        toProsecutorName,
      });
    } catch (err) {
      console.error("[POST /cases/bulk-reassign]", err);
      res.status(500).json({
        success: false,
        message: "일괄 재배당 중 오류가 발생했습니다.",
      });
    }
  },
);

// ── 10. 피의자 통합 프로필 (GET /api/suspects/:uuid/profile) ──────────
router.get("/suspects/:uuid/profile", requireAuth, async (req, res) => {
  const { uuid } = req.params;
  if (!uuid || uuid.length < 4) {
    return res
      .status(400)
      .json({ success: false, message: "유효한 UUID를 입력해주세요." });
  }
  try {
    const [casesRes, bookingsRes, appealsRes, warrantsRes] = await Promise.all([
      db.execute({
        sql: hasGlobalDataAccess(req.user)
          ? "SELECT * FROM cases WHERE suspect_uuid = ? AND deleted_at = '' ORDER BY rowid DESC"
          : `SELECT c.* FROM cases c JOIN prosecutors p ON c.prosecutor_id = p.id
             WHERE c.suspect_uuid = ? AND c.deleted_at = ''
               AND (c.visibility = 'PUBLIC' OR c.prosecutor_id = ? OR c.created_by = ?
                 OR (c.visibility = 'PUBLIC' AND (
                   c.disposition LIKE '%불기소%' OR c.disposition LIKE '%종국%' OR
                   c.disposition LIKE '%기소유예%' OR c.disposition LIKE '%혐의없음%' OR
                   c.disposition LIKE '%무혐의%' OR c.disposition LIKE '%죄가안됨%' OR
                   c.disposition LIKE '%공소권없음%' OR c.disposition LIKE '%각하%' OR
                   c.disposition LIKE '%기소중지%' OR c.disposition LIKE '%타관송치%' OR
                   c.disposition LIKE '%처분완료%' OR c.disposition LIKE '%구속기소%' OR
                   c.disposition LIKE '%불구속기소%' OR c.disposition LIKE '%약식기소%' OR
                   c.disposition LIKE '%구공판%'
                 )))
             ORDER BY c.rowid DESC`,
        args: hasGlobalDataAccess(req.user)
          ? [uuid]
          : [uuid, req.user.id, req.user.id],
      }),
      db.execute({
        sql: hasGlobalDataAccess(req.user)
          ? "SELECT * FROM bookings WHERE suspect_uuid = ? ORDER BY rowid DESC"
          : `SELECT b.* FROM bookings b
             LEFT JOIN cases c ON c.hyeongje_no = b.hyeongje_no AND c.deleted_at = ''
             LEFT JOIN prosecutors p ON c.prosecutor_id = p.id
             WHERE b.suspect_uuid = ?
               AND (
                 p.dept = (SELECT dept FROM prosecutors WHERE id = ?)
                 OR b.disposition_status LIKE '%불기소%'
                 OR b.disposition_status LIKE '%혐의없음%'
                 OR b.disposition_status LIKE '%무혐의%'
                 OR b.disposition_status LIKE '%기소유예%'
                 OR b.disposition_status LIKE '%공소권없음%'
                 OR b.disposition_status LIKE '%죄가안됨%'
                 OR b.disposition_status LIKE '%각하%'
                 OR b.disposition_status LIKE '%기소중지%'
                 OR b.disposition_status LIKE '%타관송치%'
                 OR b.disposition_status LIKE '%처분완료%'
                 OR b.disposition_status LIKE '%구속기소%'
                 OR b.disposition_status LIKE '%불구속기소%'
                 OR b.disposition_status LIKE '%약식기소%'
                 OR b.disposition_status LIKE '%구공판%'
                 OR b.indictment_decision LIKE '%종국%'
               )
             ORDER BY b.rowid DESC`,
        args: hasGlobalDataAccess(req.user) ? [uuid] : [uuid, req.user.id],
      }),
      db.execute({
        sql: hasGlobalDataAccess(req.user)
          ? "SELECT * FROM appeals WHERE suspect_uuid = ? AND deleted_at = '' ORDER BY rowid DESC"
          : `SELECT ap.* FROM appeals ap JOIN prosecutors p ON ap.prosecutor_name = p.name
             WHERE ap.suspect_uuid = ? AND ap.deleted_at = ''
               AND p.dept = (SELECT dept FROM prosecutors WHERE id = ?)
             ORDER BY ap.rowid DESC`,
        args: hasGlobalDataAccess(req.user) ? [uuid] : [uuid, req.user.id],
      }),
      db.execute({
        sql: hasGlobalDataAccess(req.user)
          ? "SELECT * FROM warrants WHERE suspect_uuid = ? AND deleted_at = '' ORDER BY rowid DESC"
          : `SELECT w.* FROM warrants w JOIN prosecutors p ON w.prosecutor_name = p.name
             WHERE w.suspect_uuid = ? AND w.deleted_at = ''
               AND p.dept = (SELECT dept FROM prosecutors WHERE id = ?)
             ORDER BY w.rowid DESC`,
        args: hasGlobalDataAccess(req.user) ? [uuid] : [uuid, req.user.id],
      }),
    ]);

    const cases = casesRes.rows.map(toCamel);
    const bookings = bookingsRes.rows.map(toCamel);
    const appeals = appealsRes.rows.map(toCamel);
    const warrants = warrantsRes.rows.map(toCamel);

    const dispositionStats = {};
    cases.forEach((c) => {
      const d = (c.disposition || "수사중").split(" ")[0];
      dispositionStats[d] = (dispositionStats[d] || 0) + 1;
    });

    const suspectName =
      cases[0]?.suspectName ||
      bookings[0]?.suspectName ||
      appeals[0]?.suspectName ||
      "알 수 없음";

    res.json({
      uuid,
      suspectName,
      stats: {
        totalCases: cases.length,
        totalBookings: bookings.length,
        totalAppeals: appeals.length,
        totalWarrants: warrants.length,
        indicted: cases.filter((c) => {
          const disp = c.disposition || "";
          return (
            (disp.includes("기소") || disp.includes("구공판")) &&
            !disp.includes("불기소") &&
            !disp.includes("기소유예") &&
            !disp.includes("기소중지")
          );
        }).length,
        nonIndicted: cases.filter((c) =>
          [
            "불기소",
            "혐의없음",
            "죄가안됨",
            "기소유예",
            "각하",
            "공소권없음",
          ].some((k) => (c.disposition || "").includes(k)),
        ).length,
        pending: cases.filter(
          (c) =>
            !(c.disposition || "") ||
            (c.disposition || "").includes("수사") ||
            (c.disposition || "").includes("진행"),
        ).length,
        dispositionStats,
      },
      cases,
      bookings,
      appeals,
      warrants,
    });
  } catch (err) {
    console.error("[GET /suspects/profile]", err);
    res.status(500).json({ success: false, message: "서버 오류" });
  }
});

// ── 11. 자동보존 설정 (GET / PATCH /api/settings/auto-archive) ────────
router.get(
  "/settings/auto-archive",
  requireAuth,
  requireSecretariat,
  async (req, res) => {
    const result = await db.execute({
      sql: "SELECT key, value FROM system_settings WHERE key IN ('auto_archive_enabled', 'auto_archive_days')",
      args: [],
    });
    const settings = {};
    for (const row of result.rows) {
      settings[row.key] = row.value;
    }
    res.json({
      enabled: settings["auto_archive_enabled"] !== "0",
      days: Number(settings["auto_archive_days"] || 7),
    });
  },
);

router.patch(
  "/settings/auto-archive",
  requireAuth,
  requireSecretariat,
  async (req, res) => {
    const { enabled, days } = req.body;
    if (enabled !== undefined) {
      await db.execute({
        sql: "UPDATE system_settings SET value=?, updated_at=datetime('now'), updated_by=? WHERE key='auto_archive_enabled'",
        args: [enabled ? "1" : "0", req.user.name],
      });
    }
    if (days !== undefined) {
      const d = Math.max(1, Math.floor(Number(days)));
      await db.execute({
        sql: "UPDATE system_settings SET value=?, updated_at=datetime('now'), updated_by=? WHERE key='auto_archive_days'",
        args: [String(d), req.user.name],
      });
    }
    res.json({ success: true });
  },
);

export default router;
