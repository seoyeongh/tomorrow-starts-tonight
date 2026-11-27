import { renderHome } from "./screens/home.js";
import { renderCompare } from "./screens/compare.js";
import { renderPlaceholder } from "./screens/placeholder.js";

const screen = document.getElementById("screen");
const tabs = [...document.querySelectorAll(".tab")];

const SCREENS = {
  home: () => renderHome(screen, { go }),
  compare: () => renderCompare(screen, { go }),
  sound: () => renderPlaceholder(screen, "수면 사운드", "빗소리, 파도, 바람 등을 섞어 재생할 수 있어요.", "다음 단계에서 구현됩니다"),
  log: () => renderPlaceholder(screen, "아침 컨디션 기록", "일어난 뒤 컨디션을 1~5점으로 남겨요.", "다음 단계에서 구현됩니다"),
};

let current = "home";

export function go(tab) {
  if (!SCREENS[tab]) tab = "home";
  current = tab;
  tabs.forEach((t) => {
    if (t.dataset.tab === tab) t.setAttribute("aria-current", "page");
    else t.removeAttribute("aria-current");
  });
  SCREENS[tab]();
  window.scrollTo(0, 0);
}

tabs.forEach((t) => t.addEventListener("click", () => go(t.dataset.tab)));

go(current);
