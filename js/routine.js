// 취침 전 안내 계산 (화면과 분리된 순수 함수). 시간은 "자정 기준 분(0~1439)".
import { mod, formatTime, DAY } from "./sleepMath.js";

// 안내 3단계. 바꾸고 싶으면 여기만 수정하세요. before = 취침 몇 분 전인지
export const ROUTINE_STEPS = [
  { id: "prepare", before: 30, title: "수면 준비 시작", desc: "조명을 낮추고 화면을 줄여 보세요." },
  { id: "sound", before: 10, title: "사운드 선택", desc: "잠들 때 들을 소리를 골라 두세요.", action: "sound" },
  { id: "ready", before: 0, title: "준비 완료", desc: "이제 누워서 쉬어요. 잘 자요." },
];

const AFTER_BED_KEEP = 120; // 취침 시간 이후 이 시간(분) 동안은 "준비 완료" 상태 유지

/** 취침까지 남은 분. 취침 시간이 지났으면(2시간 이내) 음수, 그 외에는 다음 취침까지의 분 */
export function minutesUntilBed(bedMin, nowMin) {
  const diff = mod(bedMin - nowMin);
  if (diff <= DAY / 2) return diff;
  if (DAY - diff <= AFTER_BED_KEEP) return diff - DAY;
  return diff;
}

/**
 * 지금 상태 계산.
 * 반환: { until, activeIndex, steps:[{...step, time, state}], nextStart }
 *  - activeIndex: 지금 진행 중인 단계(없으면 -1)
 *  - state: "done" | "active" | "upcoming"
 *  - nextStart: 첫 안내까지 남은 분(이미 시작했으면 0)
 */
export function routineStatus(bedMin, nowMin) {
  const until = minutesUntilBed(bedMin, nowMin);

  // 취침이 가까울수록 뒤 단계. before 값이 큰 단계부터 확인
  let activeIndex = -1;
  ROUTINE_STEPS.forEach((st, i) => {
    const reached = st.before === 0 ? until <= 0 : until <= st.before;
    if (reached) activeIndex = i; // 마지막으로 도달한 단계가 현재 단계
  });

  const steps = ROUTINE_STEPS.map((st, i) => ({
    ...st,
    time: formatTime(bedMin - st.before),
    state: i < activeIndex ? "done" : i === activeIndex ? "active" : "upcoming",
  }));

  const first = ROUTINE_STEPS[0].before;
  const nextStart = activeIndex >= 0 ? 0 : Math.max(0, until - first);
  return { until, activeIndex, steps, nextStart };
}

/** 현재 시각(분). 주소 뒤에 ?now=23:10 을 붙이면 그 시각으로 시험해 볼 수 있어요. */
export function nowMinutes() {
  try {
    const q = new URLSearchParams(location.search).get("now");
    const m = /^(\d{1,2}):(\d{2})$/.exec(q ?? "");
    if (m && Number(m[1]) < 24 && Number(m[2]) < 60) return Number(m[1]) * 60 + Number(m[2]);
  } catch {
    /* 무시 */
  }
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}
