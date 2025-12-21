import { findSubjectBySlug } from "/config/subjects.js";

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

function getSlugFromPathname() {
  const p = String(location.pathname || "");
  const parts = p.split("/").filter(Boolean);
  const idx = parts.indexOf("subjects");
  const slug = idx >= 0 ? parts[idx + 1] : "";
  return String(slug || "").trim();
}

function renderResourceItem(res) {
  const card = document.createElement("div");
  card.className = "resourceCard";

  const title = document.createElement("div");
  title.className = "resourceTitle";
  title.textContent = res.title || "자료";

  const note = document.createElement("div");
  note.className = "resourceNote";
  note.textContent = res.note || " ";

  const actions = document.createElement("div");
  actions.className = "resourceActions";

  const btn = document.createElement("a");
  btn.className = "msBtnCoolPrimary";
  btn.setAttribute("role", "button");
  btn.innerHTML = `<span class="btnIcon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M12 3v10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M8 11l4 4 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 20h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></span>다운로드`;

  // Dummy state: no hardcoded URL. Keep future extension point (supabase storage).
  btn.href = "javascript:void(0)";
  btn.setAttribute("aria-disabled", "true");
  btn.classList.add("isDisabledLink");

  actions.appendChild(btn);

  card.appendChild(title);
  card.appendChild(note);
  card.appendChild(actions);

  return card;
}

function render() {
  const slug = getSlugFromPathname();
  const subject = findSubjectBySlug(slug);

  const nameEl = $("subjectName");
  const descEl = $("subjectDesc");
  const listEl = $("resourcesList");

  if (!nameEl || !descEl || !listEl) return;

  if (!subject) {
    nameEl.textContent = "과목을 찾을 수 없습니다";
    descEl.textContent = "주소를 확인한 뒤 다시 시도해주세요.";
    return;
  }

  nameEl.textContent = `${subject.name} 자료 다운로드`;
  descEl.textContent = subject.description || subject.oneLiner || "";

  while (listEl.firstChild) listEl.removeChild(listEl.firstChild);
  const resources = Array.isArray(subject.resources) ? subject.resources : [];
  if (!resources.length) {
    const empty = document.createElement("div");
    empty.className = "resourceEmpty";
    empty.textContent = "등록된 자료가 아직 없습니다.";
    listEl.appendChild(empty);
    return;
  }
  for (const r of resources) listEl.appendChild(renderResourceItem(r));
}

setupThemeToggle();
render();


