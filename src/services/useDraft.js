/**
 * useDraft.js
 * localStorage 기반 폼 임시저장 커스텀 훅
 *
 * 사용법:
 *   const { draft, saveDraft, clearDraft, hasDraft } = useDraft('dose_draft_intake');
 *
 * - 필드 변경 시 saveDraft(data) 호출 → 1초 디바운스 후 localStorage 저장
 * - 모달 열릴 때 hasDraft로 복원 배너 표시
 * - 제출/명시적 취소 시 clearDraft() 호출
 */
import { useState, useEffect, useRef, useCallback } from "react";

const DEBOUNCE_MS = 1000;

export function useDraft(storageKey) {
  const timerRef = useRef(null);

  // 기존 draft 존재 여부 — 최초 마운트 시 1회만 체크
  const [hasDraft, setHasDraft] = useState(() => {
    try {
      return !!localStorage.getItem(storageKey);
    } catch {
      return false;
    }
  });

  const readDraft = useCallback(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, [storageKey]);

  // 디바운스 저장 — 빠른 타이핑 중 매번 쓰지 않음
  const saveDraft = useCallback(
    (data) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        try {
          localStorage.setItem(storageKey, JSON.stringify(data));
          setHasDraft(true);
        } catch {
          // localStorage 용량 초과 등 — 무시
        }
      }, DEBOUNCE_MS);
    },
    [storageKey],
  );

  const clearDraft = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    try {
      localStorage.removeItem(storageKey);
    } catch {}
    setHasDraft(false);
  }, [storageKey]);

  // 컴포넌트 언마운트 시 pending 타이머 정리
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { hasDraft, readDraft, saveDraft, clearDraft };
}
