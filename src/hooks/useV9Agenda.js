import { useCallback, useEffect, useState } from "react";
import { useV9Repository } from "./useV9Repository";
import { getHomeAgendaState } from "../lib/recheckSchedule";

// HOME 상단 카드(04_APP_PRD_V9.md S07)가 필요로 하는 "지금 필요한 행동" 상태.
// activeEvent는 아직 완료되지 않은 가장 최근 Decision Loop 1건(없으면 null).
export function useV9Agenda() {
  const repository = useV9Repository();
  const [activeEvent, setActiveEvent] = useState(undefined); // undefined=로딩 전, null=없음
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setLoading(true);
    repository.getActiveEvent().then((event) => {
      setActiveEvent(event);
      setLoading(false);
    });
  }, [repository]);

  useEffect(() => { refresh(); }, [refresh]);

  const agenda = activeEvent === undefined ? null : getHomeAgendaState(activeEvent);

  return { activeEvent: activeEvent ?? null, agenda, loading, refresh };
}
