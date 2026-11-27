import { getState, update } from "../store.js";
import { calcPlan, wakeFor, formatTime, formatDuration, parseTime } from "../sleepMath.js";
import { dialSvg, applyDrag } from "../dial.js";
import { createWheel } from "../wheel.js";
import { routineStatus, nowMinutes } from "../routine.js";

let flash = ""; // 다음 화면에 한 번만 보여 줄 안내 문구

const SLEEP_MIN = 240; // 4시간
const SLEEP_MAX = 720; // 12시간
const SLEEP_STEP = 30;
const LATENCY_OPTIONS = [0, 10, 15, 20, 30];

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function renderHome(root, ctx) {
  const note = flash;
  flash = "";
  const s = getState();
  const plan = calcPlan(s);
  const manualMode = s.useManualWake || !s.schedules.length;

  root.innerHTML = `
    <p class="brand">Tomorrow starts tonight.</p>

    <h2 class="section-label">내일</h2>
    ${scheduleSection(s, plan, manualMode)}

    <div class="link-line"><span>내일 일정에 맞춰</span></div>

    <h2 class="section-label">오늘 밤의 수면 계획</h2>
    <section class="card plan">
      ${plan.ok ? planBody(plan, note) : `<p class="muted">기상 시간을 입력하면 계획이 만들어져요.</p>`}
      <div class="stepper" role="group" aria-label="목표 수면 시간">
        <button class="btn" data-act="sleep-dec" aria-label="수면 시간 30분 줄이기" ${s.sleepMin <= SLEEP_MIN ? "disabled" : ""}>−</button>
        <div class="stepper-val"><small>목표 수면 시간</small><strong>${formatDuration(s.sleepMin)}</strong></div>
        <button class="btn" data-act="sleep-inc" aria-label="수면 시간 30분 늘리기" ${s.sleepMin >= SLEEP_MAX ? "disabled" : ""}>+</button>
      </div>
      <label class="field" style="margin-bottom:0">
        <span>잠드는 데 걸리는 시간</span>
        <select class="input" id="latency">
          ${LATENCY_OPTIONS.map((v) => `<option value="${v}" ${v === s.latency ? "selected" : ""}>${v === 0 ? "고려하지 않음" : v + "분"}</option>`).join("")}
        </select>
      </label>
    </section>

    <div class="actions">
      <button class="btn btn-primary" data-act="confirm" ${plan.ok ? "" : "disabled"}>이 계획으로 정하기</button>
      <button class="btn" data-act="compare">다른 수면 시간 비교</button>
      ${s.confirmed ? `<p class="plan-note" style="text-align:center">✓ 정해진 계획: ${formatTime(s.confirmed.bed)} 취침 → ${formatTime(s.confirmed.wake)} 기상</p>` : ""}
    </div>

    ${s.confirmed ? `<h2 class="section-label" style="margin-top:var(--space-4)">취침 전 안내</h2><section class="card routine" id="routine"></section>` : ""}
  `;

  bindHome(root, ctx, s, plan);
  startRoutine(root, ctx, s);
}

/* ---------- 취침 전 안내 (정해진 계획의 취침 시간 기준) ---------- */
let routineTimer = null;

function routineHtml(bed) {
  const r = routineStatus(bed, nowMinutes());
  const head =
    r.activeIndex === 2
      ? "지금은 취침 시간이에요"
      : r.activeIndex >= 0
        ? `취침까지 ${formatDuration(Math.max(0, r.until))} 남았어요`
        : r.nextStart <= 720
          ? `${formatDuration(r.nextStart)} 뒤에 안내가 시작돼요`
          : "취침 시간이 가까워지면 안내해 드려요";
  return `
    <p class="routine-head">${head}</p>
    <ol class="routine-list">
      ${r.steps
        .map(
          (st) => `
        <li class="routine-step is-${st.state}" ${st.state === "active" ? 'aria-current="step"' : ""}>
          <span class="routine-dot" aria-hidden="true">${st.state === "done" ? "✓" : ""}</span>
          <div class="routine-body">
            <div class="routine-top"><strong>${st.title}</strong><span class="routine-time">${st.time}</span></div>
            <p>${st.before ? `${st.before}분 전 · ` : "취침 시간 · "}${st.desc}</p>
            ${st.action && st.state === "active" ? `<button class="btn btn-primary routine-go" data-routine-go="${st.action}">사운드 고르러 가기</button>` : ""}
          </div>
        </li>`
        )
        .join("")}
    </ol>`;
}

function startRoutine(root, ctx, s) {
  clearInterval(routineTimer);
  routineTimer = null;
  const box = root.querySelector("#routine");
  if (!box || !s.confirmed) return;

  const draw = () => {
    box.innerHTML = routineHtml(s.confirmed.bed);
    const go = box.querySelector("[data-routine-go]");
    if (go) go.onclick = () => ctx.go(go.dataset.routineGo);
  };
  draw();
  // 30초마다 카드만 갱신. 카드가 화면에서 사라지면 타이머도 멈춤
  routineTimer = setInterval(() => {
    if (!box.isConnected) {
      clearInterval(routineTimer);
      routineTimer = null;
      return;
    }
    draw();
  }, 30000);
}

function scheduleSection(s, plan, manualMode) {
  const driverId = plan.ok && plan.driver ? plan.driver.id : null;
  const list = s.schedules.length
    ? `<div class="sched-list">${s.schedules
        .map((sc) => {
          const w = wakeFor(sc);
          return `
          <button class="sched ${sc.id === driverId && !manualMode ? "is-earliest" : ""}" data-edit="${esc(sc.id)}">
            <div class="sched-top">
              <span class="sched-name">${esc(sc.name)}${sc.id === driverId && !manualMode && s.schedules.length > 1 ? '<span class="badge">가장 이른 일정</span>' : ""}</span>
              <span class="sched-time">${esc(sc.start)}</span>
            </div>
            <div class="sched-sub">준비 ${sc.prep}분 · 이동 ${sc.travel}분${w !== null ? ` · 기상 ${formatTime(w)}` : ""}</div>
          </button>`;
        })
        .join("")}</div>`
    : `<div class="empty">내일 일정을 추가하면<br />기상 시간과 취침 시간을 계산해 드려요.</div>`;

  const manual = s.schedules.length
    ? `<label class="field manual-wake" style="margin-bottom:0">
         <span><input type="checkbox" id="use-manual" ${s.useManualWake ? "checked" : ""} /> 일정과 상관없이 기상 시간 직접 설정</span>
       </label>`
    : "";

  const manualInput = manualMode
    ? `<label class="field manual-wake" style="margin-bottom:0">
         <span>기상 시간</span>
         <input class="input" type="time" id="manual-wake" value="${esc(s.manualWake)}" />
       </label>`
    : "";

  return `
    <div class="stack">
      ${list}
      <button class="btn" data-act="add">＋ 일정 추가</button>
      ${manual}
      ${manualInput}
    </div>`;
}

function planBody(plan, note) {
  return `
    <div class="ring-wrap">
      ${dialSvg(plan)}
      <div class="ring-center">
        <span class="ring-dur" id="d-dur">${formatDuration(plan.sleepMin)}</span>
        <span class="ring-sub">${formatTime(plan.bed)} → ${formatTime(plan.wake)}</span>
      </div>
    </div>
    <div class="wheels">
      <div class="wheel-group" role="group" aria-label="취침 시간">
        <small>🌙 취침</small>
        <div class="wheel-pair"><div id="w-bed-h"></div><span class="colon">:</span><div id="w-bed-m"></div></div>
      </div>
      <span class="time-arrow" aria-hidden="true">→</span>
      <div class="wheel-group" role="group" aria-label="기상 시간">
        <small>☀ 기상</small>
        <div class="wheel-pair"><div id="w-wake-h"></div><span class="colon">:</span><div id="w-wake-m"></div></div>
      </div>
    </div>
    ${note ? `<p class="plan-note plan-flash">${note}</p>` : ""}
    <p class="plan-note">${plan.latency ? `잠드는 데 ${plan.latency}분 걸리는 것까지 반영했어요.` : "잠드는 시간은 반영하지 않았어요."}</p>`;
}

function bindHome(root, ctx, s, plan) {
  root.querySelector('[data-act="add"]').onclick = () => openSheet(root, ctx, null);
  root.querySelectorAll("[data-edit]").forEach((el) => {
    el.onclick = () => openSheet(root, ctx, el.dataset.edit);
  });

  const dec = root.querySelector('[data-act="sleep-dec"]');
  const inc = root.querySelector('[data-act="sleep-inc"]');
  dec.onclick = () => change(root, ctx, { sleepMin: Math.max(SLEEP_MIN, s.sleepMin - SLEEP_STEP) });
  inc.onclick = () => change(root, ctx, { sleepMin: Math.min(SLEEP_MAX, s.sleepMin + SLEEP_STEP) });

  root.querySelector("#latency").onchange = (e) => change(root, ctx, { latency: Number(e.target.value) });

  const useManual = root.querySelector("#use-manual");
  if (useManual) useManual.onchange = (e) => change(root, ctx, { useManualWake: e.target.checked });

  const manualWake = root.querySelector("#manual-wake");
  if (manualWake)
    manualWake.onchange = (e) => {
      if (parseTime(e.target.value) !== null) change(root, ctx, { manualWake: e.target.value });
    };

  bindHomeWheels(root, ctx, plan);

  root.querySelector('[data-act="compare"]').onclick = () => ctx.go("compare");
  root.querySelector('[data-act="confirm"]').onclick = () => {
    if (plan.ok) change(root, ctx, { confirmed: { bed: plan.bed, wake: plan.wake, sleepMin: plan.sleepMin } });
  };
}

// 휠 피커: 멈추면 값을 확정해서 저장하고 화면을 다시 그립니다.
const pad2 = (n) => String(n).padStart(2, "0");
const HOURS = Array.from({ length: 24 }, (_, i) => pad2(i));
const MINUTES = Array.from({ length: 60 }, (_, i) => pad2(i));

function bindHomeWheels(root, ctx, plan) {
  if (!plan.ok || !root.querySelector("#w-bed-h")) return;

  const cur = { bed: plan.bed, wake: plan.wake, sleepMin: plan.sleepMin, latency: plan.latency };
  const make = (which, value) => {
    const h = Math.floor(value / 60), m = value % 60;
    const name = which === "bed" ? "취침" : "기상";
    const wh = createWheel(root.querySelector(`#w-${which}-h`), { items: HOURS, index: h, label: `${name} 시`, onSettle: () => commit() });
    const wm = createWheel(root.querySelector(`#w-${which}-m`), { items: MINUTES, index: m, label: `${name} 분`, onSettle: () => commit() });
    const commit = () => {
      const minute = wh.getIndex() * 60 + wm.getIndex();
      if (minute === cur[which]) return;
      const n = applyDrag(which, minute, cur);
      if (which === "bed") {
        if (n.bed !== minute) flash = "수면 시간은 4시간~12시간 사이로 맞춰져요.";
        change(root, ctx, { sleepMin: n.sleepMin });
      } else {
        change(root, ctx, { useManualWake: true, manualWake: formatTime(n.wake) });
      }
    };
  };
  make("bed", plan.bed);
  make("wake", plan.wake);
}

function change(root, ctx, patch) {
  update(patch);
  renderHome(root, ctx);
}

/* ---------- 일정 편집 시트 ---------- */
function openSheet(root, ctx, id) {
  const s = getState();
  const existing = id ? s.schedules.find((x) => x.id === id) : null;
  const data = existing || { name: "", start: "09:00", prep: 60, travel: 30 };

  const sheet = document.getElementById("sheet");
  const backdrop = document.getElementById("sheet-backdrop");

  sheet.innerHTML = `
    <h2 id="sheet-title">${existing ? "일정 수정" : "내일 일정 추가"}</h2>
    <form id="sched-form" novalidate>
      <label class="field"><span>일정 이름</span>
        <input class="input" name="name" maxlength="30" placeholder="예: 친구와 약속" value="${esc(data.name)}" /></label>
      <label class="field"><span>일정 시작 시간</span>
        <input class="input" name="start" type="time" required value="${esc(data.start)}" /></label>
      <div class="row">
        <label class="field"><span>준비 시간 (분)</span>
          <input class="input" name="prep" type="number" inputmode="numeric" min="0" max="600" step="5" value="${data.prep}" /></label>
        <label class="field"><span>이동 시간 (분)</span>
          <input class="input" name="travel" type="number" inputmode="numeric" min="0" max="600" step="5" value="${data.travel}" /></label>
      </div>
      <p class="error" id="sheet-error" hidden></p>
      <div class="actions" style="margin-top:0">
        <button class="btn btn-primary" type="submit">${existing ? "저장" : "추가"}</button>
        ${existing ? '<button class="btn btn-danger" type="button" id="sheet-del">이 일정 삭제</button>' : ""}
        <button class="btn btn-ghost" type="button" id="sheet-cancel">취소</button>
      </div>
    </form>`;

  const close = () => {
    sheet.hidden = true;
    backdrop.hidden = true;
    document.removeEventListener("keydown", onKey);
  };
  const onKey = (e) => e.key === "Escape" && close();
  document.addEventListener("keydown", onKey);

  sheet.hidden = false;
  backdrop.hidden = false;
  backdrop.onclick = close;
  sheet.querySelector("#sheet-cancel").onclick = close;

  const del = sheet.querySelector("#sheet-del");
  if (del)
    del.onclick = () => {
      close();
      change(root, ctx, { schedules: s.schedules.filter((x) => x.id !== id) });
    };

  sheet.querySelector("#sched-form").onsubmit = (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const err = sheet.querySelector("#sheet-error");
    const start = String(f.get("start"));
    const prep = clampMin(f.get("prep"));
    const travel = clampMin(f.get("travel"));

    if (parseTime(start) === null) {
      err.textContent = "일정 시작 시간을 입력해 주세요.";
      err.hidden = false;
      return;
    }
    const item = {
      id: existing ? existing.id : String(Date.now()),
      name: String(f.get("name")).trim() || "내일 일정",
      start,
      prep,
      travel,
    };
    const schedules = existing
      ? s.schedules.map((x) => (x.id === id ? item : x))
      : [...s.schedules, item];
    close();
    change(root, ctx, { schedules, useManualWake: false });
  };

  sheet.querySelector('input[name="name"]').focus();
}

function clampMin(v) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, 600);
}
