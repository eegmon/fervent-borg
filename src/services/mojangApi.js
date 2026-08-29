/**
 * Mojang Official & Fallback API Helper
 * Fetches Minecraft Player UUID & Profile from Mojang DB
 *
 * 호출 순서:
 *  1. ashcon.app   — UUID + 텍스처 통합 응답 (CORS 허용)
 *  2. crafthead.net — Minecraft 프로필 형식
 *  3. api.mojang.com — 공식 Mojang API (UUID만 반환)
 */

export async function fetchMojangUuid(username) {
  if (!username || !username.trim()) {
    return { success: false, message: '닉네임을 입력해주세요.' };
  }
  const cleanName = username.trim();

  // 1) ashcon.app — 통합 API
  try {
    const res = await fetch(
      `https://api.ashcon.app/mojang/v2/user/${encodeURIComponent(cleanName)}`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (res.ok) {
      const data = await res.json();
      if (data?.uuid) {
        return {
          success: true,
          uuid: data.uuid,
          name: data.username,
          skinUrl:
            data.textures?.skin?.url ||
            `https://crafatar.com/avatars/${data.uuid}?overlay=true`,
          avatarUrl: `https://crafatar.com/avatars/${data.uuid}?overlay=true`,
        };
      }
      // 404 등 — 닉네임 미존재
      if (res.status === 404) {
        return {
          success: false,
          message: `'${cleanName}' 닉네임을 Mojang DB에서 찾을 수 없습니다.`,
        };
      }
    }
  } catch (err) {
    console.warn('[fetchMojangUuid] ashcon.app 실패:', err?.message);
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
    console.warn('[fetchMojangUuid] crafthead.net 실패:', err?.message);
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
    console.warn('[fetchMojangUuid] api.mojang.com 실패:', err?.message);
  }

  return {
    success: false,
    message: `'${cleanName}' 조회에 실패했습니다. 잠시 후 다시 시도해주세요.`,
  };
}

function formatRawUuid(rawId) {
  if (!rawId) return '';
  if (rawId.length === 36) return rawId;
  if (rawId.length === 32) {
    return `${rawId.slice(0, 8)}-${rawId.slice(8, 12)}-${rawId.slice(12, 16)}-${rawId.slice(16, 20)}-${rawId.slice(20)}`;
  }
  return rawId;
}
