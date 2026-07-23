import { useMemo } from "react";
import { useAuth } from "../contexts/AuthContext";
import { createV9Repository } from "../data/v9Repository";

// 현재 로그인 사용자에 바인딩된 V9 Repository 인스턴스 — uid가 바뀔 때만 새로 만든다.
export function useV9Repository() {
  const { currentUser } = useAuth();
  return useMemo(() => createV9Repository(currentUser?.uid), [currentUser?.uid]);
}
