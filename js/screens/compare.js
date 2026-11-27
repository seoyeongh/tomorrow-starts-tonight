import { getState, update } from "../store.js";
import { calcPlan, compareOptions, formatTime, formatDuration } from "../sleepMath.js";

// 기본 비교 선택지(분). 바꾸고 싶으면 여기 숫자만 수정하세요.
export const PRESETS = [360, 450, 540]; // 6시간, 7시간 30분, 9시간

const CUSTOM_MIN = 240; // 4시간
const CUSTOM_MAX = 720; // 12시간
const CUSTOM_STEP = 30;
const BAR_MAX = 720; // 막대 길이 기준(12시간)

const pad2 = (n) => String(n).padStart(2, "0");

export function renderCompare(root, ctx) {
  const s = getState();
  const plan = calcPlan(s);

  if (!plan.ok) {
    root.innerHTML = `
      <p class="brand">Tomorrow starts tonight.</p>
      <h2 class="section-label">수면 시간 비교</h2>
      <div class="empty">먼저 홈에서 내일 일정이나<br />기상 시간을 정해 주세요.</div>
      <div class="actions"><button class="btn btn-primary" data-act="home">홈으로 가기</button></div>`;
    root.querySelector('[data-act="home"]').onclick = () => ctx.go("home");
    return;
  }

  // 현재 선택 상태 정리: 6/7.5/9시간이 아니면 직접 선택 카드가 선택된 것으로 본다
  let { sleepMin, customMin, useCustom } = s;
  const presetMatch = PRESETS.includes(sleepMin);
  if (!presetMatch || (useCustom && customMin !== sleepMin)) {
    if (!presetMatch) {
      customMin = sleepMin;
      useCustom = true;
    } else {
      useCustom = false;
    }
    update({ customMin, useCustom });
  }
  const customSelected = useCustom && sleepMin === customMin;

  const options = compareOptions(plan.wake, plan.latency, PRESETS);
  const custom = compareOptions(plan.wake, plan.latency, [customMin])[0];
  const h = Math.floor(customMin / 60);
  const m = customMin % 60;

  root.innerHTML = `
    <p class="brand">Tomorrow starts tonight.</p>
    <h2 class="section-label">수면 시간 비교</h2>
    <p class="cmp-base">기상 <strong>${formatTime(plan.wake)}</strong> 기준${plan.driver && !s.useManualWake ? ` · ${escapeHtml(plan.driver.name)}` : ""}</p>

    <div class="cmp-list" role="radiogroup" aria-label="수면 시간 선택">
      ${options.map((o) => card(o, !customSelected && o.sleepMin === sleepMin, plan.latency)).join("")}

      <div class="cmp-card cmp-custom ${customSelected ? "is-selected" : ""}" data-custom role="radio" aria-checked="${customSelected}" tabindex="0">
        <div class="cmp-head">
          <span class="cmp-title">직접 선택 <span class="cmp-dur">${formatDuration(customMin)}</span></span>
          ${customSelected ? '<span class="cmp-check">✓ 선택됨</span>' : ""}
        </div>
        <div class="cmp-bed"><small>🌙 취침</small><strong>${formatTime(custom.bed)}</strong></div>
        ${bar(customMin)}
        <div class="cmp-custom-ctl">
          <button class="btn" data-act="c-dec" aria-label="30분 줄이기" ${customMin <= CUSTOM_MIN ? "disabled" : ""}>−</button>
          <label class="cmp-sel"><select class="input" id="c-h" aria-label="시간">
            ${range(4, 12).map((v) => `<option value="${v}" ${v === h ? "selected" : ""}>${v}시간</option>`).join("")}
          </select></label>
          <label class="cmp-sel"><select class="input" id="c-m" aria-label="분">
            ${range(0, 55, 5).map((v) => `<option value="${v}" ${v === m ? "selected" : ""}>${pad2(v)}분</option>`).join("")}
          </select></label>
          <button class="btn" data-act="c-inc" aria-label="30분 늘리기" ${customMin >= CUSTOM_MAX ? "disabled" : ""}>+</button>
        </div>
        <p class="cmp-note">4시간~12시간, 5분 단위로 정할 수 있어요.</p>
      </div>
    </div>

    <div class="actions">
      <button class="btn btn-primary" data-act="confirm">이 계획으로 정하기</button>
      <button class="btn btn-ghost" data-act="home">홈에서 시간 조정하기</button>
    </div>
  `;

  bindCompare(root, ctx, plan, customMin);
}

function card(o, selected, latency) {
  return `
    <button class="cmp-card ${selected ? "is-selected" : ""}" data-min="${o.sleepMin}" role="radio" aria-checked="${selected}">
      <div class="cmp-head">
        <span class="cmp-title">${formatDuration(o.sleepMin)}</span>
        ${selected ? '<span class="cmp-check">✓ 선택됨</span>' : ""}
      </div>
      <div class="cmp-bed"><small>🌙 취침</small><strong>${formatTime(o.bed)}</strong></div>
      ${bar(o.sleepMin)}
      <p class="cmp-note">수면 ${formatDuration(o.sleepMin)} 확보${latency ? ` · 잠드는 시간 ${latency}분 포함` : ""}</p>
    </button>`;
}

function bar(min) {
  const pct = Math.max(4, Math.min(100, Math.round((min / BAR_MAX) * 100)));
  return `<div class="cmp-bar" aria-hidden="true"><span style="width:${pct}%"></span></div>`;
}

function bindCompare(root, ctx, plan, customMin) {
  const rerender = () => renderCompare(root, ctx);

  root.querySelectorAll(".cmp-card[data-min]").forEach((el) => {
    el.onclick = () => {
      update({ sleepMin: Number(el.dataset.min), useCustom: false });
      rerender();
    };
  });

  const setCustom = (min) => {
    const v = Math.max(CUSTOM_MIN, Math.min(CUSTOM_MAX, Math.round(min)));
    update({ customMin: v, sleepMin: v, useCustom: true });
    rerender();
  };

  const customCard = root.querySelector("[data-custom]");
  customCard.onclick = (e) => {
    if (e.target.closest("button, select, label")) return; // 컨트롤 조작은 아래에서 처리
    setCustom(customMin);
  };
  customCard.onkeydown = (e) => {
    if (e.target === customCard && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      setCustom(customMin);
    }
  };

  root.querySelector('[data-act="c-dec"]').onclick = () => setCustom(customMin - CUSTOM_STEP);
  root.querySelector('[data-act="c-inc"]').onclick = () => setCustom(customMin + CUSTOM_STEP);

  const onSelect = () => {
    const hh = Number(root.querySelector("#c-h").value);
    const mm = Number(root.querySelector("#c-m").value);
    setCustom(hh * 60 + mm);
  };
  root.querySelector("#c-h").onchange = onSelect;
  root.querySelector("#c-m").onchange = onSelect;

  root.querySelector('[data-act="confirm"]').onclick = () => {
    const s = getState();
    const p = calcPlan(s);
    if (p.ok) update({ confirmed: { bed: p.bed, wake: p.wake, sleepMin: p.sleepMin } });
    ctx.go("home");
    // 홈은 맨 위부터 그려지므로, 정한 뒤에는 "취침 전 안내" 카드가 보이도록 내려 줌
    const card = p.ok && document.getElementById("routine");
    if (card) card.scrollIntoView({ behavior: "smooth", block: "center" });
  };
  root.querySelector('[data-act="home"]').onclick = () => ctx.go("home");
}

function range(from, to, step = 1) {
  const out = [];
  for (let v = from; v <= to; v += step) out.push(v);
  return out;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
