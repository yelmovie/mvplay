const LENGTH_RULES = {
  LOW: {
    linesPerRoleMin: 3,
    linesPerRoleMax: 5,
    sentenceLen: "짧게",
    vocab: "아주 쉬움",
  },
  MID: {
    linesPerRoleMin: 4,
    linesPerRoleMax: 7,
    sentenceLen: "보통",
    vocab: "쉬움",
  },
  HIGH: {
    linesPerRoleMin: 6,
    linesPerRoleMax: 10,
    sentenceLen: "약간 길게",
    vocab: "교과 핵심용어 포함",
  },
};

const HUMOR_TYPES = ["상황 유머", "말투 유머", "관찰 유머"];

// User-confirmed default tone (fixed defaults)
const DEFAULT_STYLE_META = {
  humorLevel: 3,
  narratorMode: "on",
  historyHumorMode: "speechOnly",
};

// "억지 설정" 자동 검수용 키워드 (History에서만 엄격 적용)
const BANNED_MODERN_HISTORY = [
  "스마트폰",
  "휴대폰",
  "유튜브",
  "틱톡",
  "인스타",
  "SNS",
  "밈",
  "짤",
  "구독",
  "좋아요",
  "알림",
  "DM",
  "카톡",
  "단톡방",
  "이모티콘",
];

// 모든 과목에서 "갑툭튀" 방지 (역할극 현실감 유지)
const BANNED_ABRUPT_FANTASY = [
  "마법",
  "외계인",
  "포털",
  "타임머신",
  "소환",
  "초능력",
];

// 조롱/비난/위험 표현 (유머로도 금지)
const BANNED_HARM_JOKES = [
  "바보",
  "멍청",
  "찌질",
  "못생",
  "뚱",
  "왕따",
  "죽어",
  "패죽",
];

function findAnyMatches(text, needles) {
  const t = String(text || "");
  const hits = [];
  for (const n of needles || []) {
    if (!n) continue;
    if (t.includes(n)) hits.push(n);
  }
  return hits;
}

function getSceneList(script) {
  if (Array.isArray(script?.script?.scenes)) return script.script.scenes;
  if (Array.isArray(script?.scenes)) return script.scenes;
  return [];
}

function collectAllText(script) {
  const parts = [];
  if (!script || typeof script !== "object") return "";
  parts.push(
    script?.header?.title,
    script?.header?.subject,
    script?.header?.era,
    script?.header?.rationale
  );
  parts.push(script.situation_roles, script.narrator_setup);
  if (Array.isArray(script.key_terms))
    parts.push(
      script.key_terms
        .map((t) => `${t?.term} ${t?.easy_def} ${t?.example}`)
        .join(" ")
    );
  if (Array.isArray(script.characters))
    parts.push(
      script.characters
        .map((c) => `${c?.name} ${c?.description} ${c?.speech_tip}`)
        .join(" ")
    );
  for (const sc of getSceneList(script)) {
    parts.push(sc?.scene_title);
    if (Array.isArray(sc?.stage_directions))
      parts.push(sc.stage_directions.join(" "));
    if (Array.isArray(sc?.lines))
      parts.push(sc.lines.map((l) => `${l?.speaker}: ${l?.text}`).join(" "));
    parts.push(sc?.conflict_core, sc?.reason, sc?.insight_line, sc?.humor_type);
  }
  return parts.filter(Boolean).join("\n");
}

function runToneChecklist(script, input) {
  const failures = [];
  const subject = input?.subject || script?.header?.subject || "";
  const era = input?.era || script?.header?.era || "";
  const allText = collectAllText(script);

  const fantasyHits = findAnyMatches(allText, BANNED_ABRUPT_FANTASY);
  if (fantasyHits.length)
    failures.push(`금지된 뜬금 설정(판타지/갑툭튀): ${fantasyHits.join(", ")}`);

  const harmHits = findAnyMatches(allText, BANNED_HARM_JOKES);
  if (harmHits.length)
    failures.push(`조롱/비난/위험 표현(유머 금지): ${harmHits.join(", ")}`);

  if (subject === "역사" || (typeof era === "string" && era.trim())) {
    const modernHits = findAnyMatches(allText, BANNED_MODERN_HISTORY);
    if (modernHits.length)
      failures.push(
        `역사 장면에 억지 현대 요소 금지: ${modernHits.join(", ")}`
      );
  }

  const scenes = getSceneList(script);
  if (!Array.isArray(scenes) || scenes.length < 3) {
    failures.push("장면 수 부족(기본 3장면 유지)");
  } else {
    // Humor beats: 2~4 across whole script
    const beats = [];
    for (const sc of scenes) {
      if (Array.isArray(sc?.humor_beats)) {
        for (const b of sc.humor_beats) beats.push(b);
      }
    }
    const beatTypes = beats
      .map((b) => String(b?.type || "").trim())
      .filter((t) => HUMOR_TYPES.includes(t));
    if (beatTypes.length < 2 || beatTypes.length > 4) {
      failures.push("유머 강도 3 기준: 웃음 포인트 2~4개 필요");
    }

    // History: speech humor must be 80%+
    if (subject === "역사" || (typeof era === "string" && era.trim())) {
      if (beatTypes.length) {
        const speechCount = beatTypes.filter((t) => t === "말투 유머").length;
        if (speechCount / beatTypes.length < 0.8) {
          failures.push("역사 유머는 말투 유머 80% 이상이어야 함");
        }
      }
    }

    for (const [idx, sc] of scenes.entries()) {
      const i = idx + 1;
      const conflict = String(sc?.conflict_core || "").trim();
      const reason = String(sc?.reason || "").trim();
      const insight = String(sc?.insight_line || "").trim();
      const humorType = String(sc?.humor_type || "").trim();
      if (!conflict) failures.push(`Scene ${i}: conflict_core 누락`);
      if (!reason) failures.push(`Scene ${i}: reason 누락`);
      if (!insight) failures.push(`Scene ${i}: insight_line 누락`);
      if (!humorType || !HUMOR_TYPES.includes(humorType))
        failures.push(`Scene ${i}: humor_type 누락/오류`);

      const lines = Array.isArray(sc?.lines) ? sc.lines : [];
      if (
        insight &&
        !lines.some((l) => String(l?.text || "").includes(insight))
      ) {
        failures.push(
          `Scene ${i}: 통찰 문장이 대사(lines.text)에 포함되지 않음`
        );
      }

      const tooLong = lines.some(
        (l) => String(l?.text || "").trim().length > 36
      );
      if (tooLong) failures.push(`Scene ${i}: 대사가 너무 김(36자 초과)`);

      // Narrator: 1~2 short lines at each scene (transition/setting)
      const narratorLines = lines.filter(
        (l) => String(l?.speaker || "").trim() === "내레이터"
      );
      if (!narratorLines.length)
        failures.push(`Scene ${i}: 내레이터 라인 누락`);
      if (narratorLines.length > 2)
        failures.push(`Scene ${i}: 내레이터 과다(2줄 초과)`);
      const narratorTooLong = narratorLines.some(
        (l) => String(l?.text || "").trim().length > 80
      );
      if (narratorTooLong)
        failures.push(`Scene ${i}: 내레이터 설명이 김(80자 초과)`);

      // History per-scene humor placement (speech humor 중심)
      if (subject === "역사" || (typeof era === "string" && era.trim())) {
        const beatsForScene = Array.isArray(sc?.humor_beats)
          ? sc.humor_beats
          : [];
        const speechBeats = beatsForScene.filter(
          (b) => String(b?.type || "").trim() === "말투 유머"
        ).length;
        if (i === 1 && speechBeats < 1)
          failures.push("Scene1: 말투 유머 1개 필요");
        if (i === 2 && (speechBeats < 1 || speechBeats > 2))
          failures.push("Scene2: 말투 유머 1~2개 필요");
        if (i === 3 && speechBeats > 1)
          failures.push("Scene3: 말투 유머 0~1개 필요");
      }
    }
  }

  return { ok: failures.length === 0, failures };
}

function computeDialoguePlan(durationMin, scenesCount) {
  const computed =
    durationMin <= 5
      ? { scenes: 3, linesPerSceneMin: 6, linesPerSceneMax: 10 }
      : durationMin <= 10
      ? { scenes: 4, linesPerSceneMin: 10, linesPerSceneMax: 14 }
      : { scenes: 5, linesPerSceneMin: 12, linesPerSceneMax: 18 };

  const s = Number.isFinite(Number(scenesCount)) ? Number(scenesCount) : null;
  return s ? { ...computed, scenes: s } : computed;
}

function invalidJsonFromModel(detail) {
  const e = new Error("INVALID_JSON_FROM_MODEL");
  e.code = "INVALID_JSON_FROM_MODEL";
  if (detail) e.detail = detail;
  return e;
}

function stripCodeFences(input) {
  if (typeof input !== "string") return input;
  let s = input.replace(/^\uFEFF/, "").trim(); // BOM + trim

  // Remove a single outer markdown code fence: ```json ... ```
  // - allows language label (json/java/javascript/etc.)
  // - allows optional newline after opening fence
  s = s.replace(/^\s*```[a-zA-Z0-9_-]*\s*\n?/, "");
  s = s.replace(/\n?\s*```\s*$/, "");

  return s.trim();
}

/**
 * Best-effort JSON recovery:
 * 1) JSON.parse(raw)
 * 2) Extract from first "{" to last "}" then JSON.parse(candidate)
 * Throws INVALID_JSON_FROM_MODEL on failure.
 * @param {string} rawText
 */
function safeParseModelJson(rawText) {
  const raw = String(rawText || "")
    .replace(/^\uFEFF/, "")
    .trim();
  try {
    return JSON.parse(raw);
  } catch {
    // continue
  }
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    const candidate = raw.slice(start, end + 1).trim();
    try {
      return JSON.parse(candidate);
    } catch {
      // fallthrough
    }
  }
  const e = invalidJsonFromModel("safe_parse_failed");
  // attach a small debug snippet for dev (server will decide whether to expose)
  e.sample = raw.slice(0, 300);
  throw e;
}

function normalizeForMatch(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

function normalizeWorksheet(parsed, input) {
  const {
    topic,
    subject,
    era,
    grade,
    durationMin,
    groupSize,
    plan,
    charactersCount,
  } = input;
  const out = parsed && typeof parsed === "object" ? parsed : {};

  // If model returned legacy schema, lift into worksheet schema.
  if (!out.header && (out.topic_title || out.narrator_setup || out.scenes)) {
    out.header = {
      title: out.topic_title || topic,
      subject: out.subject || subject || "국어",
      grade: out.grade || grade,
      duration_min: out.durationMin || durationMin,
      group_size: out.groupSize || groupSize,
    };
    out.situation_roles = out.narrator_setup || "";
    out.characters = Array.isArray(out.cast)
      ? out.cast.map((c) => ({
          name: c?.name || c?.role_name || "",
          description: c?.description || c?.role_hint || "",
          speech_tip: "",
        }))
      : [];
    out.script = {
      scenes: Array.isArray(out.scenes)
        ? out.scenes.map((s) => ({
            scene_title: s?.scene_title || "장면",
            stage_directions: Array.isArray(s?.stage_directions)
              ? s.stage_directions
              : [],
            lines: Array.isArray(s?.lines) ? s.lines : [],
          }))
        : [],
    };
    out.wrap_up_questions = Array.isArray(out.wrap_up?.questions)
      ? out.wrap_up.questions
      : [];
    out.extension_activity = {
      discussion: "",
      writing: out.wrap_up?.writing_prompt || "",
    };
    out.teacher_tips = [];
    out.lesson_points = Array.isArray(out.lesson_points)
      ? out.lesson_points
      : [];
    out.achievement_standards = out.curriculum
      ? {
          note: out.curriculum.note || "(확인 필요) 관련 성취기준(요약)",
          standards: out.curriculum.standards || [],
          keywords: out.curriculum.keywords || [],
        }
      : {
          note: "(확인 필요) 관련 성취기준(요약)",
          standards: [],
          keywords: [],
        };
  }

  // Ensure required keys exist
  if (!out.header)
    out.header = {
      title: topic,
      subject: subject || "국어",
      grade,
      duration_min: durationMin,
      group_size: groupSize,
    };

  // Input values must not be overwritten by model outputs.
  out.header.title =
    typeof out.header.title === "string" && out.header.title.trim()
      ? out.header.title.trim()
      : topic;
  out.header.subject = subject || "국어";
  out.header.grade = grade;
  out.header.duration_min = durationMin;
  out.header.group_size = groupSize;
  if (typeof era === "string" && era.trim()) {
    out.header.era = era.trim();
  }
  if (Number.isFinite(Number(charactersCount))) {
    out.header.characters_count = Number(charactersCount);
  }
  if (Number.isFinite(Number(plan?.scenes))) {
    out.header.scenes_count = Number(plan.scenes);
  }
  if (typeof out.situation_roles !== "string") out.situation_roles = "";
  if (!Array.isArray(out.key_terms)) out.key_terms = [];
  if (!Array.isArray(out.characters)) out.characters = [];
  if (!out.script || typeof out.script !== "object")
    out.script = { scenes: [] };
  if (!Array.isArray(out.script.scenes)) out.script.scenes = [];
  if (!Array.isArray(out.lesson_points)) out.lesson_points = [];
  if (!Array.isArray(out.teacher_tips)) out.teacher_tips = [];
  if (!Array.isArray(out.wrap_up_questions)) out.wrap_up_questions = [];
  if (!out.extension_activity || typeof out.extension_activity !== "object")
    out.extension_activity = { discussion: "", writing: "" };
  if (
    !out.achievement_standards ||
    typeof out.achievement_standards !== "object"
  )
    out.achievement_standards = {
      note: "(확인 필요) 관련 성취기준(요약)",
      standards: [],
      keywords: [],
    };

  // Minimal non-LLM fallbacks (avoid empty sections if model omitted them)
  if (!out.teacher_tips.length) {
    out.teacher_tips = [
      "장면별로 역할을 나누고, 말투(높임말/설득/반박)를 짧게 연습한 뒤 시작합니다.",
      "시간이 짧으면 무대지시를 1줄로 줄이고, 핵심 대사만 또박또박 읽게 지도합니다.",
      "마무리 질문 3개 중 1개만 선택해 1분 토의 후, 글쓰기 과제로 연결합니다.",
    ];
  }
  if (!out.lesson_points.length) {
    out.lesson_points = [
      "장면의 흐름을 따라가며 인물의 선택과 이유를 말로 설명해 본다.",
      "갈등이 생기는 지점과 해결 방법을 찾아 자신의 경험과 연결해 본다.",
      "핵심 용어를 대사 속에서 다시 사용해 보며 의미를 확인한다.",
    ];
  }
  if (!out.extension_activity.discussion) {
    out.extension_activity.discussion =
      "대본의 갈등 해결 방식이 공정했는지 토의하고, 다른 해결안을 1가지 제안해 본다.";
  }

  // Backward-compat fields for existing UI/DOCX rendering
  out.topic_title = out.header?.title || out.topic_title || topic;
  out.narrator_setup = out.situation_roles || out.narrator_setup || "";
  out.cast = Array.isArray(out.characters)
    ? out.characters.map((c) => ({
        name: c?.name,
        description: [c?.description, c?.speech_tip]
          .filter(Boolean)
          .join(" / "),
      }))
    : out.cast || [];
  out.scenes = Array.isArray(out.script?.scenes)
    ? out.script.scenes.map((s) => ({
        scene_title: s?.scene_title,
        stage_directions: s?.stage_directions,
        lines: s?.lines,
      }))
    : out.scenes || [];
  out.curriculum = out.achievement_standards
    ? {
        standards: out.achievement_standards.standards || [],
        keywords: out.achievement_standards.keywords || [],
        note: out.achievement_standards.note,
      }
    : out.curriculum || { standards: [], keywords: [] };
  out.wrap_up = {
    questions: out.wrap_up_questions,
    writing_prompt: out.extension_activity?.writing || "",
  };

  out._plan = plan;
  return out;
}

export async function callUpstageChat({
  subject,
  topic,
  era,
  grade,
  gradeBand,
  durationMin,
  groupSize,
  scenesCount,
  charactersCount,
  coreValues,
  topicRationale,
  discussionMode,
  timeoutMs,
  fastMode,
}) {
  const baseUrl = process.env.UPSTAGE_BASE_URL;
  const apiKey = process.env.UPSTAGE_API_KEY;
  const model = process.env.UPSTAGE_MODEL || "solar-pro";

  if (!baseUrl || !apiKey) throw new Error("Upstage env missing");

  const isFastMode = fastMode !== false;
  const rules = LENGTH_RULES[gradeBand] || LENGTH_RULES.MID;
  const plan = computeDialoguePlan(durationMin, scenesCount);

  // durationMin에 따른 선형 보간 대신 간단한 3단계 스케일 적용
  let targetLines;
  if (durationMin <= 5) targetLines = rules.linesPerRoleMin;
  else if (durationMin <= 10)
    targetLines = Math.floor(
      (rules.linesPerRoleMin + rules.linesPerRoleMax) / 2
    );
  else targetLines = rules.linesPerRoleMax;

  const isHistory =
    subject === "역사" || (typeof era === "string" && era.trim());
  const historyNoModern = isHistory
    ? "\n- 역사 설정에서는 현대 스마트폰/유튜브/게임/밈/현대 은어/메신저 요소를 절대로 넣지 마세요."
    : "";
  const historyHumorBlock = isHistory
    ? `\n[역사 과목 전용 제한(가장 중요)]
- 사실성 우선: 핵심 사건 흐름(원인-전개-결과)은 교과서 수준으로 무리 없이 유지합니다.
- 유머는 말투 유머 80% 이상으로 구성합니다.
- 상황/관찰 유머는 사실 왜곡 없는 범위에서만 ‘아주 소량’ 허용합니다.
- 인물 비하/악마화 금지(상대도 논리 있게).
- 애매한 사실은 "기록에 따르면/전해진다"로 처리(과용 금지).`
    : "";

  // [English Subject] Enforce English Output
  const englishModeBlock =
    subject === "영어" || subject === "english"
      ? `\n[CRITICAL: ENGLISH OUTPUT REQUIRED]
- Write the entire script / response in ENGLISH ONLY.
- Key terms, Scene titles, Lines, Explanations, Teacher tips, Feedback questions MUST BE English.
- Do NOT include any Korean characters.`
      : "";

  const fastSchema = `{
  "header": { "title": "제목", "subject": "과목", "grade": 4, "duration_min": 5, "group_size": 5 },
  "situation_roles": "상황 및 역할(해설) - 3~5문장",
  "key_terms": [
    { "term": "용어", "easy_def": "정의(1문장)", "example": "예문(1문장)" }
  ],
  "characters": [
    { "name": "이름", "description": "성격/관계", "speech_tip": "말투 팁" }
  ],
  "script": {
    "scenes": [
      {
        "scene_title": "장면 제목",
        "stage_directions": ["무대지시 1줄"],
        "lines": [
          { "speaker": "내레이터", "text": "1줄" },
          { "speaker": "이름", "text": "대사" }
        ]
      }
    ]
  }
}`.trim();

  const systemPromptFast =
    `당신은 초등학생용 교육용 역할극 대본 생성기입니다.
반드시 아래 JSON 스키마를 만족하는 "짧은 대본"을 생성하세요.

[CRITICAL]
- You MUST output ONLY valid JSON.
- No markdown, no introductory text, no "Here is the result".
- If you cannot comply, output {"error":"FORMAT_ERROR"} only.

[속도 우선]
- 출력은 짧게: 장면 ${plan.scenes}개, 장면당 대사(lines) 6~8줄 이내.
- 무대지시(stage_directions)는 장면당 1줄.
- 핵심 용어(key_terms)는 3개 이내.
- characters는 ${Number.isFinite(Number(charactersCount)) ? Number(charactersCount) : 5}명 이내(가능하면 4~6명).
- 불필요한 장문 설명 금지. JSON 외 텍스트 금지. 코드펜스 금지.

[스키마]
${fastSchema}
`.trim();

  const systemPrompt =
    `당신은 초등학생(특히 4~6학년)용 교육용 역할극 대본 생성기이자 작가입니다.
학교 수업에서 즉시 활용 가능한 수준 높은 대본을 생성하세요.
기본 출력은 반드시 "워크시트형(풍부)"이며, 섹션을 생략/요약하지 마세요.
반드시 아래 JSON 스키마를 엄격히 준수하여 응답하세요. (누락 시 실패)

[CRITICAL]
- You MUST output ONLY valid JSON.
- No markdown, no introductory text, no "Here is the result".
- If you cannot comply, output {"error":"FORMAT_ERROR"} only.

[사용자 확정 톤(기본값 고정)]
- humorLevel=${DEFAULT_STYLE_META.humorLevel} (교실에서 웃음 터짐)
- narratorMode=${
      DEFAULT_STYLE_META.narratorMode
    } (상황을 잡아주는 내레이터 유지)
- historyHumorMode=${DEFAULT_STYLE_META.historyHumorMode}

[공통 유머 규칙(강도 3)]
- 대본 전체에 자연스러운 웃음 포인트 2~4개를 분산 배치합니다(장면마다 0~2개).
- 허용 유머: 상황 유머(오해/타이밍/긴장완화), 말투 유머(되묻기/짧은 말장난/리듬감), 관찰 유머(심리 한 줄)
- 금지: 조롱/외모/차별/폭력 유머, 밈/유행어 남발, 캐릭터 붕괴, 뜬금 초현실 설정(마법/외계인 등)
${historyHumorBlock}
${englishModeBlock}

[톤 목표]
- 아이들이 웃고 몰입하는 재치·유머가 있으면서도, 역사/사회/도덕의 핵심 통찰이 자연스럽게 남아야 합니다.
- 억지 설정(갑툭튀 밈, 무리한 현대물, 과장된 캐릭터 붕괴)은 금지합니다.

[유머 원칙(허용 3종)]
- 상황 유머: 긴장/오해/타이밍에서 웃음(과장 X)
- 말투 유머: 짧은 말장난/되묻기/리듬감(밈 X)
- 관찰 유머: 사람 심리를 살짝 찌르는 한 줄(비난/조롱 X)

[금지]
- 폭력·혐오·외모 조롱·차별적 농담 금지
- 악역을 ‘바보’로 만들지 말 것(인물 존중)
- 장면 전환이 너무 뜬금없는 설정(마법/외계인/포털 등) 금지
${historyNoModern}

[내레이터 운영(유지)]
- 장면 시작/전환마다 내레이터 1~2문장으로 배경·상황·긴장도를 잡습니다.
- 설교체 금지. 짧고 그림 그려지는 묘사로 씁니다.
- 설명을 길게 끌지 말고 핵심은 인물 대사로 처리합니다.

[학년별 난이도 조절 규칙]
- 학년 모드: ${gradeBand} (${rules.vocab})
- 문장 길이: ${rules.sentenceLen}
- 역할당 목표 대사 수: ${targetLines}줄 내외
- 1~2학년: 짧은 문장, 매우 쉬운 낱말을 사용하고 감탄사나 의성어/의태어, 단어 반복을 활용하여 흥미를 유발하세요.
- 3~4학년: 초등 교과서 수준의 어휘를 사용하고, 인물이 행동이나 감정의 이유를 한 문장 정도 설명하게 하세요.
- 5~6학년: 해당 주제와 관련된 사회/과학/역사 핵심 용어를 2~3개 자연스럽게 포함하고, 논리적인 연결어(그래서, 하지만, 따라서 등)를 활용하세요.

[필수 원칙]
- 시간(분)이 짧아도 워크시트 섹션은 유지합니다. 줄이는 것은 "대본의 대사량" 위주로만 조절합니다.
- 핵심 용어는 3~6개를 포함하세요. 정의는 1문장, 예문은 1문장(초등 예문).
- 상황 및 역할(해설)은 5~8문장으로 충분히 자세히 작성하세요. (너무 짧게 금지)
- 교사용 지도 팁(teacher_tips), 확장 활동(extension_activity)은 시간에 상관없이 반드시 포함하세요. (한 줄로 끝내지 마세요)
- 폭력적, 혐오적, 비하적 표현은 절대로 사용하지 마세요.
- 대본의 문장 길이, 어휘 난이도, 설명의 깊이는 반드시 요청받은 ${grade}학년 (${gradeBand}) 수준에 맞추세요.
- 생소한 용어가 필요한 경우 대사 흐름 안에서 짧게 풀어 설명하세요.
- 성취기준은 "검증된 매핑 데이터"가 없으면 코드/번호를 단정하지 말고, "관련 성취기준(요약)" 형태로만 작성하며 "(확인 필요)" 라벨을 붙이세요.

[분량 정책]
- 목표 장면 수: ${plan.scenes}개
- 장면당 대사 수: ${plan.linesPerSceneMin}~${
      plan.linesPerSceneMax
    }줄 (DurationMin=${durationMin})
- 장면 3개 기본. (DurationMin<=5여도 장면 수 유지)
- 만약 주제가 "서희" 또는 "외교담판"을 포함하면, 기본 3장면 제목은 반드시: "조정회의" / "거란 진영" / "최종 담판"

[장면 구성 템플릿(기본 3장면)]
- Scene 1: 사건 발생(갈등 시작) + 웃음 포인트 1개(허용 3종 중 1개)
- Scene 2: 대치/오해 확대(정보 싸움) + 내레이터가 시대 배경 1~2문장 연결
- Scene 3: 해결/합의(통찰) + ‘이기는 결말’ 금지, 공존 가능한 다음 행동으로 마무리

[각 장면 필수 요소]
- conflict_core: 무엇을 놓고 다투는지 1문장
- reason: 인물 1명이 왜 그렇게 말하는지 근거 1개
- insight_line: 짧은 깨달음 1줄(설교 말투 금지)
- humor_type: "상황 유머" | "말투 유머" | "관찰 유머" 중 1개
- insight_line은 해당 장면의 대사(lines.text)에 그대로 1번 포함되어야 합니다.
- humor_beats: 웃음 포인트 0~2개 배열(총 2~4개). 각 항목은 {type, line_index}.
- 내레이터: 각 장면의 lines 첫 1~2줄은 speaker="내레이터"로 작성(짧게).

[스키마 - 워크시트형(풍부) 고정]
{
  "header": { "title": "제목", "subject": "과목", "grade": 4, "duration_min": 5, "group_size": 5, "characters_count": 5, "scenes_count": 3 },
  "situation_roles": "상황 및 역할(해설) - 5~8문장",
  "key_terms": [
    { "term": "용어", "easy_def": "정의(1문장)", "example": "예문(1문장)" }
  ],
  "characters": [
    { "name": "이름", "description": "성격/관계", "speech_tip": "말투/표현 팁" }
  ],
  "script": {
    "scenes": [
      {
        "scene_title": "장면 제목",
        "stage_directions": ["무대지시 1~2줄"],
        "conflict_core": "갈등의 핵심 1문장",
        "reason": "선택의 이유(근거) 1문장",
        "insight_line": "통찰 1줄",
        "humor_type": "상황 유머",
        "humor_beats": [{ "type": "말투 유머", "line_index": 2 }],
        "lines": [
          { "speaker": "내레이터", "text": "장면 시작/전환을 1~2문장으로 잡는다." },
          { "speaker": "이름", "text": "대사" }
        ]
      }
    ]
  },
  "lesson_points": ["수업 포인트 1", "수업 포인트 2", "수업 포인트 3"],
  "teacher_tips": ["지도 팁 1", "지도 팁 2", "지도 팁 3"],
  "wrap_up_questions": ["마무리 질문 1", "마무리 질문 2", "마무리 질문 3"],
  "extension_activity": {
    "discussion": "확장 토론 활동 1",
    "writing": "확장 글쓰기 활동 1"
  },
  "achievement_standards": {
    "note": "(확인 필요) 관련 성취기준(요약)",
    "standards": ["요약 문장 1", "요약 문장 2"],
    "keywords": ["핵심키워드1", "핵심키워드2"]
  }
}
위 스키마의 모든 최상위 키는 반드시 존재해야 합니다(빈 값 금지).
대본(script.scenes)은 최소 ${
      plan.scenes
    }개 장면을 포함하고, 장면마다 stage_directions 1~2줄을 포함하세요.
등장인물(characters)은 정확히 ${
      Number.isFinite(Number(charactersCount))
        ? Number(charactersCount)
        : groupSize
    }명으로 작성하세요.
대사는 등장인물이 고르게 참여하도록 구성하세요.

[출력 형식 규칙 - 매우 중요]
- 반드시 "순수 JSON"만 출력하세요.
- 마크다운 금지. 코드블록(백틱 3개로 감싼 코드펜스) 금지. 설명 문장/주석/접두어 금지.
- JSON 외 텍스트가 1글자라도 포함되면 실패로 간주됩니다.
`.trim();

  const userPrompt = `
 Subject: ${subject || "국어"}
Topic: ${topic}
Era: ${era || ""}
TopicRationale: ${typeof topicRationale === "string" ? topicRationale : ""}
CoreValues: ${
    Array.isArray(coreValues) && coreValues.length ? coreValues.join(", ") : ""
  }
humorLevel: ${DEFAULT_STYLE_META.humorLevel}
narratorMode: ${DEFAULT_STYLE_META.narratorMode}
historyHumorMode: ${DEFAULT_STYLE_META.historyHumorMode}
GradeBand: ${gradeBand}
Grade: ${grade}학년
DurationMin: ${durationMin}분
GroupSize: ${groupSize}명
ScenesCount: ${Number.isFinite(Number(plan?.scenes)) ? Number(plan.scenes) : ""}
CharactersCount: ${
    Number.isFinite(Number(charactersCount)) ? Number(charactersCount) : ""
  }
DiscussionMode: ${discussionMode ? "ON" : "OFF"}
Output Style: Worksheet-rich (sections must be included). A4 2~4 pages is fine. Readability first.

Output: Return ONLY a single JSON object. No markdown, no code fences, no extra text.
If you output anything other than JSON, the system will crash.
`.trim();

  const totalBudgetMs = Math.max(
    3000,
    Number(timeoutMs || process.env.UPSTAGE_TIMEOUT_MS || 30000)
  );
  const budgetStart = Date.now();

  function remainingBudgetMs() {
    return totalBudgetMs - (Date.now() - budgetStart);
  }

  async function callOnce(temp, extraInstruction) {
    const url = `${baseUrl}/chat/completions`;

    const sys = extraInstruction
      ? `${(isFastMode ? systemPromptFast : systemPrompt)}\n\n[추가 지시]\n${extraInstruction}`.trim()
      : isFastMode
      ? systemPromptFast
      : systemPrompt;

    const remainingMs = remainingBudgetMs();
    if (remainingMs <= 0) {
      const err = new Error("UPSTREAM_TIMEOUT");
      err.code = "UPSTREAM_TIMEOUT";
      err.where = "upstage";
      err.timeoutMs = totalBudgetMs;
      throw err;
    }
    const perCallTimeoutMs = Math.max(1000, remainingMs);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), perCallTimeoutMs);

    let resp;
    try {
      resp = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: sys },
            { role: "user", content: userPrompt },
          ],
          temperature: temp,
        }),
        signal: ctrl.signal,
      });
    } catch (e) {
      if (e?.name === "AbortError") {
        const err = new Error("UPSTREAM_TIMEOUT");
        err.code = "UPSTREAM_TIMEOUT";
        err.where = "upstage";
        err.timeoutMs = perCallTimeoutMs;
        throw err;
      }
      const err = new Error("UPSTREAM_FETCH_FAILED");
      err.code = "UPSTREAM_FETCH_FAILED";
      err.where = "upstage";
      err.cause = e;
      throw err;
    } finally {
      clearTimeout(timer);
    }

    if (!resp.ok) {
      const txt = await resp.text().catch(() => "");
      const err = new Error("UPSTREAM_ERROR");
      err.code = "UPSTREAM_ERROR";
      err.where = "upstage";
      err.status = resp.status;
      err.detail = String(txt || "").slice(0, 800);
      throw err;
    }

    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content;
    // Avoid dumping huge model outputs (can block event loop and delay responses).
    console.log(`[upstage] content_len=${String(content || "").length}`);
    if (!content) throw new Error("No content from LLM");

    const cleanContent = stripCodeFences(content);
    let parsed;
    try {
      parsed = safeParseModelJson(cleanContent);
    } catch (e) {
      if (e?.code === "INVALID_JSON_FROM_MODEL") {
        // Keep snippet for server-side debug routing
        throw e;
      }
      throw invalidJsonFromModel("safe_parse_unexpected_error");
    }

    parsed = normalizeWorksheet(parsed, {
      topic,
      subject: subject || "국어",
      era,
      grade,
      durationMin,
      groupSize,
      plan,
      charactersCount,
    });

    if (!isFastMode) {
      if (
        typeof parsed.situation_roles !== "string" ||
        parsed.situation_roles.length < 80
      ) {
        throw invalidJsonFromModel("situation_roles too short");
      }
      if (!Array.isArray(parsed.key_terms) || parsed.key_terms.length < 3) {
        throw invalidJsonFromModel("key_terms too short");
      }
    }
    const targetChars = Number.isFinite(Number(charactersCount))
      ? Number(charactersCount)
      : null;
    if (!Array.isArray(parsed.characters) || parsed.characters.length < 3) {
      throw invalidJsonFromModel("characters too short");
    }
    if (!isFastMode && targetChars && parsed.characters.length !== targetChars) {
      throw invalidJsonFromModel("characters count mismatch");
    }
    if (
      !Array.isArray(parsed.script?.scenes) ||
      parsed.script.scenes.length < plan.scenes
    ) {
      throw invalidJsonFromModel("script.scenes too short");
    }
    if (
      !isFastMode &&
      Array.isArray(parsed.script?.scenes) &&
      parsed.script.scenes.length !== plan.scenes
    ) {
      throw invalidJsonFromModel("script.scenes count mismatch");
    }

    const toneChecklist = runToneChecklist(parsed, { subject, era });
    parsed.styleMeta = { ...DEFAULT_STYLE_META };
    parsed.qualityNotes = { toneChecklist };
    // Fast mode: don't retry/throw on tone checklist failures; return a usable draft quickly.
    if (!isFastMode && !toneChecklist.ok) {
      throw invalidJsonFromModel(
        `tone_check_failed: ${toneChecklist.failures.join(" | ")}`
      );
    }
    return parsed;
  }

  // Try once; if model violates worksheet/tone checklist, retry with stricter fix-up instruction.
  if (isFastMode) {
    // Fast mode: single attempt (no slow retries).
    return await callOnce(0.4);
  }

  try {
    return await callOnce(0.7);
  } catch (e) {
    if (e?.code !== "INVALID_JSON_FROM_MODEL") throw e;
    // Retry only if we still have budget left for a meaningful second call.
    if (remainingBudgetMs() < 1200) throw e;
    const extra = `이전 출력이 워크시트 스키마/톤 체크리스트를 위반했습니다. 아래 원칙을 지키며 완전한 JSON을 다시 생성하세요.
- humorLevel=3: 웃음 포인트(humor_beats) 총 2~4개를 분산 배치(장면당 0~2개)
- 내레이터 유지: 각 장면 lines 첫 1~2줄은 speaker="내레이터"로 짧게(설교체 금지)
- 역사: 현대 요소(스마트폰/유튜브/게임/밈/현대 은어/메신저) 금지, 말투 유머 80% 이상, 사실 흐름 유지
- 금지: 폭력·혐오·외모 조롱·차별 농담, 악역 바보화, 뜬금 초현실 설정
- 각 장면마다 conflict_core/reason/insight_line/humor_type 필수
- insight_line은 해당 장면 대사(lines.text)에 그대로 1회 포함
- 대사는 15~25자 중심, 36자 초과 금지(길면 2문장으로 분리)
또한 situation_roles(5~8문장), key_terms(3~6), teacher_tips(3), extension_activity(토론+글쓰기)를 절대 생략하지 마세요.`;
    return await callOnce(0.3, extra);
  }
}
