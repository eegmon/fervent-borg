# 휴가·직무대리 위임 중 읽기전용 접근 + 본인 복귀 기능 구현 계획서

## 개요

`ON_LEAVE`(휴가) / `DELEGATED`(직무대리 위임) 상태 계정이 시스템에 **읽기 전용**으로 접근할 수 있도록 하고,
헤더 상단에 상태 배너와 **본인 복귀 버튼**을 제공한다.

`DELEGATED` 복귀 시에는 대리자 계정의 `dualRoleLevel` 및 직무대리 정보도 연쇄 초기화한다.

---

## 현재 문제

| 상태 | 로그인 | API 접근 |
|---|---|---|
| `ACTIVE` | ✅ | ✅ |
| `ON_LEAVE` | ✅ (로그인 폼 통과) | ❌ `requireAuth`에서 401 차단 |
| `DELEGATED` | ✅ (로그인 폼 통과) | ❌ `requireAuth`에서 401 차단 |

`requireAuth` 미들웨어가 `status !== "ACTIVE"` 이면 유효한 JWT라도 즉시 차단하기 때문에
데이터를 전혀 조회할 수 없다.

---

## 변경 범위

| 파일 | 변경 내용 |
|---|---|
| `server/index.js` | `requireAuth` 수정 / `requireReadWrite` 추가 / `POST /api/auth/return` 추가 / DB 스키마 `acting_user_id` 컬럼 추가 |
| `server/db.js` | `prosecutors` 테이블에 `acting_user_id` 컬럼 추가 |
| `src/services/api.js` | `returnToActiveApi()` 함수 추가 |
| `src/App.jsx` | `isReadOnly` 파생 변수 / `handleReturnToActive` 핸들러 / Header·각 컴포넌트에 prop 전달 |
| `src/components/Header.jsx` | `isReadOnly` prop 수신 / 상태 배너 + 복귀 버튼 UI 추가 |
| `src/components/MainLedger.jsx` | `isReadOnly` prop 수신 / 쓰기 버튼 비활성화 |
| `src/components/MyCasesLedger.jsx` | 동일 |
| `src/components/ApprovalSystem.jsx` | 동일 |
| `src/components/SecretariatAdmin.jsx` | 동일 |
| `src/components/SecretariatAdmin.jsx` | `ActingOrderPanel` 발령 시 `acting_user_id` 저장 추가 |

---

## 세부 구현 계획

### 1. DB 스키마 — `acting_user_id` 컬럼 추가 (`server/db.js`)

`DELEGATED` 상태 복귀 시 대리자 ID를 찾기 위해 피대리인 계정에 대리자 ID를 저장한다.
현재 `delegate_to`에는 이름 문자열만 저장되어 ID를 특정할 수 없다.

```sql
ALTER TABLE prosecutors ADD COLUMN acting_user_id TEXT DEFAULT '';
```

`db.js`의 `initDb()` 내 ALTER TABLE 목록에 추가:
```js
"acting_user_id TEXT DEFAULT ''",
```

---

### 2. 서버 — `requireAuth` 수정 (`server/index.js`)

`ON_LEAVE` / `DELEGATED` 상태를 통과시키되 `req.user.isReadOnly = true` 플래그를 부착한다.

**현재:**
```js
if (result.rows.length === 0 || result.rows[0].status !== "ACTIVE") {
  return res.status(401).json({ success: false, message: "비활성화된 계정입니다." });
}
```

**변경 후:**
```js
const READONLY_STATUSES = new Set(["ON_LEAVE", "DELEGATED"]);

if (result.rows.length === 0) {
  return res.status(401).json({ success: false, message: "계정을 찾을 수 없습니다." });
}
const statusVal = result.rows[0].status;
if (statusVal !== "ACTIVE" && !READONLY_STATUSES.has(statusVal)) {
  return res.status(401).json({ success: false, message: "비활성화된 계정입니다." });
}
// ON_LEAVE / DELEGATED → 읽기 전용 플래그 부착
req.user.isReadOnly = READONLY_STATUSES.has(statusVal);
```

---

### 3. 서버 — `requireReadWrite` 미들웨어 신규 추가 (`server/index.js`)

모든 쓰기(POST/PUT/PATCH/DELETE) 엔드포인트의 `requireAuth` 바로 뒤에 삽입한다.

```js
function requireReadWrite(req, res, next) {
  if (req.user?.isReadOnly) {
    return res.status(403).json({
      success: false,
      message: "읽기 전용 상태입니다. 휴가 또는 직무대리 위임 중에는 데이터 변경이 불가합니다.",
    });
  }
  next();
}
```

**적용 패턴:**
```
requireAuth → requireReadWrite → requireSecretariat → ...
requireAuth → requireReadWrite → requireCaseScope → ...
```

`/api/auth/return` (복귀 엔드포인트)에는 `requireReadWrite`를 붙이지 않는다 (읽기전용 계정이 호출해야 하므로).

---

### 4. 서버 — 복귀 API 추가 (`server/index.js`)

```
POST /api/auth/return
인증: requireAuth (읽기전용 계정도 통과)
```

**핵심 원칙: status가 아니라 `acting_user_id` 유무로 대리자 연쇄 초기화 여부를 결정한다.**

`ON_LEAVE`도 대리자를 지정할 수 있으므로, `DELEGATED`만 대리자 초기화를 하는 것이 아니라
**`acting_user_id`가 있으면 status에 관계없이 대리자 계정도 초기화**한다.

**동작:**
1. `req.user.status`가 `ON_LEAVE` 또는 `DELEGATED`인지 확인
2. 본인 계정: `status = 'ACTIVE'`, `delegate_to`, `delegate_reason`, `acting_user_id` 초기화
3. **`acting_user_id`가 있는 경우 (status 무관):**
   - 대리자 계정의 `dual_role_level`, `acting_title`, `acting_start`, `acting_end`, `delegate_to`, `delegate_reason` 초기화
   - `office_documents`에서 해당 명령서를 `'해제완료(본인복귀)'`로 업데이트
4. 감사 로그 기록

```js
app.post("/api/auth/return", requireAuth, asyncWrap(async (req, res) => {
  const { status, id: userId, actingUserId } = req.user;

  if (!["ON_LEAVE", "DELEGATED"].includes(status)) {
    return res.status(400).json({ success: false, message: "복귀 처리가 필요한 상태가 아닙니다." });
  }

  // 본인 계정 복귀 (status, 위임 정보 전체 초기화)
  await db.execute({
    sql: `UPDATE prosecutors
            SET status='ACTIVE', delegate_to='', delegate_reason='', acting_user_id=''
          WHERE id=?`,
    args: [userId],
  });

  // acting_user_id가 있으면 status 무관하게 대리자 계정도 초기화
  // (ON_LEAVE도 대리자를 지정할 수 있음)
  if (actingUserId) {
    await db.execute({
      sql: `UPDATE prosecutors SET
              dual_role_level='', acting_title='',
              acting_start='', acting_end='',
              delegate_to='', delegate_reason=''
            WHERE id=?`,
      args: [actingUserId],
    });

    // 직무대리명령 명령서 상태 업데이트
    await db.execute({
      sql: `UPDATE office_documents
              SET payload_json = json_patch(payload_json, '{"status":"해제완료(본인복귀)"}')
            WHERE document_type='order'
              AND json_extract(payload_json,'$.originalUserId')=?
              AND json_extract(payload_json,'$.status')='발령중'
              AND deleted_at=''`,
      args: [userId],
    });
  }

  const detail =
    status === "ON_LEAVE"
      ? actingUserId
        ? "휴가 복귀 처리 (직무대리 연쇄 해제)"
        : "휴가 복귀 처리"
      : "직무대리 위임 종료 후 복귀 처리";

  await writeAuditLog({
    action: "RETURN",
    entityType: "prosecutor",
    entityId: userId,
    entityLabel: req.user.name,
    actorId: userId,
    actorName: req.user.name,
    detail,
  });

  res.json({ success: true });
}));
```

---

### 5. 서버 — `ActingOrderPanel` 발령 시 `acting_user_id` 저장 (`SecretariatAdmin.jsx` + 서버)

피대리인 계정 업데이트 시 `actingUserId`를 `actingUserId` 필드로 함께 저장:

```js
// SecretariatAdmin.jsx - handleIssueOrder 내부
onUpdateProsecutorStatus(origId, {
  status: "DELEGATED",
  delegateTo: `${act.name} (${form.actingTitle})`,
  delegateReason: `[직무대리명령] ${form.reason}`,
  actingUserId: act.id,   // ← 신규 추가
});
```

서버 `PATCH /api/prosecutors/:id`의 `allowedFields`에 추가:
```js
actingUserId: "acting_user_id",
```

---

### 6. 클라이언트 — `isReadOnly` 파생 변수 및 복귀 핸들러 (`src/App.jsx`)

```js
// 읽기 전용 여부: 휴가 또는 직무대리 위임 중
const isReadOnly = Boolean(
  currentUser && ["ON_LEAVE", "DELEGATED"].includes(currentUser.status)
);

// 복귀 핸들러
const handleReturnToActive = async () => {
  const label = currentUser.status === "ON_LEAVE" ? "휴가 복귀" : "직무대리 종료 및 복귀";
  if (!window.confirm(`${label} 처리하시겠습니까?`)) return;

  const res = await returnToActiveApi();   // POST /api/auth/return
  if (!res?.success) {
    showToast(res?.message || "복귀 처리에 실패했습니다.", "error");
    return;
  }

  // sessionStorage의 currentUser status를 ACTIVE로 갱신
  const updated = { ...currentUser, status: "ACTIVE" };
  setCurrentUser(updated);
  sessionStorage.setItem("dose_pros_session", JSON.stringify(updated));
  showToast(`${label} 처리가 완료되었습니다.`, "success");
};
```

Header에 prop 추가:
```jsx
<Header
  ...
  isReadOnly={isReadOnly}
  onReturnToActive={handleReturnToActive}
/>
```

각 컴포넌트에 `isReadOnly` prop 전달 후 버튼 비활성화 처리.

---

### 7. 헤더 배너 (`src/components/Header.jsx`)

탭 네비게이션 **위에** 고정 배너를 삽입한다.

| 상태 | 배너 색상 | 문구 |
|---|---|---|
| `ON_LEAVE` | 노란색 (`#f59e0b`) | `🟡 휴가 중 — 읽기 전용 모드로 접속 중입니다. 데이터 변경이 제한됩니다.` |
| `DELEGATED` | 주황색 (`#f97316`) | `🔶 직무대리 위임 중 — 직무대리자가 업무를 수행 중입니다. 읽기 전용으로 접속 중입니다.` |

오른쪽에 **복귀 버튼** 배치:
- `ON_LEAVE` → `"휴가 복귀"` 버튼
- `DELEGATED` → `"복귀 및 직무대리 종료"` 버튼 (클릭 시 confirm 다이얼로그)

```jsx
{isReadOnly && currentUser && (
  <div style={{
    background: currentUser.status === "ON_LEAVE"
      ? "rgba(245,158,11,0.12)" : "rgba(249,115,22,0.12)",
    borderBottom: `1px solid ${currentUser.status === "ON_LEAVE"
      ? "rgba(245,158,11,0.4)" : "rgba(249,115,22,0.4)"}`,
    padding: "8px 24px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    fontSize: "0.82rem",
  }}>
    <span style={{ color: currentUser.status === "ON_LEAVE" ? "#f59e0b" : "#f97316", fontWeight: 700 }}>
      {currentUser.status === "ON_LEAVE"
        ? "🟡 휴가 중 — 읽기 전용 모드로 접속 중입니다. 데이터 변경이 제한됩니다."
        : "🔶 직무대리 위임 중 — 직무대리자가 업무를 수행 중입니다. 읽기 전용으로 접속 중입니다."}
    </span>
    <button
      onClick={onReturnToActive}
      className="btn btn-gold"
      style={{ padding: "4px 14px", fontSize: "0.78rem" }}
    >
      {currentUser.status === "ON_LEAVE" ? "휴가 복귀" : "복귀 및 직무대리 종료"}
    </button>
  </div>
)}
```

---

### 8. UI 버튼 비활성화

`isReadOnly={true}` 수신 시 각 컴포넌트에서 처리:

| 컴포넌트 | 비활성화 대상 |
|---|---|
| `MainLedger` | 수정·결재·보존·결재지정 버튼 |
| `MyCasesLedger` | 수정·결재·보존 버튼 |
| `ApprovalSystem` | 결재·반려 버튼 |
| `SecretariatAdmin` | 모든 저장/변경/삭제 버튼 |
| `Header` | 신규 사건 접수 버튼 (`onOpenIntakeModal` 차단) |

비활성화 스타일: `opacity: 0.4`, `cursor: "not-allowed"`, `disabled` 속성 추가.

---

## 복귀 플로우 요약

```
[ON_LEAVE 계정 — 대리자 없음]
  로그인 → 헤더에 🟡 배너 표시 → 읽기 전용 접근
  → "휴가 복귀" 클릭 → confirm
  → POST /api/auth/return
  → 본인 status = ACTIVE
  → sessionStorage 갱신 → 정상 모드 전환

[ON_LEAVE 계정 — 대리자 있음 (acting_user_id 존재)]
  로그인 → 헤더에 � 배너 표시 → 읽기 전용 접근
  → "휴가 복귀" 클릭 → confirm
  → POST /api/auth/return
  → 본인 status = ACTIVE + 위임 정보 초기화
  → acting_user_id로 대리자 계정도 연쇄 초기화
  → office_documents 명령서 상태 = "해제완료(본인복귀)"
  → 감사 로그 기록
  → sessionStorage 갱신 → 정상 모드 전환

[DELEGATED 계정 — acting_user_id 존재]
  로그인 → 헤더에 🔶 배너 표시 → 읽기 전용 접근
  → "복귀 및 직무대리 종료" 클릭 → confirm
  → POST /api/auth/return
  → 본인 status = ACTIVE + 위임 정보 초기화
  → acting_user_id로 대리자 계정 연쇄 초기화
  → office_documents 명령서 상태 = "해제완료(본인복귀)"
  → 감사 로그 기록
  → sessionStorage 갱신 → 정상 모드 전환

※ 대리자 연쇄 초기화는 status가 아닌 acting_user_id 유무로만 판단한다.
```

---

## 구현 순서

1. `server/db.js` — `acting_user_id` 컬럼 추가
2. `server/index.js` — `requireAuth` 수정 + `requireReadWrite` 추가 + 쓰기 엔드포인트 전체 적용 + `POST /api/auth/return` 추가 + `allowedFields`에 `actingUserId` 추가
3. `src/services/api.js` — `returnToActiveApi()` 추가
4. `src/components/SecretariatAdmin.jsx` — `handleIssueOrder`에 `actingUserId` 저장 추가
5. `src/App.jsx` — `isReadOnly` + `handleReturnToActive` + prop 전달
6. `src/components/Header.jsx` — 배너 + 복귀 버튼 UI
7. 각 컴포넌트 — `isReadOnly` prop 수신 및 버튼 비활성화
8. 빌드 확인
