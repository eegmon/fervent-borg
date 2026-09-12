/**
 * server/routes/admin.routes.js
 * 검사 계정 관리, 부서, 죄명, 가입 승인, 감사 로그, 공문서 관리 라우트
 */
import { Router } from "express";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { db } from "../db.js";
import {
  requireAuth,
  requireSecretariat,
} from "../middlewares/auth.js";
import {
  ROLE_AUTHORITY,
  ACCOUNT_ROLE_LEVELS,
  SECRETARIAT_ROLES,
  MANAGEMENT_ROLE_LEVELS,
  SELF_ROLE_CHANGE_ROLES,
  TOP_ROLE_MANAGERS,
  effectiveRoleLevel,
  hasSecretariatWorkAccess,
  isManagementAccount,
} from "../config/roles.js";
import {
  toCamel,
  asyncWrap,
} from "../utils/helpers.js";
import { writeAuditLog } from "../services/auditService.js";

const router = Router();

// 일반 사용자(평검사 등)에게 노출할 최소 필드 화이트리스트
const PROSECUTOR_PUBLIC_FIELDS = new Set([
  "id",
  "name",
  "rank",
  "position",
  "title",
  "dept",
  "roleLevel",
  "status",
  "activeCases",
]);

function requireChargeHardDeleteAccess(req, res, next) {
  const role = effectiveRoleLevel(req.user);
  const allow =
    req.user?.isSuperAdmin ||
    role === "PROSECUTOR_GENERAL" ||
    role === "CHIEF_PROSECUTOR" ||
    role === "DEPUTY_CHIEF" ||
    role === "CHIEF_ADMINISTRATOR";

  if (!allow) {
    return res.status(403).json({
      success: false,
      message: "완전 삭제는 최고 관리자 또는 검사장급 이상만 허용됩니다.",
    });
  }
  next();
}

function normalizeChargeMeta(raw = {}) {
  const statuteDays = Number(raw.statuteDays ?? raw.statute_days ?? 20);
  const isUnlimited = Boolean(raw.isUnlimited ?? raw.is_unlimited ?? false);
  const lawArticle =
    String(raw.lawArticle ?? raw.law_article ?? "소송법 제21조의2").trim() ||
    "소송법 제21조의2";
  const category = String(raw.category ?? "GENERAL").trim() || "GENERAL";
  const description = String(raw.description ?? "").trim();

  return {
    statuteDays:
      Number.isFinite(statuteDays) && statuteDays > 0 ? statuteDays : 20,
    isUnlimited,
    lawArticle,
    category,
    description,
  };
}

async function requireProsecutorAccountManager(req, res, next) {
  if (req.user.dept?.includes("사무국"))
    return requireSecretariat(req, res, next);
  if (
    !["PROSECUTOR_GENERAL", "CHIEF_PROSECUTOR", "SUPER_ADMIN"].includes(
      effectiveRoleLevel(req.user),
    )
  ) {
    const result = await db.execute({
      sql: "SELECT dept FROM prosecutors WHERE id = ?",
      args: [req.params.id],
    });
    if (result.rows[0]?.dept?.includes("사무국")) {
      return res.status(403).json({
        success: false,
        message: "검사장급 이상 검사만 검찰사무국 인원을 관리할 수 있습니다.",
      });
    }
  }
  requireSecretariat(req, res, next);
}

function requireLoginRecordAccess(req, res, next) {
  const role = effectiveRoleLevel(req.user);
  const allowed =
    req.user.isSuperAdmin ||
    MANAGEMENT_ROLE_LEVELS.has(role) ||
    hasSecretariatWorkAccess(req.user) ||
    role === "CHIEF_PROSECUTOR" ||
    role === "PROSECUTOR_GENERAL";
  if (!allowed) {
    return res.status(403).json({
      success: false,
      message: "관리용 계정 또는 검사장 이상만 감사 로그를 조회할 수 있습니다.",
    });
  }
  next();
}

// ── 1. 부서 관리 (GET / PUT /api/departments) ─────────────────────────
router.get("/departments", requireAuth, async (_req, res) => {
  const result = await db.execute({
    sql: "SELECT value FROM system_settings WHERE key='departments_json'",
    args: [],
  });
  try {
    res.json(JSON.parse(result.rows[0]?.value || "[]"));
  } catch {
    res
      .status(500)
      .json({ success: false, message: "부서 설정을 읽을 수 없습니다." });
  }
});

router.put(
  "/departments",
  requireAuth,
  requireSecretariat,
  async (req, res) => {
    if (!Array.isArray(req.body?.departments))
      return res.status(400).json({
        success: false,
        message: "부서 목록 형식이 올바르지 않습니다.",
      });
    const now = new Date().toISOString().replace("T", " ").substring(0, 19);
    await db.execute({
      sql: "UPDATE system_settings SET value=?, updated_at=?, updated_by=? WHERE key='departments_json'",
      args: [JSON.stringify(req.body.departments), now, req.user.id],
    });
    res.json({ success: true, departments: req.body.departments });
  },
);

// ── 2. 죄명 관리 (GET / POST / PATCH / DELETE /api/charges) ───────────
router.get("/charges", requireAuth, async (_req, res) => {
  const result = await db.execute(
    "SELECT id, name, statute_days, is_unlimited, law_article, category, description, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by FROM charges WHERE deleted_at = '' ORDER BY name COLLATE NOCASE",
  );
  res.json(result.rows.map(toCamel));
});

router.get(
  "/charges/deleted",
  requireAuth,
  requireSecretariat,
  async (_req, res) => {
    const result = await db.execute(
      "SELECT id, name, statute_days, is_unlimited, law_article, category, description, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by FROM charges WHERE deleted_at != '' ORDER BY deleted_at DESC",
    );
    res.json(result.rows.map(toCamel));
  },
);

router.post("/charges", requireAuth, requireSecretariat, async (req, res) => {
  const name = String(req.body?.name || "").trim();
  if (!name || name.length > 120) {
    return res
      .status(400)
      .json({ success: false, message: "죄명은 1~120자로 입력해주세요." });
  }

  const meta = normalizeChargeMeta(req.body || {});

  try {
    const result = await db.execute({
      sql: "INSERT INTO charges (name, statute_days, is_unlimited, law_article, category, description, created_by, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      args: [
        name,
        meta.statuteDays,
        meta.isUnlimited ? 1 : 0,
        meta.lawArticle,
        meta.category,
        meta.description,
        req.user.id,
        req.user.id,
      ],
    });
    res.json({
      success: true,
      charge: {
        id: Number(result.lastInsertRowid),
        name,
        statuteDays: meta.statuteDays,
        isUnlimited: meta.isUnlimited,
        lawArticle: meta.lawArticle,
        category: meta.category,
        description: meta.description,
      },
    });
  } catch (error) {
    if (
      String(error.message || error)
        .toLowerCase()
        .includes("unique")
    ) {
      return res
        .status(409)
        .json({ success: false, message: "이미 등록된 죄명입니다." });
    }
    throw error;
  }
});

router.patch(
  "/charges/:id",
  requireAuth,
  requireSecretariat,
  async (req, res) => {
    const name = String(req.body?.name || "").trim();
    if (!name || name.length > 120) {
      return res
        .status(400)
        .json({ success: false, message: "죄명은 1~120자로 입력해주세요." });
    }

    const meta = normalizeChargeMeta(req.body || {});

    try {
      const existing = await db.execute({
        sql: "SELECT id, name FROM charges WHERE id = ? AND deleted_at = ''",
        args: [req.params.id],
      });
      if (existing.rows.length === 0) {
        return res
          .status(404)
          .json({ success: false, message: "해당 죄명을 찾을 수 없습니다." });
      }

      await db.execute({
        sql: "UPDATE charges SET name = ?, statute_days = ?, is_unlimited = ?, law_article = ?, category = ?, description = ?, updated_at = ?, updated_by = ? WHERE id = ?",
        args: [
          name,
          meta.statuteDays,
          meta.isUnlimited ? 1 : 0,
          meta.lawArticle,
          meta.category,
          meta.description,
          new Date().toISOString(),
          req.user.id,
          req.params.id,
        ],
      });

      await writeAuditLog({
        action: "UPDATE",
        entityType: "charge",
        entityId: String(req.params.id),
        entityLabel: existing.rows[0].name,
        actorId: req.user.id,
        actorName: req.user.name,
        detail: `죄명 수정: ${existing.rows[0].name} → ${name} (${meta.lawArticle})`,
      });

      res.json({
        success: true,
        charge: {
          id: Number(req.params.id),
          name,
          statuteDays: meta.statuteDays,
          isUnlimited: meta.isUnlimited,
          lawArticle: meta.lawArticle,
          category: meta.category,
          description: meta.description,
        },
      });
    } catch (err) {
      console.error("[PATCH /charges]", err);
      res
        .status(500)
        .json({ success: false, message: "죄명 수정에 실패했습니다." });
    }
  },
);

router.delete(
  "/charges/:id",
  requireAuth,
  requireSecretariat,
  async (req, res) => {
    try {
      const existing = await db.execute({
        sql: "SELECT name FROM charges WHERE id = ? AND deleted_at = ''",
        args: [req.params.id],
      });
      if (existing.rows.length === 0) {
        return res
          .status(404)
          .json({ success: false, message: "해당 죄명을 찾을 수 없습니다." });
      }
      await db.execute({
        sql: "UPDATE charges SET deleted_at = ?, deleted_by = ?, updated_at = ? WHERE id = ? AND deleted_at = ''",
        args: [
          new Date().toISOString(),
          req.user.id,
          new Date().toISOString(),
          req.params.id,
        ],
      });
      await writeAuditLog({
        action: "DELETE",
        entityType: "charge",
        entityId: String(req.params.id),
        entityLabel: existing.rows[0].name,
        actorId: req.user.id,
        actorName: req.user.name,
        detail: `죄명 소프트 삭제: ${existing.rows[0].name}`,
      });
      res.json({ success: true, softDeleted: true });
    } catch (err) {
      console.error("[DELETE /charges]", err);
      res
        .status(500)
        .json({ success: false, message: "죄명 삭제에 실패했습니다." });
    }
  },
);

router.post(
  "/charges/:id/restore",
  requireAuth,
  requireSecretariat,
  async (req, res) => {
    try {
      const existing = await db.execute({
        sql: "SELECT name FROM charges WHERE id = ? AND deleted_at != ''",
        args: [req.params.id],
      });
      if (existing.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "복구 대상 죄명을 찾을 수 없습니다.",
        });
      }

      await db.execute({
        sql: "UPDATE charges SET deleted_at = '', deleted_by = '', updated_at = ?, updated_by = ? WHERE id = ?",
        args: [new Date().toISOString(), req.user.id, req.params.id],
      });

      await writeAuditLog({
        action: "UPDATE",
        entityType: "charge_restore",
        entityId: String(req.params.id),
        entityLabel: existing.rows[0].name,
        actorId: req.user.id,
        actorName: req.user.name,
        detail: `죄명 복구: ${existing.rows[0].name}`,
      });

      res.json({ success: true, restored: true });
    } catch (err) {
      console.error("[POST /charges/:id/restore]", err);
      res
        .status(500)
        .json({ success: false, message: "죄명 복구에 실패했습니다." });
    }
  },
);

router.post(
  "/charges/:id/hard-delete",
  requireAuth,
  requireChargeHardDeleteAccess,
  async (req, res) => {
    try {
      const existing = await db.execute({
        sql: "SELECT name, deleted_at FROM charges WHERE id = ?",
        args: [req.params.id],
      });
      if (existing.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "삭제 대상 죄명을 찾을 수 없습니다.",
        });
      }
      const row = existing.rows[0];
      if (!row.deleted_at || row.deleted_at === "") {
        return res.status(400).json({
          success: false,
          message: "완전 삭제는 소프트 삭제된 죄명에 대해서만 가능합니다.",
        });
      }

      await db.execute({
        sql: "DELETE FROM charges WHERE id = ?",
        args: [req.params.id],
      });

      await writeAuditLog({
        action: "DELETE",
        entityType: "charge_hard_delete",
        entityId: String(req.params.id),
        entityLabel: row.name,
        actorId: req.user.id,
        actorName: req.user.name,
        detail: `죄명 하드 삭제: ${row.name}`,
      });

      res.json({ success: true, hardDeleted: true });
    } catch (err) {
      console.error("[POST /charges/:id/hard-delete]", err);
      res
        .status(500)
        .json({ success: false, message: "하드 삭제에 실패했습니다." });
    }
  },
);

// ── 3. 검사 계정 관리 (GET / POST / PATCH / DELETE /api/prosecutors) ──
router.get(
  "/prosecutors",
  requireAuth,
  asyncWrap(async (req, res) => {
    const [result, caseCountResult] = await Promise.all([
      db.execute("SELECT * FROM prosecutors"),
      db.execute(
        "SELECT prosecutor_id, COUNT(*) AS cnt FROM cases WHERE deleted_at = '' AND is_archived = 0 GROUP BY prosecutor_id",
      ),
    ]);

    const activeCasesMap = {};
    for (const row of caseCountResult.rows) {
      if (row.prosecutor_id) activeCasesMap[row.prosecutor_id] = Number(row.cnt);
    }

    const canViewManagementAccounts =
      req.user.isSuperAdmin ||
      SECRETARIAT_ROLES.has(effectiveRoleLevel(req.user));
    const visibleRows = canViewManagementAccounts
      ? result.rows
      : result.rows.filter((row) => !isManagementAccount(toCamel(row)));

    const isSuperAdmin = req.user.isSuperAdmin;
    const isSecretariatRole = SECRETARIAT_ROLES.has(
      effectiveRoleLevel(req.user),
    );
    const isSecretariatWork = hasSecretariatWorkAccess(req.user);

    res.json(
      visibleRows.map((row) => {
        const { password: _pw, ...safe } = toCamel(row);
        safe.activeCases = activeCasesMap[safe.id] ?? 0;

        if (isSuperAdmin || isSecretariatRole) {
          return safe;
        }
        if (isSecretariatWork) {
          delete safe.discordId;
          delete safe.note;
          delete safe.delegateTo;
          delete safe.delegateReason;
          return safe;
        }
        return Object.fromEntries(
          Object.entries(safe).filter(([k]) => PROSECUTOR_PUBLIC_FIELDS.has(k)),
        );
      }),
    );
  }),
);

router.post(
  "/prosecutors",
  requireAuth,
  requireSecretariat,
  async (req, res) => {
    const {
      id,
      name,
      rank = "",
      position = "",
      title = "",
      roleLevel = "PROSECUTOR",
      dept = "",
      password,
      note = "",
      discordId = "",
    } = req.body;
    const canIssueAllRoles =
      req.user.isSuperAdmin ||
      effectiveRoleLevel(req.user) === "CHIEF_ADMINISTRATOR";
    const allowedRoles = canIssueAllRoles
      ? ACCOUNT_ROLE_LEVELS
      : [
          "PROSECUTOR",
          "PROBATIONARY",
          "SENIOR_PROSECUTOR",
          "ADMINISTRATOR",
          "ADMIN_PROBATIONARY",
        ];
    if (!id || !name || !password || !allowedRoles.includes(roleLevel)) {
      return res.status(400).json({
        success: false,
        message: "계정 ID, 이름, 비밀번호 또는 역할이 올바르지 않습니다.",
      });
    }
    if (password.length < 10) {
      return res.status(400).json({
        success: false,
        message: "비밀번호는 10자 이상이어야 합니다.",
      });
    }
    try {
      const existing = await db.execute({
        sql: "SELECT id FROM prosecutors WHERE id = ?",
        args: [id],
      });
      if (existing.rows.length > 0) {
        return res
          .status(409)
          .json({ success: false, message: "이미 사용 중인 아이디입니다." });
      }
      const hashedPassword = await bcrypt.hash(password, 12);
      await db.execute({
        sql: `INSERT INTO prosecutors
        (id, name, rank, position, title, role_level, dept, password, active_cases, status, note, discord_id)
        VALUES (?,?,?,?,?,?,?, ?,0,'ACTIVE',?,?)`,
        args: [
          id,
          name,
          rank,
          position,
          title,
          roleLevel,
          dept,
          hashedPassword,
          note,
          discordId,
        ],
      });
      await writeAuditLog({
        action: "CREATE",
        entityType: "prosecutor",
        entityId: id,
        entityLabel: id,
        actorId: req.user.id,
        actorName: req.user.name,
        detail: `계정 발급: ${name} (${roleLevel}, ${dept || "부서 미지정"})`,
      });
      const prosecutor = {
        id,
        name,
        rank,
        position,
        title,
        roleLevel,
        dept,
        activeCases: 0,
        status: "ACTIVE",
        note,
        discordId,
      };
      res.json({ success: true, prosecutor });
    } catch (err) {
      console.error("[POST /prosecutors]", err);
      res.status(500).json({ success: false, message: "서버 오류" });
    }
  },
);

router.patch(
  "/prosecutors/:id",
  requireAuth,
  async (req, res, next) => {
    const isSelf = req.user.id === req.params.id;
    const isSuperAdmin = req.user.isSuperAdmin;
    const isSecretariat =
      SECRETARIAT_ROLES.has(effectiveRoleLevel(req.user)) ||
      hasSecretariatWorkAccess(req.user);

    const userRole = effectiveRoleLevel(req.user);
    const DEPT_HEAD_ROLES = new Set([
      "SENIOR_PROSECUTOR",
      "CHIEF_PROSECUTOR",
      "DEPUTY_CHIEF",
      "CHIEF_ADMINISTRATOR",
      "PROSECUTOR_GENERAL",
      "SUPER_ADMIN",
    ]);
    const isDeptHeadRole =
      DEPT_HEAD_ROLES.has(userRole) ||
      (req.user.position || "").includes("부장") ||
      (req.user.position || "").includes("부서장");

    if (!isSelf && !isSuperAdmin && !isSecretariat && isDeptHeadRole) {
      const requestedFields = Object.keys(req.body).filter(
        (f) => f !== undefined && req.body[f] !== undefined,
      );
      const onlyStatus =
        requestedFields.length === 1 && requestedFields[0] === "status";
      const allowedStatuses = new Set(["ACTIVE", "LEAVE", "INACTIVE"]);

      if (onlyStatus && allowedStatuses.has(req.body.status)) {
        const targetRes = await db.execute({
          sql: "SELECT id, role_level, dept FROM prosecutors WHERE id = ?",
          args: [req.params.id],
        });
        if (targetRes.rows.length > 0) {
          const target = toCamel(targetRes.rows[0]);

          const deptRes = await db.execute("SELECT * FROM departments");
          const depts = deptRes.rows.map(toCamel);
          const isHeadOfTargetDept = depts.some(
            (d) =>
              d.name === target.dept &&
              (d.headId === req.user.id || (d.headName && d.headName.includes(req.user.name))),
          );

          const sameDept =
            ((req.user.dept || "") && req.user.dept === target.dept) ||
            ((req.user.dualDept || "") && req.user.dualDept === target.dept) ||
            isHeadOfTargetDept;

          if (sameDept) {
            return next();
          }
        }
      }
      return res.status(403).json({
        success: false,
        message:
          "부서장은 관장 부서원의 재직상태(휴직/복직)만 변경할 수 있습니다.",
      });
    }

    if (!isSelf && !isSuperAdmin && !isSecretariat) {
      return res.status(403).json({
        success: false,
        message: "본인 계정 또는 관리자만 계정 정보를 수정할 수 있습니다.",
      });
    }

    if (isSelf && !isSuperAdmin && !isSecretariat) {
      const adminOnlyFields = [
        "status",
        "roleLevel",
        "rank",
        "dept",
        "dualRoleLevel",
        "dualDept",
        "actingTitle",
        "actingStart",
        "actingEnd",
        "delegateTo",
        "delegateReason",
        "dualSecretariatWork",
        "isAutoAssignExcluded",
        "canArbitraryApprove",
      ];
      const forbidden = adminOnlyFields.filter(
        (f) => req.body[f] !== undefined,
      );
      if (forbidden.length > 0) {
        return res.status(403).json({
          success: false,
          message: `다음 필드는 관리자만 변경할 수 있습니다: ${forbidden.join(", ")}`,
        });
      }
    }

    if (!isSelf || isSuperAdmin || isSecretariat) {
      return requireProsecutorAccountManager(req, res, next);
    }
    next();
  },
  async (req, res) => {
    const allowedFields = {
      status: "status",
      dept: "dept",
      roleLevel: "role_level",
      rank: "rank",
      delegateTo: "delegate_to",
      delegateReason: "delegate_reason",
      dualPosition: "dual_position",
      dualDept: "dual_dept",
      dualRoleLevel: "dual_role_level",
      actingTitle: "acting_title",
      actingStart: "acting_start",
      actingEnd: "acting_end",
      dualSecretariatWork: "dual_secretariat_work",
      isAutoAssignExcluded: "is_auto_assign_excluded",
      canArbitraryApprove: "can_arbitrary_approve",
      position: "position",
      title: "title",
      discordId: "discord_id",
      actingUserId: "acting_user_id",
      note: "note",
    };
    const updates = Object.entries(allowedFields)
      .filter(([field]) => req.body[field] !== undefined)
      .map(([field, column]) => ({ column, value: req.body[field] }));
    const allowedRoleLevels = new Set([
      "PROSECUTOR_GENERAL",
      "CHIEF_PROSECUTOR",
      "DEPUTY_CHIEF",
      "CHIEF_ADMINISTRATOR",
      "SENIOR_PROSECUTOR",
      "PROSECUTOR",
      "PROBATIONARY",
      "ADMINISTRATOR",
      "ADMIN_PROBATIONARY",
    ]);
    if (
      req.body.roleLevel !== undefined &&
      !allowedRoleLevels.has(req.body.roleLevel)
    ) {
      return res
        .status(400)
        .json({ success: false, message: "허용되지 않는 직급입니다." });
    }
    const canManageAnyRole =
      req.user.isSuperAdmin ||
      hasSecretariatWorkAccess(req.user) ||
      TOP_ROLE_MANAGERS.has(effectiveRoleLevel(req.user));
    if (
      (req.body.roleLevel !== undefined || req.body.rank !== undefined) &&
      !canManageAnyRole &&
      !(
        req.params.id === req.user.id &&
        SELF_ROLE_CHANGE_ROLES.has(effectiveRoleLevel(req.user))
      )
    ) {
      return res
        .status(403)
        .json({ success: false, message: "승진·직급 변경 권한이 필요합니다." });
    }
    const canChangeOwnRole =
      req.user.isSuperAdmin || SELF_ROLE_CHANGE_ROLES.has(req.user.roleLevel);
    if (
      (req.body.roleLevel !== undefined || req.body.rank !== undefined) &&
      req.params.id === req.user.id &&
      !canChangeOwnRole
    ) {
      return res.status(403).json({
        success: false,
        message: "본인 계정의 직급은 변경할 수 없습니다.",
      });
    }
    if (req.body.roleLevel !== undefined) {
      const actorAuthority = req.user.isSuperAdmin
        ? ROLE_AUTHORITY.SUPER_ADMIN
        : ROLE_AUTHORITY[effectiveRoleLevel(req.user)] || 0;
      const targetAuthority = ROLE_AUTHORITY[req.body.roleLevel] || 0;
      if (
        !targetAuthority ||
        (!canManageAnyRole &&
          !(req.params.id === req.user.id && canChangeOwnRole) &&
          targetAuthority > actorAuthority)
      ) {
        return res.status(403).json({
          success: false,
          message: "본인보다 높은 권한으로 계정을 승격할 수 없습니다.",
        });
      }
    }
    if (updates.length === 0)
      return res
        .status(400)
        .json({ success: false, message: "변경할 값이 없습니다." });
    try {
      const setClause = updates.map(({ column }) => `${column}=?`).join(", ");
      await db.execute({
        sql: `UPDATE prosecutors SET ${setClause} WHERE id=?`,
        args: [...updates.map(({ value }) => value), req.params.id],
      });
      await writeAuditLog({
        action: "UPDATE",
        entityType: "prosecutor",
        entityId: req.params.id,
        entityLabel: req.params.id,
        actorId: req.user.id,
        actorName: req.user.name,
        detail: `계정 상태 및 권한 변경: ${updates.map(({ column }) => column).join(", ")}`,
      });
      res.json({ success: true });
    } catch (err) {
      console.error("[PATCH /prosecutors]", err);
      res.status(500).json({ success: false, message: "서버 오류" });
    }
  },
);

router.delete(
  "/prosecutors/:id",
  requireAuth,
  requireProsecutorAccountManager,
  async (req, res) => {
    const { id } = req.params;
    if (req.user.id === id) {
      return res
        .status(400)
        .json({ success: false, message: "본인 계정은 삭제할 수 없습니다." });
    }
    try {
      const existing = await db.execute({
        sql: "SELECT name, role_level FROM prosecutors WHERE id = ?",
        args: [id],
      });
      await db.execute({
        sql: "DELETE FROM prosecutors WHERE id = ?",
        args: [id],
      });
      const label = existing.rows[0]?.name || id;
      await writeAuditLog({
        action: "DELETE",
        entityType: "prosecutor",
        entityId: id,
        entityLabel: label,
        actorId: req.user.id,
        actorName: req.user.name,
        detail: `검사 계정 삭제: ${label} (${existing.rows[0]?.role_level || "-"})`,
      });
      res.json({ success: true });
    } catch (err) {
      console.error("[DELETE /prosecutors]", err);
      res
        .status(500)
        .json({ success: false, message: "서버 오류가 발생했습니다." });
    }
  },
);

router.patch(
  "/prosecutors/:id/password",
  requireAuth,
  asyncWrap(async (req, res) => {
    const { id } = req.params;
    const { currentPassword, newPassword } = req.body || {};
    const isSelf = req.user.id === id;
    const isSuperAdmin = req.user.isSuperAdmin;

    if (!isSelf && !isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: "본인 계정의 비밀번호만 변경할 수 있습니다.",
      });
    }

    if (!newPassword || newPassword.length < 10) {
      return res.status(400).json({
        success: false,
        message: "비밀번호는 10자 이상이어야 합니다.",
      });
    }

    try {
      const account = await db.execute({
        sql: "SELECT password FROM prosecutors WHERE id = ?",
        args: [id],
      });
      if (account.rows.length === 0) {
        return res
          .status(404)
          .json({ success: false, message: "계정을 찾을 수 없습니다." });
      }

      if (isSelf) {
        if (!currentPassword) {
          return res
            .status(400)
            .json({ success: false, message: "현재 비밀번호가 필요합니다." });
        }
        const storedPassword = account.rows[0].password;
        if (!(await bcrypt.compare(currentPassword, storedPassword))) {
          return res.status(401).json({
            success: false,
            message: "현재 비밀번호가 일치하지 않습니다.",
          });
        }
      }

      const hashed = await bcrypt.hash(newPassword, 12);
      await db.execute({
        sql: "UPDATE prosecutors SET password = ? WHERE id = ?",
        args: [hashed, id],
      });

      if (!isSelf) {
        await writeAuditLog({
          action: "UPDATE",
          entityType: "prosecutor",
          entityId: id,
          entityLabel: id,
          actorId: req.user.id,
          actorName: req.user.name,
          detail: "SUPER_ADMIN에 의한 비밀번호 강제 재설정",
        });
      }

      res.json({ success: true, message: "비밀번호가 변경되었습니다." });
    } catch (err) {
      console.error("[PATCH /prosecutors/password]", err);
      res
        .status(500)
        .json({ success: false, message: "서버 오류가 발생했습니다." });
    }
  }),
);

// ── 4. 가입 신청 관리 (GET / PUT /api/registrations) ──────────────────
router.get(
  "/registrations",
  requireAuth,
  asyncWrap(async (req, res) => {
    const isSecretariat =
      SECRETARIAT_ROLES.has(effectiveRoleLevel(req.user)) ||
      hasSecretariatWorkAccess(req.user);

    if (!isSecretariat) {
      return res
        .status(403)
        .json({ success: false, message: "검찰사무국 권한이 필요합니다." });
    }

    try {
      const result = await db.execute(
        "SELECT * FROM registrations ORDER BY created_at DESC",
      );
      res.json(
        result.rows.map((row) => {
          const { password: _pw, ...safe } = toCamel(row);
          return safe;
        }),
      );
    } catch (err) {
      console.error("[registrations GET]", err);
      res
        .status(500)
        .json({ success: false, message: "서버 오류가 발생했습니다." });
    }
  }),
);

router.put(
  "/registrations/:id/approve",
  requireAuth,
  requireSecretariat,
  async (req, res) => {
    const isSecretariat =
      SECRETARIAT_ROLES.has(effectiveRoleLevel(req.user)) ||
      hasSecretariatWorkAccess(req.user);

    if (!isSecretariat) {
      return res
        .status(403)
        .json({ success: false, message: "검찰사무국 권한이 필요합니다." });
    }

    try {
      const regRes = await db.execute({
        sql: "SELECT * FROM registrations WHERE id = ?",
        args: [req.params.id],
      });
      if (regRes.rows.length === 0) {
        return res
          .status(404)
          .json({ success: false, message: "신청 건을 찾을 수 없습니다." });
      }

      const reg = toCamel(regRes.rows[0]);
      if (reg.status !== "PENDING") {
        return res
          .status(409)
          .json({ success: false, message: "이미 처리된 신청입니다." });
      }

      const existPros = await db.execute({
        sql: "SELECT id FROM prosecutors WHERE id = ?",
        args: [reg.reqId],
      });
      if (existPros.rows.length > 0) {
        return res
          .status(409)
          .json({ success: false, message: "이미 사용 중인 아이디입니다." });
      }

      const now = new Date().toISOString().replace("T", " ").substring(0, 19);

      await db.execute({
        sql: `INSERT INTO prosecutors
              (id, name, rank, position, title, role_level, dept, password,
               active_cases, status, delegate_to, delegate_reason,
               is_super_admin, is_auto_assign_excluded, note)
            VALUES (?,?,?,?,?,?,?,?,0,'ACTIVE','','',0,0,?)`,
        args: [
          reg.reqId,
          reg.name,
          reg.rank || "",
          reg.position || "",
          reg.title || "",
          "PROSECUTOR",
          "",
          reg.password,
          reg.note || "",
        ],
      });

      await db.execute({
        sql: `UPDATE registrations SET status='APPROVED', reviewed_at=?, reviewed_by=? WHERE id=?`,
        args: [now, req.user.id, req.params.id],
      });

      await writeAuditLog({
        action: "CREATE",
        entityType: "prosecutor",
        entityId: reg.reqId,
        entityLabel: `${reg.name} (${reg.reqId})`,
        actorId: req.user.id,
        actorName: req.user.name,
        detail: "가입 신청 허가 및 검사 계정 등록",
      });

      res.json({
        success: true,
        message: `'${reg.name}' 계정이 승인되어 검찰 시스템에 등록되었습니다.`,
        user: {
          id: reg.reqId,
          name: reg.name,
          rank: reg.rank,
          position: reg.position,
          title: reg.title,
          roleLevel: reg.roleLevel,
          dept: reg.dept,
        },
      });
    } catch (err) {
      console.error("[registrations approve]", err);
      res
        .status(500)
        .json({ success: false, message: "서버 오류가 발생했습니다." });
    }
  },
);

router.put(
  "/registrations/:id/reject",
  requireAuth,
  asyncWrap(async (req, res) => {
    const isSecretariat =
      SECRETARIAT_ROLES.has(effectiveRoleLevel(req.user)) ||
      hasSecretariatWorkAccess(req.user);

    if (!isSecretariat) {
      return res
        .status(403)
        .json({ success: false, message: "검찰사무국 권한이 필요합니다." });
    }

    const { reason } = req.body;

    try {
      const regRes = await db.execute({
        sql: "SELECT * FROM registrations WHERE id = ?",
        args: [req.params.id],
      });
      if (regRes.rows.length === 0) {
        return res
          .status(404)
          .json({ success: false, message: "신청 건을 찾을 수 없습니다." });
      }

      const reg = toCamel(regRes.rows[0]);
      if (reg.status !== "PENDING") {
        return res
          .status(409)
          .json({ success: false, message: "이미 처리된 신청입니다." });
      }

      const now = new Date().toISOString().replace("T", " ").substring(0, 19);

      await db.execute({
        sql: `UPDATE registrations
              SET status='REJECTED', reject_reason=?, reviewed_at=?, reviewed_by=?
            WHERE id=?`,
        args: [
          reason || "검찰사무국 심사 불허",
          now,
          req.user.id,
          req.params.id,
        ],
      });

      res.json({
        success: true,
        message: `'${reg.name}' 가입 신청이 거부되었습니다.`,
      });
    } catch (err) {
      console.error("[registrations reject]", err);
      res
        .status(500)
        .json({ success: false, message: "서버 오류가 발생했습니다." });
    }
  }),
);

// ── 5. 감사 로그 및 히스토리 (GET / POST /api/audit-logs, /api/case-history)
router.get(
  "/audit-logs",
  requireAuth,
  requireLoginRecordAccess,
  async (req, res) => {
    try {
      const result = await db.execute(
        "SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 500",
      );
      res.json(result.rows.map(toCamel));
    } catch (err) {
      console.error("[GET /audit-logs]", err);
      res.status(500).json({ success: false, message: "서버 오류" });
    }
  },
);

router.get(
  "/case-history",
  requireAuth,
  requireLoginRecordAccess,
  async (req, res) => {
    try {
      const result = await db.execute(
        `SELECT * FROM case_history WHERE deleted_at = '' ORDER BY created_at DESC LIMIT 500`,
      );
      res.json(result.rows.map(toCamel));
    } catch (err) {
      console.error("[GET /case-history]", err);
      res.status(500).json({ success: false, message: "서버 오류" });
    }
  },
);

router.post(
  "/audit-logs",
  requireAuth,
  requireSecretariat,
  async (req, res) => {
    const {
      action,
      entityType = "system",
      entityId = "",
      entityLabel = "",
      detail = "",
    } = req.body || {};
    const allowedActions = new Set([
      "CREATE",
      "UPDATE",
      "DELETE",
      "APPROVE",
      "REJECT",
      "LOGIN",
      "LOGOUT",
    ]);
    const allowedEntityTypes = new Set([
      "case",
      "report",
      "appeal",
      "booking",
      "approval",
      "prosecutor",
      "system",
      "warrant",
      "evidence",
    ]);
    if (!allowedActions.has(action)) {
      return res.status(400).json({
        success: false,
        message: "감사 로그 행위가 올바르지 않습니다.",
      });
    }
    if (!allowedEntityTypes.has(entityType)) {
      return res.status(400).json({
        success: false,
        message: "허용되지 않는 엔티티 타입입니다.",
      });
    }
    const safeEntityId = String(entityId).slice(0, 200);
    const safeEntityLabel = String(entityLabel).slice(0, 200);
    const safeDetail = String(detail).slice(0, 1000);
    try {
      const id = `AL-${Date.now()}-${randomUUID().slice(0, 6)}`;
      const now = new Date().toISOString().replace("T", " ").substring(0, 19);
      await db.execute({
        sql: `INSERT INTO audit_logs (id, action, entity_type, entity_id, entity_label, actor_id, actor_name, detail, created_at)
              VALUES (?,?,?,?,?,?,?,?,?)`,
        args: [
          id,
          action,
          entityType,
          safeEntityId,
          safeEntityLabel,
          req.user.id,
          req.user.name,
          safeDetail,
          now,
        ],
      });
      res.json({
        success: true,
        log: {
          id,
          action,
          entityType,
          entityId: safeEntityId,
          entityLabel: safeEntityLabel,
          actorId: req.user.id,
          actorName: req.user.name,
          detail: safeDetail,
          createdAt: now,
        },
      });
    } catch (err) {
      console.error("[POST /audit-logs]", err);
      res
        .status(500)
        .json({ success: false, message: "감사 로그 저장에 실패했습니다." });
    }
  },
);

// ── 6. 공문서 (Office Documents) 관리 (GET / POST / PATCH / DELETE /api/office-documents)
router.get(
  "/office-documents",
  requireAuth,
  requireSecretariat,
  async (req, res) => {
    const allowedTypes = ["receive", "send", "archive", "order"];
    const type = String(req.query.type || "");
    if (!allowedTypes.includes(type))
      return res
        .status(400)
        .json({ success: false, message: "문서 유형이 올바르지 않습니다." });
    try {
      const result = await db.execute({
        sql: "SELECT id, payload_json, created_at FROM office_documents WHERE document_type=? AND deleted_at='' ORDER BY created_at DESC",
        args: [type],
      });
      res.json(
        result.rows.map((row) => ({
          ...JSON.parse(row.payload_json),
          id: row.id,
          createdAt: row.created_at,
        })),
      );
    } catch (err) {
      console.error("[GET /office-documents]", err);
      res
        .status(500)
        .json({ success: false, message: "문서를 불러오지 못했습니다." });
    }
  },
);

router.post(
  "/office-documents",
  requireAuth,
  requireSecretariat,
  async (req, res) => {
    const { type, document } = req.body || {};
    if (
      !["receive", "send", "archive", "order"].includes(type) ||
      !document ||
      typeof document !== "object"
    )
      return res
        .status(400)
        .json({ success: false, message: "문서 데이터가 올바르지 않습니다." });
    const id = String(
      document.id ||
        `DOC-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    );
    try {
      await db.execute({
        sql: "INSERT INTO office_documents (id,document_type,payload_json,created_by,created_at,deleted_at) VALUES (?,?,?,?,?,'')",
        args: [
          id,
          type,
          JSON.stringify({ ...document, id }),
          req.user.id,
          new Date().toISOString(),
        ],
      });
      res.json({ success: true, document: { ...document, id } });
    } catch (err) {
      console.error("[POST /office-documents]", err);
      res
        .status(500)
        .json({ success: false, message: "문서 저장에 실패했습니다." });
    }
  },
);

router.delete(
  "/office-documents/:id",
  requireAuth,
  requireSecretariat,
  async (req, res) => {
    try {
      await db.execute({
        sql: "UPDATE office_documents SET deleted_at=? WHERE id=? AND deleted_at=''",
        args: [new Date().toISOString(), req.params.id],
      });
      res.json({ success: true });
    } catch (err) {
      console.error("[DELETE /office-documents]", err);
      res
        .status(500)
        .json({ success: false, message: "문서 삭제에 실패했습니다." });
    }
  },
);

router.patch(
  "/office-documents/:id",
  requireAuth,
  requireSecretariat,
  async (req, res) => {
    if (!req.body?.document || typeof req.body.document !== "object")
      return res
        .status(400)
        .json({ success: false, message: "문서 데이터가 올바르지 않습니다." });
    try {
      const existing = await db.execute({
        sql: "SELECT payload_json FROM office_documents WHERE id=? AND deleted_at=''",
        args: [req.params.id],
      });
      if (!existing.rows.length)
        return res
          .status(404)
          .json({ success: false, message: "문서를 찾을 수 없습니다." });
      const document = {
        ...JSON.parse(existing.rows[0].payload_json),
        ...req.body.document,
        id: req.params.id,
      };
      await db.execute({
        sql: "UPDATE office_documents SET payload_json=? WHERE id=? AND deleted_at=''",
        args: [JSON.stringify(document), req.params.id],
      });
      res.json({ success: true, document });
    } catch (err) {
      console.error("[PATCH /office-documents]", err);
      res
        .status(500)
        .json({ success: false, message: "문서 수정에 실패했습니다." });
    }
  },
);

export default router;
