import { SUBJECTS } from "/config/subjects.js";

const $ = (id) => document.getElementById(id);

function getPreferredTheme() {
  try {
    const stored = localStorage.getItem("theme");
    if (stored === "dark" || stored === "light") return stored;
  } catch {
    // ignore
  }
  try {
    return window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  } catch {
    return "dark";
  }
}

function applyTheme(theme) {
  const t = theme === "light" ? "light" : "dark";
  document.documentElement.dataset.theme = t;
  try {
    localStorage.setItem("theme", t);
  } catch {
    // ignore
  }
  const icon = $("themeToggleIcon");
  const text = $("themeToggleText");
  if (icon) {
    icon.innerHTML =
      t === "dark"
        ? `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M21 12.8A8.5 8.5 0 0 1 11.2 3a7 7 0 1 0 9.8 9.8Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`
        : `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z" stroke="currentColor" stroke-width="1.8"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
  }
  if (text) text.textContent = t === "dark" ? "다크" : "라이트";
}

function setupThemeToggle() {
  const btn = $("themeToggle");
  if (!btn) return;
  applyTheme(getPreferredTheme());
  btn.addEventListener("click", () => {
    const next =
      document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(next);
  });
}

function createCard(subject) {
  const a = document.createElement("a");
  a.className = "subjectCard";
  a.href = `/subjects/${encodeURIComponent(subject.slug)}/`;
  a.setAttribute("role", "listitem");
  a.setAttribute("aria-label", `${subject.name} 다운로드로 이동`);

  const icon = document.createElement("div");
  icon.className = "subjectCardIcon";
  icon.innerHTML = subject.iconSvg || "";

  const meta = document.createElement("div");
  meta.className = "subjectCardMeta";

  const titleRow = document.createElement("div");
  titleRow.className = "subjectCardTitleRow";

  const h = document.createElement("div");
  h.className = "subjectCardTitle";
  h.textContent = subject.name;

  const arrow = document.createElement("span");
  arrow.className = "subjectCardArrow";
  arrow.setAttribute("aria-hidden", "true");
  arrow.innerHTML = `<svg viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  titleRow.appendChild(h);
  titleRow.appendChild(arrow);

  const one = document.createElement("div");
  one.className = "subjectCardDesc";
  one.textContent = subject.oneLiner || "";

  meta.appendChild(titleRow);
  meta.appendChild(one);

  a.appendChild(icon);
  a.appendChild(meta);

  return a;
}

function render() {
  const grid = $("subjectsGrid");
  if (!grid) return;
  while (grid.firstChild) grid.removeChild(grid.firstChild);
  for (const s of SUBJECTS) grid.appendChild(createCard(s));
}

setupThemeToggle();
render();


