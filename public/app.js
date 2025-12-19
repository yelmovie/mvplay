import {
  DEFAULT_TOPIC_SAMPLES,
  TOPIC_SAMPLES_BY_SUBJECT,
} from "./data/topicSamples.js";

const $ = (id) => document.getElementById(id);

const SUBJECTS = /** @type {const} */ (["국어", "사회", "도덕", "역사"]);

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
    // simple inline SVG (no external deps)
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

function setupGradeSync() {
  const bandEl = $("gradeBand");
  const gradeEl = $("grade");
  if (!bandEl || !gradeEl) return;

  bandEl.addEventListener("change", (e) => {
    const gradeMap = { LOW: "2", MID: "4", HIGH: "6" };
    gradeEl.value = gradeMap[e.target.value] || "4";
  });

  gradeEl.addEventListener("change", (e) => {
    const val = parseInt(e.target.value, 10);
    if (val <= 2) bandEl.value = "LOW";
    else if (val <= 4) bandEl.value = "MID";
    else bandEl.value = "HIGH";
  });
}

let isGenerating = false;

const TOPIC_PLACEHOLDERS = {
  국어: "직접 입력 가능 · 예) 갈등 대화 연습 / 주장-근거 말하기 / 인물 인터뷰 대본",
  사회: "직접 입력 가능 · 예) 우리 지역 문제 해결 회의 / 공정한 규칙 만들기 / 환경 실천 토론",
  도덕: "직접 입력 가능 · 예) 진심으로 사과하기 / 단톡방 예절 갈등 / 공정한 선택과 책임",
  역사: "직접 입력 가능 · 예) 역사 인물 인터뷰 / 갈등 해결 상황 / 시대별 선택의 순간",
};

function updateTopicPlaceholder(subject) {
  const topicInput = $("topic");
  if (!topicInput) return;
  const s = SUBJECTS.includes(subject) ? subject : "국어";
  topicInput.placeholder = TOPIC_PLACEHOLDERS[s] || TOPIC_PLACEHOLDERS.국어;
}

function getTrimmedTopic() {
  return String($("topic")?.value || "").trim();
}

function setError(message) {
  const msg = (message ?? "").toString();
  const hint = $("topicRequiredHint");
  if (hint) {
    hint.textContent = msg;
    hint.classList.add("isError");
    hint.classList.toggle("hidden", !msg);
  }
  const genMsg = $("genMsg");
  if (genMsg) genMsg.textContent = msg;
}

function clearTopicHintError() {
  const hint = $("topicRequiredHint");
  if (!hint) return;
  hint.classList.remove("isError");
}

function syncGenerateAvailability() {
  const btn = $("btnGenerate");
  const hint = $("topicRequiredHint");
  const topic = getTrimmedTopic();
  const canGenerate = Boolean(topic) && !isGenerating;

  if (btn) btn.disabled = !canGenerate;

  if (hint) {
    if (topic) {
      hint.textContent = "";
      hint.classList.add("hidden");
      hint.classList.remove("isError");
    } else {
      // If an explicit error is already shown (e.g., from final guard), don't overwrite it.
      const hasExplicitError =
        hint.classList.contains("isError") && hint.textContent.trim();
      if (!hasExplicitError) {
        hint.textContent = "주제를 입력해야 생성할 수 있어요.";
        hint.classList.remove("isError");
      }
      hint.classList.remove("hidden");
    }
  }
}

function setupSubject() {
  const subjectEl = $("subject");
  if (!subjectEl) return;

  // default: 국어
  subjectEl.value = "국어";
  updateTopicPlaceholder(subjectEl.value);

  subjectEl.addEventListener("change", () => {
    updateTopicPlaceholder(subjectEl.value);
    renderTopicSamples();
  });
}

function setupTopicRequiredUx() {
  const topicInput = $("topic");
  if (!topicInput) return;
  topicInput.addEventListener("input", () => {
    clearTopicHintError();
    syncGenerateAvailability();
  });
  syncGenerateAvailability();
}

function setTopicFromSample(sample) {
  const topicInput = $("topic");
  if (!topicInput) return;
  topicInput.value = String(sample || "");
  try {
    topicInput.focus?.();
    const end = topicInput.value.length;
    topicInput.setSelectionRange?.(end, end);
  } catch {
    // ignore
  }
  clearTopicHintError();
  syncGenerateAvailability();
}

function renderTopicSamples() {
  const container = $("topicSamples");
  if (!container) return;

  // Clear
  while (container.firstChild) container.removeChild(container.firstChild);

  const subject = $("subject")?.value;
  const base =
    (subject &&
      TOPIC_SAMPLES_BY_SUBJECT &&
      typeof TOPIC_SAMPLES_BY_SUBJECT === "object" &&
      TOPIC_SAMPLES_BY_SUBJECT[subject]) ||
    DEFAULT_TOPIC_SAMPLES;
  const list = Array.isArray(base) ? base.filter(Boolean).slice(0, 20) : [];

  for (const sample of list) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chipBtn";
    btn.textContent = sample;
    btn.setAttribute("aria-label", `주제 샘플: ${sample}`);
    btn.addEventListener("click", () => setTopicFromSample(sample));
    container.appendChild(btn);
  }
}

function mapValidationField(field) {
  const map = {
    subject: "과목",
    topic: "주제",
    era: "시대",
    topicRationale: "근거(성취요소 요약)",
    coreValues: "핵심가치",
    grade_band: "학년 모드",
    duration_min: "시간",
    group_size: "모둠 인원",
    scriptId: "scriptId",
  };
  return map[field] || field || "입력값";
}

function stripCodeFences(input) {
  if (typeof input !== "string") return input;
  let s = input.replace(/^\uFEFF/, "").trim();
  s = s.replace(/^\s*```[a-zA-Z0-9_-]*\s*\n?/, "");
  s = s.replace(/\n?\s*```\s*$/, "");
  return s.trim();
}

function normalizeScriptPayload(payload) {
  if (!payload || payload.ok !== true) {
    return { ok: false, error: payload?.error || "생성 실패" };
  }

  // 서버 현재 형태: { ok:true, scriptId, script }
  const scriptId = payload.scriptId;
  let script = payload.script;

  // 미래 대비: payload.data가 들어올 수 있음
  if (!script && payload.data) script = payload.data;

  if (typeof script === "string") {
    const cleaned = stripCodeFences(script);
    if (!cleaned.startsWith("{") || !cleaned.endsWith("}")) {
      return { ok: false, error: "출력 형식 오류(모델 응답이 JSON이 아님)" };
    }
    try {
      script = JSON.parse(cleaned);
    } catch {
      return { ok: false, error: "출력 형식 오류(모델 응답이 JSON이 아님)" };
    }
  }

  if (!script || typeof script !== "object") {
    return { ok: false, error: "출력 형식 오류(모델 응답이 JSON이 아님)" };
  }

  return { ok: true, scriptId, script };
}

function clearElement(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

function appendSectionTitle(parent, text) {
  const h = document.createElement("div");
  h.className = "sceneTitle";
  h.textContent = text;
  parent.appendChild(h);
}

function appendParagraph(parent, text) {
  const p = document.createElement("div");
  p.className = "lineText";
  p.textContent = (text ?? "").toString();
  parent.appendChild(p);
}

function renderScriptPreview(script, exportOptions) {
  const container = $("output");
  clearElement(container);

  if (!script || typeof script !== "object") {
    container.textContent = "미리보기 데이터를 찾을 수 없습니다.";
    return;
  }

  const includeStandards = exportOptions?.includeStandards !== false;

  // 1) 제목 + 메타(학년/시간/모둠) - DOCX와 동일한 정보
  const title = document.createElement("div");
  title.className = "sceneTitle";
  title.textContent = script?.header?.title || script.topic_title || "대본";
  container.appendChild(title);

  const meta = document.createElement("div");
  meta.className = "lineText";
  meta.style.fontStyle = "italic";
  const metaGrade = script?.header?.grade ?? script.grade ?? "-";
  const metaDur = script?.header?.duration_min ?? script.durationMin ?? "-";
  const metaGroup = script?.header?.group_size ?? script.groupSize ?? "-";
  const metaSubj = script?.header?.subject ?? script.subject ?? "";
  meta.textContent = `${
    metaSubj ? `과목: ${metaSubj} | ` : ""
  }학년: ${metaGrade}학년 | 수업시간: ${metaDur}분 | 모둠 인원: ${metaGroup}명`;
  container.appendChild(meta);

  // Topic rationale (from sample selection)
  const rationale =
    script?.header?.rationale ||
    script?.topicRationale ||
    script?.curriculumRationale;
  if (typeof rationale === "string" && rationale.trim()) {
    const r = document.createElement("div");
    r.className = "lineText";
    r.style.opacity = "0.92";
    r.textContent = `근거(성취요소 요약): ${rationale.trim()}`;
    container.appendChild(r);
  }

  const era =
    script?.header?.era || script?.era || script?.topicEra || script?.topic_era;
  if (typeof era === "string" && era.trim()) {
    const e = document.createElement("div");
    e.className = "lineText";
    e.style.opacity = "0.92";
    e.textContent = `시대: ${era.trim()}`;
    container.appendChild(e);
  }

  const coreVals =
    script?.header?.coreValues ||
    script?.header?.core_values ||
    script?.coreValues;
  if (Array.isArray(coreVals) && coreVals.length) {
    const c = document.createElement("div");
    c.className = "lineText";
    c.style.opacity = "0.92";
    c.textContent = `핵심가치: ${coreVals.map(String).join(", ")}`;
    container.appendChild(c);
  }

  // 2) 상황 및 역할(해설)
  const sec1 = document.createElement("div");
  sec1.className = "sceneCard";
  appendSectionTitle(sec1, "▣ 상황 및 역할(해설)");
  appendParagraph(
    sec1,
    script.situation_roles || script.narrator_setup || "상황 설명이 없습니다."
  );
  container.appendChild(sec1);

  // 3) 핵심 용어
  const keyTerms = Array.isArray(script.key_terms) ? script.key_terms : [];
  if (keyTerms.length) {
    const sec = document.createElement("div");
    sec.className = "sceneCard";
    appendSectionTitle(sec, "▣ 핵심 용어 살펴보기");
    for (const t of keyTerms) {
      const row = document.createElement("div");
      row.className = "lineRow";
      const badge = document.createElement("span");
      badge.className = "speakerBadge";
      badge.textContent = (t?.term ?? "").toString().trim() || "용어";
      const text = document.createElement("div");
      text.className = "lineText";
      const def = (t?.easy_def ?? "").toString();
      const ex = (t?.example ?? "").toString();
      text.textContent = def
        ? `${def}${ex ? `\n(예문) ${ex}` : ""}`
        : ex
        ? `(예문) ${ex}`
        : "";
      row.appendChild(badge);
      row.appendChild(text);
      sec.appendChild(row);
    }
    container.appendChild(sec);
  }

  // 4) 등장인물(역할)
  const cast = Array.isArray(script.characters)
    ? script.characters.map((c) => ({
        name: c?.name,
        description: [c?.description, c?.speech_tip]
          .filter(Boolean)
          .join(" / "),
      }))
    : Array.isArray(script.cast)
    ? script.cast
    : [];
  if (cast.length) {
    const sec = document.createElement("div");
    sec.className = "sceneCard";
    appendSectionTitle(sec, "▣ 등장인물(역할)");
    for (const c of cast) {
      const row = document.createElement("div");
      row.className = "lineRow";
      const badge = document.createElement("span");
      badge.className = "speakerBadge";
      badge.textContent = (c?.name ?? "").toString().trim() || "화자 미정";
      const text = document.createElement("div");
      text.className = "lineText";
      text.textContent = (c?.description ?? "").toString();
      row.appendChild(badge);
      row.appendChild(text);
      sec.appendChild(row);
    }
    container.appendChild(sec);
  }

  // 5) 대본(장면별)
  const scenes = Array.isArray(script?.script?.scenes)
    ? script.script.scenes.map((s) => ({
        scene_title: s?.scene_title,
        stage_directions: s?.stage_directions,
        lines: s?.lines,
      }))
    : Array.isArray(script.scenes)
    ? script.scenes
    : [];
  const secScript = document.createElement("div");
  secScript.className = "sceneCard";
  appendSectionTitle(secScript, "▣ 대본");
  if (!scenes.length) {
    appendParagraph(secScript, "(대본 없음)");
  } else {
    for (const scene of scenes) {
      const st = document.createElement("div");
      st.className = "sceneTitle";
      st.textContent = `[${scene?.scene_title || "장면"}]`;
      st.style.fontWeight = "800";
      secScript.appendChild(st);

      const stage = Array.isArray(scene?.stage_directions)
        ? scene.stage_directions
        : [];
      for (const d of stage.slice(0, 2)) {
        const p = document.createElement("div");
        p.className = "lineText";
        p.style.fontStyle = "italic";
        p.style.opacity = "0.9";
        p.textContent = `(${d})`;
        secScript.appendChild(p);
      }

      const lines = Array.isArray(scene?.lines) ? scene.lines : [];
      if (!lines.length) {
        appendParagraph(secScript, "(대사 없음)");
      } else {
        for (const line of lines) {
          const row = document.createElement("div");
          row.className = "lineRow";

          const badge = document.createElement("span");
          badge.className = "speakerBadge";
          const sp = (line?.speaker ?? "").toString().trim();
          badge.textContent = sp || "화자 미정";

          const text = document.createElement("div");
          text.className = "lineText";
          text.textContent = (line?.text ?? "").toString();

          row.appendChild(badge);
          row.appendChild(text);
          secScript.appendChild(row);
        }
      }
    }
  }
  container.appendChild(secScript);

  // 6) 수업 포인트(해설) - DOCX에 고정으로 들어가던 문구를 화면에도 동일하게 표시
  const secPoints = document.createElement("div");
  secPoints.className = "sceneCard";
  appendSectionTitle(secPoints, "▣ 수업 포인트(해설)");
  const lessonPoints = Array.isArray(script.lesson_points)
    ? script.lesson_points
    : [];
  if (lessonPoints.length) {
    for (const [i, p] of lessonPoints.slice(0, 3).entries()) {
      appendParagraph(secPoints, `${i + 1}. ${p}`);
    }
  } else {
    appendParagraph(
      secPoints,
      "1. 배역에 몰입하여 당시의 상황을 생생하게 표현해 봅시다."
    );
    appendParagraph(
      secPoints,
      "2. 인물 간의 갈등 해결 방식에 주목하여 감상해 봅시다."
    );
    appendParagraph(
      secPoints,
      "3. 대본의 내용을 바탕으로 오늘날의 가치를 찾아봅시다."
    );
  }
  container.appendChild(secPoints);

  // 6-2) 교사용 지도 팁 (워크시트형)
  const teacherTips = Array.isArray(script.teacher_tips)
    ? script.teacher_tips
    : [];
  if (teacherTips.length) {
    const sec = document.createElement("div");
    sec.className = "sceneCard";
    appendSectionTitle(sec, "▣ 교사용 지도 팁");
    for (const [i, t] of teacherTips.slice(0, 3).entries()) {
      appendParagraph(sec, `${i + 1}. ${t}`);
    }
    container.appendChild(sec);
  }

  // 7) 교육과정 성취기준(옵션)
  if (includeStandards) {
    const sec = document.createElement("div");
    sec.className = "sceneCard";
    appendSectionTitle(sec, "▣ 관련 성취기준(요약)");
    const standards =
      script?.achievement_standards?.standards ?? script?.curriculum?.standards;
    const keywords =
      script?.achievement_standards?.keywords ?? script?.curriculum?.keywords;
    const note =
      script?.achievement_standards?.note ?? script?.curriculum?.note ?? "";
    if (note) appendParagraph(sec, note);
    if (Array.isArray(standards) && standards.length) {
      for (const s of standards) appendParagraph(sec, `• ${s}`);
    } else if (typeof standards === "string" && standards.trim()) {
      // 일부 모델이 string으로 줄 수 있음(방어)
      appendParagraph(sec, standards);
    } else {
      appendParagraph(sec, "(성취기준 없음)");
    }
    if (Array.isArray(keywords) && keywords.length) {
      appendParagraph(sec, `핵심 키워드: ${keywords.join(", ")}`);
    } else if (typeof keywords === "string" && keywords.trim()) {
      appendParagraph(sec, `핵심 키워드: ${keywords}`);
    }
    container.appendChild(sec);
  }

  // 8) 마무리 질문/글쓰기
  const secWrap = document.createElement("div");
  secWrap.className = "sceneCard";
  appendSectionTitle(secWrap, "▣ 마무리 질문");
  const qs = script?.wrap_up_questions ?? script?.wrap_up?.questions;
  if (Array.isArray(qs) && qs.length) {
    for (const q of qs.slice(0, 3)) appendParagraph(secWrap, `Q. ${q}`);
  } else if (typeof qs === "string" && qs.trim()) {
    appendParagraph(secWrap, qs);
  } else {
    appendParagraph(secWrap, "(질문 없음)");
  }
  const ext = script?.extension_activity;
  if (ext?.discussion)
    appendParagraph(secWrap, `[확장 토론] ${ext.discussion}`);
  if (ext?.writing) appendParagraph(secWrap, `[확장 글쓰기] ${ext.writing}`);
  if (!ext?.writing && script?.wrap_up?.writing_prompt) {
    appendParagraph(secWrap, `[글쓰기 과제] ${script.wrap_up.writing_prompt}`);
  }
  container.appendChild(secWrap);
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // fallback
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

let lastScriptJsonString = "";
let generatedScript = null;
let generatedScriptId = "";
let generatedExportOptions = null;

function clearGenActions() {
  const wrap = $("genActions");
  if (!wrap) return;
  while (wrap.firstChild) wrap.removeChild(wrap.firstChild);
}

function addRetryFastModeAction(onClick) {
  const wrap = $("genActions");
  if (!wrap) return;
  const b = document.createElement("button");
  b.type = "button";
  b.className = "msBtnSecondary";
  b.textContent = "빠른 모드로 다시 생성";
  b.addEventListener("click", onClick);
  wrap.appendChild(b);
}

function isDebugMode() {
  try {
    const q = new URLSearchParams(window.location.search);
    return q.get("debug") === "1";
  } catch {
    return false;
  }
}

function syncAdvancedPanelVisibility() {
  const panel = $("advancedPanel");
  if (!panel) return;
  panel.classList.toggle("hidden", !isDebugMode());
}

$("btnGenerate").onclick = async () => {
  const topicText = getTrimmedTopic();
  if (!topicText) {
    // Final guard: never call API if topic is missing
    setError("주제를 입력해 주세요");
    try {
      $("topic")?.focus?.();
    } catch {
      // ignore
    }
    syncGenerateAvailability();
    return;
  }

  clearTopicHintError();
  isGenerating = true;
  syncGenerateAvailability();
  clearGenActions();

  $("genMsg").textContent = "생성 중...";
  generatedScript = null;
  generatedScriptId = "";
  generatedExportOptions = null;
  const exportBtn = $("btnExport");
  exportBtn.disabled = true;
  exportBtn.textContent = "먼저 대본을 생성하세요";

  try {
    const body = {
      subject: $("subject")?.value || "국어",
      topic: topicText,
      // Fast mode (default): prioritize returning a usable result within 30s.
      // Server may auto-adjust heavy parameters and will include `adjusted` in response when changed.
      fastMode: true,
      grade_band: $("gradeBand").value,
      grade: Number($("grade").value),
      group_size: Number($("groupSize").value),
      duration_min: Number($("durationMin").value),
      charactersCount: Number($("charactersCount")?.value),
      scenesCount: Number($("scenesCount")?.value),
      options: { discussionMode: $("discussionMode").checked },
      exportOptions: {
        twoColumn: Boolean($("checkTwoColumn")?.checked),
        includeStandards: Boolean($("checkStandards")?.checked),
      },
    };
    const requestId =
      (globalThis.crypto && crypto.randomUUID && crypto.randomUUID()) ||
      `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    console.log(
      `[generate:${requestId}] topic:`,
      body.topic,
      `[generate:${requestId}] payload:`,
      body
    );

    // Network failures (ERR_CONNECTION_RESET 등)도 사용자에게 보여주고 무한대기 방지
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 30_000); // 30초 타임아웃(무한대기 방지)

    let resp;
    try {
      resp = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Request-Id": requestId,
        },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(t);
    }

    // Read raw text first so we can log helpful diagnostics even when JSON parsing fails.
    const rawText = await resp.text().catch(() => "");
    let json = {};
    try {
      json = rawText ? JSON.parse(rawText) : {};
    } catch {
      json = {};
    }

    if (!resp.ok) {
      console.error(
        `[generate:${requestId}] API failed:`,
        resp.status,
        rawText
      );
      const errObj =
        json && typeof json?.error === "object" && json?.error
          ? json.error
          : null;
      const errCode = errObj?.code || json?.error_code || json?.error;
      const errField = errObj?.field || json?.field;

      if (errCode === "VALIDATION_FAILED" || errCode === "validation_failed") {
        $("genMsg").textContent = `입력값을 확인해주세요: ${mapValidationField(
          errField
        )}`;
      } else if (errCode === "UPSTREAM_TIMEOUT") {
        $("genMsg").textContent =
          "생성 서버가 응답하지 않습니다(30초 초과). 잠시 후 다시 시도해주세요.";
      } else if (errCode === "REQUEST_TIMEOUT") {
        $("genMsg").textContent =
          "생성이 오래 걸려 중단됐어요. (서버/모델 응답 지연)";
      } else if (errCode) {
        $("genMsg").textContent =
          errCode === "INVALID_JSON_FROM_MODEL"
            ? "출력 형식 오류(모델 응답이 JSON이 아님)"
            : String(errCode);
      } else {
        $("genMsg").textContent = `생성 실패 (HTTP ${resp.status})`;
      }
      return;
    }

    const normalized = normalizeScriptPayload(json);
    if (!normalized.ok) {
      $("genMsg").textContent = normalized.error || "생성 실패";
      return;
    }

    generatedScript = normalized.script;
    // Put meta onto the single script object so preview and DOCX share the same source of truth.
    generatedScript.durationMin = body.duration_min;
    generatedScript.groupSize = body.group_size;
    generatedScript.grade = body.grade;
    generatedScript.subject = body.subject;
    generatedScriptId = normalized.scriptId || json.scriptId || "";
    generatedExportOptions = body.exportOptions;

    renderScriptPreview(generatedScript, generatedExportOptions);
    lastScriptJsonString = JSON.stringify(generatedScript, null, 2);

    const scriptIdEl = $("scriptId");
    if (scriptIdEl) scriptIdEl.value = generatedScriptId;

    const exportBtn = $("btnExport");
    exportBtn.disabled = false;
    exportBtn.textContent = "DOCX 다운로드(미리보기와 동일)";
    $("genMsg").textContent = json?.notice
      ? `생성 완료 · ${String(json.notice)}`
      : "생성 완료";

    // JSON panel reset
    $("jsonOutput").textContent = lastScriptJsonString;
    $("btnCopyJson").disabled = !lastScriptJsonString;
  } catch (e) {
    const msg =
      e?.name === "AbortError"
        ? "생성이 오래 걸려 중단됐어요. (서버/모델 응답 지연)"
        : `서버 연결 오류가 발생했습니다. (${String(
            e?.message || "failed_to_fetch"
          )})`;
    console.error("Generate fetch failed:", e?.stack || e);
    $("genMsg").textContent = msg;

    if (e?.name === "AbortError") {
      // Provide a single-click retry that forces stronger "fast" inputs on the client too.
      addRetryFastModeAction(() => {
        try {
          const dur = $("durationMin");
          const scenes = $("scenesCount");
          const chars = $("charactersCount");
          if (dur) dur.value = String(Math.min(Number(dur.value || 0) || 8, 8));
          if (scenes)
            scenes.value = String(Math.min(Number(scenes.value || 0) || 4, 4));
          if (chars)
            chars.value = String(Math.min(Number(chars.value || 0) || 6, 6));
        } catch {
          // ignore
        }
        try {
          $("btnGenerate")?.click?.();
        } catch {
          // ignore
        }
      });
    }
  } finally {
    isGenerating = false;
    syncGenerateAvailability();
  }
};

// JSON 보기/복사 토글
$("btnToggleJson").onclick = async () => {
  const panel = $("jsonOutput");
  const isHidden = panel.classList.contains("hidden");
  panel.classList.toggle("hidden", !isHidden);
  $("btnToggleJson").textContent = isHidden ? "JSON 숨기기" : "JSON 보기";
};

$("btnCopyJson").onclick = async () => {
  if (!lastScriptJsonString) return;
  const ok = await copyToClipboard(lastScriptJsonString);
  $("genMsg").textContent = ok ? "JSON 복사 완료" : "JSON 복사 실패";
};

$("btnExport").onclick = async () => {
  if (!generatedScript) {
    $("genMsg").textContent = "먼저 대본을 생성하세요";
    return;
  }

  const btn = $("btnExport");
  btn.disabled = true;
  $("genMsg").textContent = "DOCX 생성 중...";
  const body = {
    // Single Source of Truth: docx must be generated from the exact script shown in preview
    script: generatedScript,
    exportOptions: {
      twoColumn: Boolean($("checkTwoColumn")?.checked),
      includeStandards: Boolean($("checkStandards")?.checked),
    },
  };

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 120_000);

    let resp;
    try {
      resp = await fetch("/api/docx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(t);
    }

    if (!resp.ok) {
      const raw = await resp.text().catch(() => "");
      let msg = `다운로드 실패 (HTTP ${resp.status})`;
      try {
        const json = raw ? JSON.parse(raw) : {};
        const errObj =
          json && typeof json?.error === "object" && json?.error ? json.error : null;
        msg =
          errObj?.message ||
          errObj?.code ||
          json?.error ||
          json?.error_code ||
          msg;
      } catch {
        if (raw) msg = raw;
      }
      $("genMsg").textContent = String(msg);
      return;
    }

    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);

    // 파일명 추출 (헤더에서 가져오기)
    const disposition = resp.headers.get("Content-Disposition");
    let filename = `roleplay.docx`;
    if (disposition) {
      // UTF-8 filename 대응 (filename*=UTF-8'')
      const utf8Match = disposition.match(/filename\\*=UTF-8''([^;]+)/i);
      if (utf8Match) {
        filename = decodeURIComponent(utf8Match[1]);
      } else {
        const normalMatch = disposition.match(/filename=\"?([^\";]+)\"?/i);
        if (normalMatch) filename = normalMatch[1];
      }
    }

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    $("genMsg").textContent = "DOCX 다운로드 완료";
  } catch (e) {
    console.error("DOCX fetch failed:", e);
    $("genMsg").textContent =
      e?.name === "AbortError"
        ? "다운로드가 지연됩니다. 잠시 후 다시 시도해주세요."
        : "다운로드 중 서버 연결 오류가 발생했습니다.";
  } finally {
    btn.disabled = false;
  }
};

setupGradeSync();
setupSubject();
setupTopicRequiredUx();
renderTopicSamples();
syncAdvancedPanelVisibility();
setupThemeToggle();

// Keep preview/docx options in sync (Single Source of Truth)
["checkStandards", "checkTwoColumn"].forEach((id) => {
  const el = $(id);
  if (!el) return;
  el.addEventListener("change", () => {
    if (!generatedScript) return;
    const nextOpts = {
      twoColumn: Boolean($("checkTwoColumn")?.checked),
      includeStandards: Boolean($("checkStandards")?.checked),
    };
    generatedExportOptions = nextOpts;
    renderScriptPreview(generatedScript, generatedExportOptions);
    const exportBtn = $("btnExport");
    if (exportBtn) exportBtn.textContent = "DOCX 다운로드(미리보기와 동일)";
  });
});
