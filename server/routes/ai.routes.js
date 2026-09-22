/**
 * server/routes/ai.routes.js
 * AI 공소사실 생성 / 교정 및 Mojang 외부 API 프록시 라우트
 */
import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import { asyncWrap } from "../utils/helpers.js";

const router = Router();

// ── 1. AI 공소사실 자동생성 / 교정 (POST /api/ai/indictment-draft) ──
router.post(
  "/ai/indictment-draft",
  requireAuth,
  asyncWrap(async (req, res) => {
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
      return res.status(503).json({
        success: false,
        message:
          "AI 기능이 비활성화되어 있습니다. 서버에 GEMINI_API_KEY를 설정해주세요.",
      });
    }

    const {
      mode = "draft",
      defendants = [],
      charges = [],
      incidentDate = "",
      caseNo = "",
      evidenceList = [],
      currentText = "",
    } = req.body;

    const defNames = defendants
      .map(
        (d, i) =>
          `피고인 ${i + 1}: ${d.name || "(성명 미상)"}${d.uuid ? ` (UUID: ${d.uuid})` : ""}`,
      )
      .join(", ");
    const chargeNames =
      charges
        .map((c) => c.name)
        .filter(Boolean)
        .join(", ") || "해당 범죄";
    const lawArticles = charges
      .map((c) => c.lawArticle)
      .filter(Boolean)
      .join(", ");
    const evidenceSummary =
      evidenceList.length > 0
        ? evidenceList.map((e, i) => `${i + 1}. ${e.title}`).join("\n")
        : "등록된 증거자료 없음";

    let prompt;

    if (mode === "draft") {
      prompt = `당신은 대한민국 검사입니다. 아래 사건 정보를 바탕으로 공소장의 공소사실(범죄사실) 문단을 작성하세요.

[사건 정보]
- 사건번호: ${caseNo || "(미입력)"}
- 피고인: ${defNames || "(미상)"}
- 죄명: ${chargeNames}
- 적용법조: ${lawArticles || "(미입력)"}
- 사건 발생일: ${incidentDate || "(미입력)"}
- 증거목록:
${evidenceSummary}

[작성 기준]
1. 한국어 법률 문체로 작성할 것 (경어 없이 서술형)
2. 구조: "피고인 OOO은(는) [일시]경 [장소]에서, [범행 경위·방법·결과]하여, 이로써 피고인은 [죄명]의 죄책을 면할 수 없다." 형식을 따를 것
3. 마크다운, 특수문자, 제목 없이 순수 텍스트만 출력할 것
4. 허구의 구체적 사실(피해 금액, 서버 좌표 등)을 임의로 추가하지 말고, 주어진 정보 범위 내에서만 서술할 것
5. 증거목록이 있으면 "관련 증거: OOO 등에 의하면" 형태로 자연스럽게 언급할 것
6. 작성자 초안이 있으면 그 내용의 사실관계와 핵심 취지를 우선 반영할 것
7. 작성자 초안에 없는 구체적 사실은 임의로 보충하지 말 것

[작성자 초안]
${currentText.trim() || "(작성자 초안 없음)"}`;
    } else if (mode === "refine") {
      if (!currentText.trim()) {
        return res
          .status(400)
          .json({ success: false, message: "교정할 텍스트가 없습니다." });
      }
      prompt = `당신은 대한민국 검사입니다. 아래 공소사실 초안을 법률 문체로 교정하세요.

[원문]
${currentText}

[교정 기준]
1. 내용·사실관계를 임의로 변경하지 말 것
2. 구어체·일상체를 법률 서술체로 수정할 것 (예: "~했어요" → "~하였다")
3. 문단 구조는 유지하되, 어색한 표현과 오탈자를 수정할 것
4. 마크다운, 특수문자, 제목 없이 순수 텍스트만 출력할 것`;
    } else {
      return res.status(400).json({
        success: false,
        message: "mode는 'draft' 또는 'refine'이어야 합니다.",
      });
    }

    const fallbackModels = [
      "gemini-3.8-flash",
      "gemini-3.7-flash",
      "gemini-3.6-flash",
      "gemini-3.5-flash",
    ];

    const geminiBody = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 1024,
      },
    };

    let lastErrorMsg = "";
    let lastStatusCode = 500;
    let successResult = null;

    for (const model of fallbackModels) {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
      const maxAttempts = 2;

      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
          const geminiRes = await fetch(geminiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(geminiBody),
          });

          if (geminiRes.ok) {
            const geminiData = await geminiRes.json();
            const text =
              geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
            if (text) {
              successResult = text;
              break;
            }
          }

          lastStatusCode = geminiRes.status;
          const errText = await geminiRes.text();
          console.warn(
            `[AI /indictment-draft] 모델 ${model} 시도 ${attempt}/${maxAttempts} 실패 (${geminiRes.status}):`,
            errText.slice(0, 200),
          );

          try {
            const parsed = JSON.parse(errText);
            lastErrorMsg = parsed.error?.message || errText;
          } catch {
            lastErrorMsg = errText || `HTTP ${geminiRes.status}`;
          }

          // 404(모델 없음)이거나 400(잘못된 요청)인 경우 재시도 없이 즉시 다음 모델로 이동
          if (geminiRes.status === 404 || geminiRes.status === 400) {
            break;
          }

          const shouldRetry = [429, 503].includes(geminiRes.status);
          if (!shouldRetry) {
            break;
          }

          if (attempt < maxAttempts) {
            await new Promise((resolve) => setTimeout(resolve, 800));
          }
        } catch (fetchErr) {
          console.error(`[AI /indictment-draft] ${model} fetch 실패:`, fetchErr);
          lastErrorMsg = fetchErr.message;
        }
      }

      if (successResult) break;
    }

    if (!successResult) {
      let userFriendlyMsg = lastErrorMsg;
      if (lastStatusCode === 503 || lastErrorMsg.includes("high demand") || lastErrorMsg.includes("overloaded")) {
        userFriendlyMsg = "현재 AI 서버 사용량이 많아 응답이 지연되고 있습니다. 잠시 후 다시 시도해주세요.";
      } else if (lastStatusCode === 429 || lastErrorMsg.includes("quota") || lastErrorMsg.includes("rate")) {
        userFriendlyMsg = "AI 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.";
      }

      return res.status(502).json({
        success: false,
        message: userFriendlyMsg || "AI 응답을 생성하지 못했습니다. 다시 시도해주세요.",
      });
    }

    res.json({ success: true, result: successResult });
  }),
);

// ── 2. Mojang API Proxy (GET /api/mojang/uuid/:username) ────────────
router.get("/mojang/uuid/:username", async (req, res) => {
  const { username } = req.params;
  const cleanName = String(username || "").trim();

  if (!cleanName) {
    return res.status(400).json({
      success: false,
      message: "닉네임을 입력해주세요.",
    });
  }

  // 1) playerdb.co
  try {
    const playerdbRes = await fetch(
      `https://playerdb.co/api/player/minecraft/${encodeURIComponent(cleanName)}`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (playerdbRes.status === 404) {
      return res.status(404).json({
        success: false,
        message: `'${cleanName}' 닉네임을 찾을 수 없습니다.`,
      });
    }
    if (playerdbRes.ok) {
      const data = await playerdbRes.json();
      const player = data?.data?.player;
      if (data?.success && player?.id) {
        const formattedId = (player.raw_id || player.id).replace(/-/g, "");
        return res.json({
          success: true,
          uuid: player.id,
          name: player.username,
          skinUrl:
            player.avatar ||
            `https://crafthead.net/avatars/${formattedId}?overlay=true`,
          avatarUrl:
            player.avatar ||
            `https://crafthead.net/avatars/${formattedId}?overlay=true`,
        });
      }
    }
  } catch (err) {
    console.warn("[playerdb.co]", err?.message);
  }

  // 2) crafthead.net
  try {
    const craftRes = await fetch(
      `https://crafthead.net/profile/${encodeURIComponent(cleanName)}`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (craftRes.ok) {
      const data = await craftRes.json();
      if (data?.id) {
        return res.json({
          success: true,
          uuid: data.id,
          name: data.name,
          skinUrl: `https://crafthead.net/skin/${data.id}`,
          avatarUrl: `https://crafthead.net/avatar/${data.id}`,
        });
      }
    }
  } catch (err) {
    console.warn("[crafthead.net]", err?.message);
  }

  // 3) api.mojang.com
  try {
    const mojangRes = await fetch(
      `https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(cleanName)}`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (mojangRes.ok) {
      const data = await mojangRes.json();
      if (data?.id) {
        return res.json({
          success: true,
          uuid: data.id,
          name: data.name,
          skinUrl: `https://crafthead.net/avatars/${data.id}?overlay=true`,
          avatarUrl: `https://crafthead.net/avatars/${data.id}?overlay=true`,
        });
      }
    }
    if (mojangRes.status === 204 || mojangRes.status === 404) {
      return res.status(404).json({
        success: false,
        message: `'${cleanName}' 닉네임을 찾을 수 없습니다.`,
      });
    }
  } catch (err) {
    console.warn("[api.mojang.com]", err?.message);
  }

  res.status(503).json({
    success: false,
    message:
      "Mojang 서비스가 일시적으로 사용 불가능합니다. 잠시 후 다시 시도해주세요.",
  });
});

export default router;
