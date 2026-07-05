# JOINTRUN Roadmap

> Movement Intelligence Platform — AI 기반 근골격계 디지털 헬스케어 플랫폼

이 로드맵은 개인 프로젝트가 아닌 **제품/스타트업 개발 이력**의 관점으로 관리됩니다.
투자자 및 향후 합류할 팀원이 프로젝트의 성숙도를 파악할 수 있도록 분기별 목표를 기록합니다.

---

## Phase 1 — MVP 안정화 (현재 ~ 2개월)

- [x] Camera + MediaPipe HandLandmarker 기반 모션 감지
- [x] Finger Score 기본 산출 로직
- [x] Firebase Auth 로그인 (데모 모드 폴백 포함)
- [x] Anthropic AI Coach 연동
- [ ] Finger Score 정확도 고도화
- [ ] Firebase 사용자 기록(History) 기능 강화
- [ ] 카메라 안정성 개선 (권한 처리, 기기 호환성)
- [ ] `v0.2.0` 릴리스

## Phase 2 — 분석 기능 확장 (2 ~ 4개월)

- [ ] ROM(관절 가동 범위, Range of Motion) 분석 엔진
- [ ] Risk Forecast (부상 위험 예측) 모듈
- [ ] 사용자 대시보드 고도화 (추이 시각화, Recharts 기반)
- [ ] ARO 보조기 연동
- [ ] `v0.5.0` 베타 릴리스

## Phase 3 — 정식 출시 준비 (4 ~ 8개월)

- [ ] 임상 데이터 기반 알고리즘 검증
- [ ] 전신 관절 확장 (손목, 어깨 등)
- [ ] 병원 관리자 대시보드
- [ ] 유료 구독(Subscription) 기능
- [ ] `v1.0.0` 정식 출시

---

## 분기별 개요

```
2026 Q3
  Finger Score 고도화 · ROM · History

2026 Q4
  ARO Integration · Premium

2027
  AI Prediction · Hospital Dashboard · Insurance API
```

---

## 참고

- 실제 코드베이스의 `package.json` 버전(`1.0.0`)과 위 단계별 버전 번호는
  현재 서로 다른 기준으로 매겨져 있습니다. 정식으로 SemVer 체계를 도입하려면
  `CONTRIBUTING.md`의 버전 관리 절차를 따라 재설정하는 것을 권장합니다.
- 세부 변경 이력은 [CHANGELOG.md](./CHANGELOG.md)를 참고하세요.
