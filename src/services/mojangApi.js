/**
 * Mojang Official & Fallback API Helper
 * Fetches Minecraft Player UUID & Profile from Mojang DB
 */

export async function fetchMojangUuid(username) {
  if (!username || !username.trim()) {
    return { success: false, message: '닉네임을 입력해주세요.' };
  }
  const cleanName = username.trim();

  // Try direct Mojang API / CORS proxy fallback
  try {
    const res = await fetch(`https://api.ashcon.app/mojang/v2/user/${encodeURIComponent(cleanName)}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.uuid) {
        return {
          success: true,
          uuid: data.uuid,
          name: data.username,
          skinUrl: data.textures?.skin?.url || `https://crafatar.com/avatars/${data.uuid}?overlay=true`,
          avatarUrl: `https://crafatar.com/avatars/${data.uuid}?overlay=true`
        };
      }
    }
  } catch (err) {
    // Fallback to Crafthead API
  }

  try {
    const res = await fetch(`https://crafthead.net/profile/${encodeURIComponent(cleanName)}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.id) {
        const formattedUuid = formatRawUuid(data.id);
        return {
          success: true,
          uuid: formattedUuid,
          name: data.name,
          avatarUrl: `https://crafthead.net/avatar/${data.id}`
        };
      }
    }
  } catch (err) {}

  return { success: false, message: `'${cleanName}' 닉네임을 모장(Mojang) DB에서 찾을 수 없습니다.` };
}

function formatRawUuid(rawId) {
  if (!rawId) return '';
  if (rawId.length === 36) return rawId;
  if (rawId.length === 32) {
    return `${rawId.slice(0,8)}-${rawId.slice(8,12)}-${rawId.slice(12,16)}-${rawId.slice(16,20)}-${rawId.slice(20)}`;
  }
  return rawId;
}
