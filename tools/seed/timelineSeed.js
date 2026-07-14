#!/usr/bin/env node
// tools/seed/timelineSeed.js — 작업지시서 STEP 3용 로컬 시각 QA 시드 스크립트.
//
// Firestore 콘솔에 하나씩 수동 입력하는 대신, scans/events를 한 번에 채워
// TIMELINE 병합 뷰 + Decision Log 전후 비교 그래프를 실제 데이터로 확인할 수 있게 한다.
//
// 이 저장소엔 로컬 Firebase 프로젝트가 없어(.env 없음) 이 스크립트 자체를 이 환경에서
// 실행해 검증하지는 못했다 — 실제 Firebase 프로젝트가 있는 환경에서 아래처럼 실행한다:
//
//   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json \
//   SEED_UID=<대상 사용자 uid> \
//   npm run seed
//
// firebase-admin은 보안 규칙을 우회하므로 서비스 계정 키가 필요하다 — 프로덕션 프로젝트에는
// 절대 실행하지 말 것.

import admin from "firebase-admin";

const uid = process.env.SEED_UID;
if (!uid) {
  console.error("SEED_UID 환경변수가 필요합니다. 예: SEED_UID=abc123 npm run seed");
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.applicationDefault() });
const db = admin.firestore();

const DAY_MS = 24 * 60 * 60 * 1000;
const now = Date.now();
const daysAgo = (n) => admin.firestore.Timestamp.fromMillis(now - n * DAY_MS);

// 최근 30일에 걸쳐 완만한 하락 추세(declining 패턴 판정 재현용) + 등락(volatile 재현용 구간 포함).
const SCAN_SCORES = [
  { days: 28, total: 78 }, { days: 24, total: 76 }, { days: 20, total: 74 },
  { days: 16, total: 72 }, { days: 12, total: 68 }, { days: 8, total: 63 },
  { days: 4, total: 60 }, { days: 1, total: 58 },
];

const EVENTS = [
  { days: 26, type: "protector_start", label: "보호대 착용 시작" },
  { days: 18, type: "hospital_visit", label: "병원 방문" },
  { days: 10, type: "exercise_start", label: "운동 시작" },
  { days: 3, type: "paraffin_start", label: "파라핀·찜질 시작" },
];

async function seed() {
  const batch = db.batch();

  for (const s of SCAN_SCORES) {
    const ref = db.collection("users").doc(uid).collection("scans").doc();
    batch.set(ref, {
      schemaVersion: "v1.0",
      metrics: { painIndex: Math.max(1, Math.round((100 - s.total) / 10)), stiffnessMin: Math.max(5, 100 - s.total) },
      scores: {
        total: s.total,
        mobility: { value: s.total, reason: "seed" },
        stability: { value: s.total - 5, reason: "seed" },
      },
      recommendation: "",
      createdAt: daysAgo(s.days),
    });
  }

  for (const e of EVENTS) {
    const ref = db.collection("users").doc(uid).collection("events").doc();
    batch.set(ref, {
      type: e.type,
      label: e.label,
      memo: null,
      timestamp: daysAgo(e.days),
      schemaVersion: "v1.0",
      createdAt: daysAgo(e.days),
    });
  }

  await batch.commit();
  console.log(`시드 완료: scans ${SCAN_SCORES.length}건, events ${EVENTS.length}건 → users/${uid}`);
}

seed().catch((err) => {
  console.error("시드 실패:", err);
  process.exit(1);
});
