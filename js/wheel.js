// 휠 피커: 위아래로 돌려서 값을 고르는 스크롤 선택기 (iOS 알람/시계 앱과 비슷한 방식)
// 브라우저의 scroll-snap을 사용해서 터치·마우스 휠·키보드가 모두 자연스럽게 동작합니다.

export const ITEM_H = 40; // css의 --wheel-item 과 같아야 함
const VISIBLE_PAD = 1; // 선택 칸 위아래로 보이는 칸 수

/**
 * el: 휠을 넣을 빈 요소
 * opts: { items: string[], index, label, onSettle(index) }
 * 반환: { setIndex(i), getIndex() }
 */
export function createWheel(el, { items, index = 0, label = "", onSettle }) {
  el.classList.add("wheel");
  el.innerHTML = `<div class="wheel-list" tabindex="0" role="listbox" aria-label="${label}">
      ${'<div class="wheel-pad" aria-hidden="true"></div>'.repeat(VISIBLE_PAD)}
      ${items.map((t, i) => `<div class="wheel-item" role="option" data-i="${i}">${t}</div>`).join("")}
      ${'<div class="wheel-pad" aria-hidden="true"></div>'.repeat(VISIBLE_PAD)}
    </div>`;

  const list = el.querySelector(".wheel-list");
  const nodes = [...list.querySelectorAll(".wheel-item")];
  let current = clamp(index);
  let timer = null;
  let raf = 0;

  const toIndex = () => clamp(Math.round(list.scrollTop / ITEM_H));

  function mark(i) {
    nodes.forEach((n, k) => {
      const on = k === i;
      n.classList.toggle("is-sel", on);
      n.setAttribute("aria-selected", on ? "true" : "false");
    });
  }

  function goTo(i, smooth) {
    list.scrollTo({ top: clamp(i) * ITEM_H, behavior: smooth ? "smooth" : "auto" });
  }

  list.addEventListener("scroll", () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => mark(toIndex()));
    clearTimeout(timer);
    timer = setTimeout(settle, 140); // 멈춘 뒤에 값 확정
  });

  function settle() {
    const i = toIndex();
    mark(i);
    if (i !== current) {
      current = i;
      onSettle && onSettle(i);
    }
  }

  nodes.forEach((n, i) => n.addEventListener("click", () => goTo(i, true)));

  list.addEventListener("keydown", (e) => {
    if (e.key === "ArrowUp") { e.preventDefault(); goTo(toIndex() - 1, true); }
    if (e.key === "ArrowDown") { e.preventDefault(); goTo(toIndex() + 1, true); }
  });

  function clamp(i) {
    return Math.max(0, Math.min(items.length - 1, i));
  }

  mark(current);
  // 요소가 화면에 붙은 뒤에 위치를 맞춰야 하므로 한 프레임 기다림
  goTo(current, false);
  requestAnimationFrame(() => goTo(current, false));

  return {
    getIndex: () => current,
    setIndex(i) {
      current = clamp(i);
      mark(current);
      goTo(current, false);
    },
  };
}
