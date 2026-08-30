/**
 * Mojang Official & Fallback API Helper
 * 호출 순서:
 *  1. 서버 프록시 (http://localhost:5000/api/mojang/uuid/nickname) — CORS 우회
 *  2. playerdb.co — 레이트리밋 없는 안정적인 대체 API (CORS 허용)
 *  3. crafthead.net — Minecraft 프로필 형식
 *  4. api.mojang.com — 공식 Mojang API (UUID만 반환)
 *
 * ※ 2025-06-23부로 ashcon.app이 영구 종료되어 목록에서 제거함.
 */

function formatRawUuid(raw) {
  if (!raw) return "";
  const cleaned = String(raw).replace(/-/g, "");
  if (cleaned.length !== 32) return cleaned;
  return [
    cleaned.slice(0, 8),
    cleaned.slice(8, 12),
    cleaned.slice(12, 16),
    cleaned.slice(16, 20),
    cleaned.slice(20, 32),
  ].join("-");
}

export async function fetchMojangUuid(username) {
  if (!username || !username.trim()) {
    return { success: false, message: "닉네임을 입력해주세요." };
  }
  const cleanName = username.trim();

  // 0) 서버 프록시 — CORS 우회 (권장)
  try {
    const serverUrl = (() => {
      const loc = window.location;
      if (loc.port === "5173") {
        return `http://${loc.hostname}:5000/api/mojang/uuid/${encodeURIComponent(cleanName)}`;
      }
      return `/api/mojang/uuid/${encodeURIComponent(cleanName)}`;
    })();

    const res = await fetch(serverUrl, {
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.success && data?.uuid) {
        return data;
      }
    }
    if (res.status === 404) {
      return {
        success: false,
        message: `'${cleanName}' 닉네임을 Mojang DB에서 찾을 수 없습니다.`,
      };
    }
  } catch (err) {
    console.warn("[fetchMojangUuid] 서버 프록시 실패:", err?.message);
  }

  // 1) playerdb.co — 레이트리밋 없는 안정적인 대체 API
  try {
    const res = await fetch(
      `https://playerdb.co/api/player/minecraft/${encodeURIComponent(cleanName)}`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (res.status === 404) {
      return {
        success: false,
        message: `'${cleanName}' 닉네임을 Mojang DB에서 찾을 수 없습니다.`,
      };
    }
    if (res.ok) {
      const data = await res.json();
      const player = data?.data?.player;
      if (data?.success && player?.id) {
        const formattedUuid = formatRawUuid(player.raw_id || player.id);
        return {
          success: true,
          uuid: formattedUuid,
          name: player.username,
          skinUrl:
            player.avatar ||
            `https://crafatar.com/avatars/${formattedUuid}?overlay=true`,
          avatarUrl:
            player.avatar ||
            `https://crafatar.com/avatars/${formattedUuid}?overlay=true`,
        };
      }
    }
  } catch (err) {
    console.warn("[fetchMojangUuid] playerdb.co 실패:", err?.message);
  }

  // 2) crafthead.net — 폴백
  try {
    const res = await fetch(
      `https://crafthead.net/profile/${encodeURIComponent(cleanName)}`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (res.ok) {
      const data = await res.json();
      if (data?.id) {
        const formattedUuid = formatRawUuid(data.id);
        return {
          success: true,
          uuid: formattedUuid,
          name: data.name,
          skinUrl: `https://crafthead.net/skin/${data.id}`,
          avatarUrl: `https://crafthead.net/avatar/${data.id}`,
        };
      }
    }
  } catch (err) {
    console.warn("[fetchMojangUuid] crafthead.net 실패:", err?.message);
  }

  // 3) 공식 Mojang API — UUID만 반환하는 최소 폴백
  try {
    const res = await fetch(
      `https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(cleanName)}`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (res.ok) {
      const data = await res.json();
      if (data?.id) {
        const formattedUuid = formatRawUuid(data.id);
        return {
          success: true,
          uuid: formattedUuid,
          name: data.name,
          skinUrl: `https://crafatar.com/avatars/${formattedUuid}?overlay=true`,
          avatarUrl: `https://crafatar.com/avatars/${formattedUuid}?overlay=true`,
        };
      }
    }
    if (res.status === 204 || res.status === 404) {
      return {
        success: false,
        message: `'${cleanName}' 닉네임을 Mojang DB에서 찾을 수 없습니다.`,
      };
    }
  } catch (err) {
    console.warn("[fetchMojangUuid] api.mojang.com 실패:", err?.message);
  }

  return {
    success: false,
    message: `'${cleanName}' 조회에 실패했습니다. 잠시 후 다시 시도해주세요.`,
  };
}