const $ = (id) => document.getElementById(id);

function getPreferredTheme() {
  try {
    const stored = localStorage.getItem("theme");
    if (stored === "dark" || stored === "light") return stored;
  } catch {}
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
  } catch {}
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

async function apiPost(path, payload) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20_000);
  try {
    const resp = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    const json = await resp.json().catch(() => ({}));
    return { ok: resp.ok, status: resp.status, json };
  } finally {
    clearTimeout(t);
  }
}

setupThemeToggle();

$("btnLogin").addEventListener("click", async () => {
  const pw = ($("pw").value || "").trim();
  const msg = $("msg");
  msg.textContent = "";
  if (!pw) {
    msg.textContent = "비밀번호를 입력해주세요.";
    return;
  }
  $("btnLogin").disabled = true;
  try {
    const { ok, status, json } = await apiPost("/api/admin/login", {
      password: pw,
    });
    if (!ok) {
      msg.textContent = json?.error || `로그인 실패 (HTTP ${status})`;
      return;
    }
    location.href = "/admin/suggestions.html";
  } catch (e) {
    msg.textContent =
      e?.name === "AbortError"
        ? "서버 응답이 지연됩니다."
        : "서버 연결 오류가 발생했습니다.";
  } finally {
    $("btnLogin").disabled = false;
  }
});




