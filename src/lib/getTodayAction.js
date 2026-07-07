// src/lib/getTodayAction.js
// 홈 화면 "오늘의 AI 처방" 문구를 만든다.
// 통증 수치가 높으면 안전 우선 처방을, 아니면 온보딩에서 고른 concernArea(걱정 부위)에 맞춘
// 부위별 스트레칭을 추천한다.

const CONCERN_STRETCHES = {
  "엄지": "엄지 CM관절 스트레칭 — 엄지를 손바닥 쪽으로 천천히 접었다 펴기를 10회 반복해 보세요.",
  "끝마디": "끝마디(DIP관절) 스트레칭 — 손가락 끝마디만 살짝 굽혔다 펴는 동작을 좌우 10회씩 반복해 보세요.",
  "손전체": "손 전체 잼잼 스트레칭 — 주먹을 쥐었다 쫙 펴는 동작을 천천히 15회 반복해 보세요.",
};

export function getTodayAction(profile) {
  const name = profile?.name || "회원";

  if ((profile?.painIndex ?? 0) > 6) {
    return `${name} 님, 오늘 통증 수치가 높습니다. 무리한 손 사용을 줄이고 3분 온수 잼잼 요법을 즉시 시작해 주세요.`;
  }

  const stretch = CONCERN_STRETCHES[profile?.concernArea];
  if (stretch) {
    return `${name} 님, 평소 걱정하시던 ${profile.concernArea} 부위를 위해 오늘은 ${stretch}`;
  }

  return `${name} 님, 오늘 관절 상태가 안정적입니다. 스마트 보조기를 착용한 채로 가볍게 20초 스캔을 진행해 회복 데이터를 누적해 보세요.`;
}
