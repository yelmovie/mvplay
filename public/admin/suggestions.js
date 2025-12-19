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

async function apiGet(path) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20_000);
  try {
    const resp = await fetch(path, { signal: ctrl.signal });
    const json = await resp.json().catch(() => ({}));
    return { ok: resp.ok, status: resp.status, json };
  } finally {
    clearTimeout(t);
  }
}

async function apiPatch(path, payload) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20_000);
  try {
    const resp = await fetch(path, {
      method: "PATCH",
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

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmtDate(d) {
  try {
    return new Date(d).toLocaleString();
  } catch {
    return String(d || "");
  }
}

function snippet(s, n = 20) {
  const t = String(s || "").trim();
  return t.length <= n ? t : t.slice(0, n) + "…";
}

function renderList(items) {
  const listEl = $("list");
  listEl.innerHTML = "";

  if (!items.length) {
    listEl.innerHTML = `<div class="lineText">(제안 없음)</div>`;
    return;
  }

  for (const it of items) {
    const row = document.createElement("div");
    row.className = "sceneCard";
    row.tabIndex = 0;
    row.setAttribute("role", "button");
    row.setAttribute("aria-label", "제안 상세 보기");
    row.innerHTML = `
      <div class="lineRow" style="justify-content: space-between; gap: 12px;">
        <div>
          <div class="sceneTitle" style="margin:0 0 6px 0;">${escapeHtml(
            snippet(it.message)
          )}</div>
          <div class="samplesHint">카테고리: ${escapeHtml(
            it.category || "-"
          )} · 날짜: ${escapeHtml(fmtDate(it.created_at))}</div>
        </div>
        <span class="speakerBadge">${escapeHtml(it.status || "new")}</span>
      </div>
    `;
    const open = () => renderDetail(it);
    row.addEventListener("click", open);
    row.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") open();
    });
    listEl.appendChild(row);
  }
}

function renderDetail(it) {
  $("detailBox").classList.remove("hidden");
  const d = $("detail");
  d.innerHTML = `
    <div class="sceneCard">
      <div class="samplesHint">ID: ${escapeHtml(it.id)}</div>
      <div class="samplesHint">페이지: ${escapeHtml(it.page || "-")}</div>
      <div class="samplesHint">UA: ${escapeHtml(it.ua || "-")}</div>
      <div class="sceneTitle" style="margin-top:10px;">내용</div>
      <div class="lineText">${escapeHtml(it.message)}</div>
    </div>
    <div class="sceneCard">
      <label for="status">상태</label>
      <select id="status">
        <option value="new">new</option>
        <option value="triaged">triaged</option>
        <option value="done">done</option>
      </select>
      <label for="note">관리자 메모</label>
      <textarea id="note" rows="5" style="width: 100%; padding: 0.75rem; border-radius: var(--radius-md); border: 1px solid var(--border); background: var(--bg-elev); color: var(--text); box-sizing: border-box;"></textarea>
      <div class="row">
        <button id="btnSave" class="ghost" type="button">저장</button>
      </div>
      <p class="msg" id="detailMsg"></p>
    </div>
  `;
  const statusEl = $("status");
  const noteEl = $("note");
  statusEl.value = it.status || "new";
  noteEl.value = it.admin_note || "";
  $("btnSave").addEventListener("click", async () => {
    const btn = $("btnSave");
    btn.disabled = true;
    $("detailMsg").textContent = "";
    const payload = {
      status: statusEl.value,
      admin_note: noteEl.value,
    };
    const { ok, status, json } = await apiPatch(
      `/api/admin/suggestions/${encodeURIComponent(it.id)}`,
      payload
    );
    if (!ok) {
      $("detailMsg").textContent = json?.error || `저장 실패 (HTTP ${status})`;
      btn.disabled = false;
      return;
    }
    $("detailMsg").style.color = "var(--muted)";
    $("detailMsg").textContent = "저장 완료";
    btn.disabled = false;
    // refresh list
    await load();
  });
}

async function load() {
  $("msg").textContent = "";
  const { ok, status, json } = await apiGet("/api/admin/suggestions");
  if (!ok) {
    if (status === 401) location.href = "/admin.html";
    $("msg").textContent = json?.error || `로드 실패 (HTTP ${status})`;
    return;
  }
  renderList(json.items || []);
}

setupThemeToggle();
$("btnRefresh").addEventListener("click", load);
load();




