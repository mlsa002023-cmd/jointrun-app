import { useMemo } from "react";
import { useAuth } from "../contexts/AuthContext";
import { createRecordRepository } from "../data/recordRepository";

// 현재 로그인 사용자에 바인딩된 Repository 인스턴스 — uid가 바뀔 때만 새로 만든다.
export function useRecordRepository() {
  const { currentUser } = useAuth();
  return useMemo(() => createRecordRepository(currentUser?.uid), [currentUser?.uid]);
}
