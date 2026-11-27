// 수면 계산 로직 (화면과 완전히 분리된 순수 함수들)
// 시간은 "자정 기준 분(0~1439)"으로 다룹니다.

export const DAY = 1440;

export const mod = (m) => ((m % DAY) + DAY) % DAY;

/** "HH:MM" -> 분. 형식이 틀리면 null */
export function parseTime(str) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(str ?? "").trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h > 23 || mi > 59) return null;
  return h * 60 + mi;
}

/** 분 -> "HH:MM" (자정을 넘어가도 0~24시로 환산) */
export function formatTime(min) {
  const v = mod(Math.round(min));
  const h = String(Math.floor(v / 60)).padStart(2, "0");
  const m = String(v % 60).padStart(2, "0");
  return `${h}:${m}`;
}

/** 분 -> "7시간 30분" */
export function formatDuration(min) {
  const total = Math.max(0, Math.round(min));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h && m) return `${h}시간 ${m}분`;
  if (h) return `${h}시간`;
  return `${m}분`;
}

/** 일정 하나가 요구하는 기상 시간(분). 자정 이전으로 넘어가면 음수가 될 수 있음 */
export function wakeFor(schedule) {
  const start = parseTime(schedule.start);
  if (start === null) return null;
  return start - toInt(schedule.prep) - toInt(schedule.travel);
}

/** 여러 일정 중 가장 이른 기상 시간을 요구하는 일정 */
export function earliestSchedule(schedules) {
  let best = null;
  let bestWake = Infinity;
  for (const s of schedules) {
    const w = wakeFor(s);
    if (w !== null && w < bestWake) {
      best = s;
      bestWake = w;
    }
  }
  return best;
}

/** 기상 시간 - 목표 수면 시간 - 잠드는 데 걸리는 시간 = 취침 시간 */
export function calcBed(wakeMin, sleepMin, latencyMin = 0) {
  return mod(wakeMin - sleepMin - latencyMin);
}

/**
 * 전체 계획 계산.
 * state: { schedules, useManualWake, manualWake, sleepMin, latency }
 * 반환: { ok, wake, bed, sleepMin, latency, driver } 또는 { ok:false }
 */
export function calcPlan(state) {
  const sleepMin = toInt(state.sleepMin);
  const latency = toInt(state.latency);
  let wake = null;
  let driver = null;

  if (state.useManualWake || !state.schedules.length) {
    wake = parseTime(state.manualWake);
  } else {
    driver = earliestSchedule(state.schedules);
    if (driver) wake = mod(wakeFor(driver));
  }

  if (wake === null) return { ok: false };
  return { ok: true, wake, bed: calcBed(wake, sleepMin, latency), sleepMin, latency, driver };
}

function toInt(v) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n > 0 ? n : 0;
}
