// 실행: node tests/routine.test.mjs
import assert from "node:assert/strict";
import { routineStatus, minutesUntilBed, ROUTINE_STEPS } from "../js/routine.js";

const t = (h, m = 0) => h * 60 + m;
let pass = 0;
const check = (name, fn) => {
  try { fn(); pass++; console.log("PASS", name); }
  catch (e) { console.log("FAIL", name, "-", e.message); process.exitCode = 1; }
};
const bed = t(23, 30);

check("단계 3개, 30/10/0분 전", () => assert.deepEqual(ROUTINE_STEPS.map((s) => s.before), [30, 10, 0]));
check("단계 시각 계산 23:00 / 23:20 / 23:30", () =>
  assert.deepEqual(routineStatus(bed, t(20)).steps.map((s) => s.time), ["23:00", "23:20", "23:30"]));
check("21:00(취침 150분 전): 진행 단계 없음, 첫 안내까지 120분", () => {
  const r = routineStatus(bed, t(21));
  assert.equal(r.activeIndex, -1); assert.equal(r.nextStart, 120);
  assert.ok(r.steps.every((s) => s.state === "upcoming"));
});
check("30분 전 정각: 1단계 시작", () => assert.equal(routineStatus(bed, t(23, 0)).activeIndex, 0));
check("31분 전: 아직 시작 전", () => assert.equal(routineStatus(bed, t(22, 59)).activeIndex, -1));
check("20분 전: 1단계 진행", () => assert.equal(routineStatus(bed, t(23, 10)).activeIndex, 0));
check("10분 전 정각: 2단계, 1단계는 done", () => {
  const r = routineStatus(bed, t(23, 20));
  assert.equal(r.activeIndex, 1); assert.equal(r.steps[0].state, "done"); assert.equal(r.steps[2].state, "upcoming");
});
check("취침 시간 정각: 3단계", () => assert.equal(routineStatus(bed, t(23, 30)).activeIndex, 2));
check("취침 1시간 뒤에도 3단계 유지", () => assert.equal(routineStatus(bed, t(0, 30)).activeIndex, 2));
check("취침 2시간 지나면 다시 대기 상태", () => assert.equal(routineStatus(bed, t(1, 31)).activeIndex, -1));
check("자정 넘는 취침(00:10), 전날 23:50(20분 전)은 1단계", () => assert.equal(routineStatus(t(0, 10), t(23, 50)).activeIndex, 0));
check("자정 넘는 취침(00:10), 00:00(10분 전)은 2단계", () => assert.equal(routineStatus(t(0, 10), t(0, 0)).activeIndex, 1));
check("자정 넘는 취침(00:10), 23:40은 1단계", () => assert.equal(routineStatus(t(0, 10), t(23, 40)).activeIndex, 0));
check("취침 00:10 단계 시각 23:40 / 00:00 / 00:10", () =>
  assert.deepEqual(routineStatus(t(0, 10), t(12)).steps.map((s) => s.time), ["23:40", "00:00", "00:10"]));
check("minutesUntilBed 지난 경우 음수", () => assert.equal(minutesUntilBed(bed, t(23, 45)), -15));
check("90분 주기 같은 계산 없음: 단계 수 3", () => assert.equal(routineStatus(bed, t(23, 5)).steps.length, 3));

console.log(`\n${pass}개 통과`);
