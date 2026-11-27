// 24시간 원형 시간표 (보기 전용). 자정이 맨 위, 시계 방향으로 흐릅니다.
// 취침~기상 구간을 금색 호로 보여 주고, 시간을 바꾸는 조작은 휠 피커(wheel.js)에서 합니다.
// 아래의 순수 계산 함수(applyDrag 등)는 휠 피커의 입력 처리에도 그대로 씁니다.
import { DAY, mod, calcBed, formatTime } from "./sleepMath.js";

export const SLEEP_MIN = 240; // 4시간
export const SLEEP_MAX = 720; // 12시간

const CX = 100, CY = 100, R = 70;

/* ---------- 순수 계산 (화면 없이 테스트 가능) ---------- */

/** 화면 좌표 -> 자정 기준 분(5분 단위). 중심에서 위쪽이 0시 */
export function minuteFromPoint(dx, dy) {
  let deg = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
  deg = (deg + 360) % 360;
  return mod(Math.round(((deg / 360) * DAY) / 5) * 5);
}

/** 취침 시각을 bedMin으로 바꿨을 때의 수면 시간(분). 4~12시간 범위로 제한 */
export function sleepFromBed(bedMin, wake, latency) {
  const span = mod(wake - bedMin);
  const raw = span - latency;
  if (raw < SLEEP_MIN) return SLEEP_MIN;
  if (raw > SLEEP_MAX) {
    const mid = (SLEEP_MAX + SLEEP_MIN + DAY) / 2; // 반대편으로 넘어가는 경계
    return raw < mid ? SLEEP_MAX : SLEEP_MIN;
  }
  return raw;
}

/** 취침 또는 기상 시각을 바꿨을 때의 결과. 반환: { bed, wake, sleepMin } */
export function applyDrag(which, minute, cur) {
  if (which === "wake") {
    const wake = mod(minute);
    return { wake, sleepMin: cur.sleepMin, bed: calcBed(wake, cur.sleepMin, cur.latency) };
  }
  const sleepMin = sleepFromBed(minute, cur.wake, cur.latency);
  return { wake: cur.wake, sleepMin, bed: calcBed(cur.wake, sleepMin, cur.latency) };
}

/* ---------- 그리기 ---------- */

const pt = (min, r = R) => {
  const a = (min / DAY) * 2 * Math.PI - Math.PI / 2;
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
};
const f = (n) => n.toFixed(2);

function arcPath(bed, wake) {
  const [x1, y1] = pt(bed);
  const [x2, y2] = pt(wake);
  const span = mod(wake - bed) || DAY;
  const large = span > DAY / 2 ? 1 : 0;
  return `M ${f(x1)} ${f(y1)} A ${R} ${R} 0 ${large} 1 ${f(x2)} ${f(y2)}`;
}

export function dialSvg(plan) {
  const [bx, by] = pt(plan.bed);
  const [wx, wy] = pt(plan.wake);

  // 3시간마다 눈금과 숫자 (0, 3, 6, ... 21)
  let ticks = "";
  for (let h = 0; h < 24; h += 1) {
    const m = h * 60;
    const major = h % 3 === 0;
    const [x1, y1] = pt(m, R + 11);
    const [x2, y2] = pt(m, R + (major ? 17 : 14));
    ticks += `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="var(--ivory-faint)" stroke-width="${major ? 1.4 : 0.8}" opacity="${major ? 0.9 : 0.5}"/>`;
    if (major) {
      const [tx, ty] = pt(m, R + 25);
      ticks += `<text x="${f(tx)}" y="${f(ty + 3)}" text-anchor="middle" font-size="9" fill="var(--ivory-dim)">${h}</text>`;
    }
  }

  return `<svg viewBox="0 0 200 200" role="img"
      aria-label="24시간 시간표. 취침 ${formatTime(plan.bed)}부터 기상 ${formatTime(plan.wake)}까지">
    <circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="var(--card-line)" stroke-width="14"/>
    ${ticks}
    <path d="${arcPath(plan.bed, plan.wake)}" fill="none" stroke="var(--gold)" stroke-width="14" stroke-linecap="butt"/>
    <circle cx="${f(bx)}" cy="${f(by)}" r="11" fill="var(--bg)" stroke="var(--gold)" stroke-width="3"/>
    <text x="${f(bx)}" y="${f(by + 4)}" text-anchor="middle" font-size="11">🌙</text>
    <circle cx="${f(wx)}" cy="${f(wy)}" r="11" fill="var(--gold)"/>
    <text x="${f(wx)}" y="${f(wy + 4)}" text-anchor="middle" font-size="11">☀</text>
  </svg>`;
}
