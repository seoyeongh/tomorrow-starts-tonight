// localStorage 저장소. 저장이 막혀 있어도(사생활 보호 모드 등) 앱이 멈추지 않습니다.
const KEY = "tst.v1";

const DEFAULTS = {
  schedules: [], // { id, name, start:"HH:MM", prep, travel }
  useManualWake: false,
  manualWake: "07:00",
  sleepMin: 450, // 목표 수면 시간 (7시간 30분)
  latency: 15, // 잠드는 데 걸리는 시간
  customMin: 480, // 비교 탭의 "직접 선택" 값 (8시간)
  useCustom: false, // 직접 선택 카드가 선택된 상태인지
  confirmed: null, // { bed, wake, sleepMin } 사용자가 "정하기"를 누른 계획
};

let state = load();
const listeners = new Set();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULTS, ...(parsed && typeof parsed === "object" ? parsed : {}) };
  } catch {
    return { ...DEFAULTS };
  }
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* 저장 실패는 무시: 현재 세션에서는 계속 동작 */
  }
}

export const getState = () => state;

export function update(patch) {
  state = { ...state, ...patch };
  persist();
  listeners.forEach((fn) => fn(state));
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
