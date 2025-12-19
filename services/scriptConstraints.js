/**
 * Validation + deterministic repair for script constraints.
 * Goal: enforce exact character set usage and grade-appropriate language.
 */

import { getGradeConstraints } from "./gradeRules.js";

function getAllLines(script) {
  const scenes = Array.isArray(script?.script?.scenes) ? script.script.scenes : [];
  const out = [];
  for (const sc of scenes) {
    const lines = Array.isArray(sc?.lines) ? sc.lines : [];
    for (const ln of lines) out.push(ln);
  }
  return out;
}

function uniq(arr) {
  return Array.from(new Set(arr));
}

export function extractSpeakers(script) {
  return uniq(
    getAllLines(script)
      .map((l) => String(l?.speaker || "").trim())
      .filter(Boolean)
  );
}

export function validateSpeakers(script, characterList) {
  const list = Array.isArray(characterList) ? characterList.map(String) : [];
  const allowed = new Set(list);
  const speakers = extractSpeakers(script);

  const unknownSpeakers = speakers.filter((s) => !allowed.has(s));
  const missingSpeakers = list.filter((name) => !speakers.includes(name));

  const ok =
    unknownSpeakers.length === 0 &&
    missingSpeakers.length === 0 &&
    speakers.length === list.length;

  return {
    ok,
    speakers,
    unknownSpeakers,
    missingSpeakers,
  };
}

function countSentences(s) {
  const text = String(s || "").trim();
  if (!text) return 0;
  // Minimal + deterministic sentence count:
  // - split by punctuation [.!?] (+ CJK variants) and count non-empty chunks
  return (
    text
      .split(/[.!?。！？]/)
      .map((x) => x.trim())
      .filter(Boolean).length || 1
  );
}

function splitIntoSentences(text) {
  const s = String(text || "").trim();
  if (!s) return [];
  const parts = [];
  let buf = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    buf += ch;
    if (/[.!?。！？]/.test(ch)) {
      const t = buf.trim();
      if (t) parts.push(t);
      buf = "";
    }
  }
  const tail = buf.trim();
  if (tail) parts.push(tail);
  return parts.length ? parts : [s];
}

function chunkSentences(sentences, maxSentencesPerLine) {
  const maxN = Math.max(1, Number(maxSentencesPerLine || 1));
  const out = [];
  for (let i = 0; i < sentences.length; i += maxN) {
    out.push(sentences.slice(i, i + maxN).join(" "));
  }
  return out;
}

function enforceSentenceLimits(script, constraints, notes) {
  const maxSentences = Number(constraints?.maxSentences || 0) || 1;
  const scenes = Array.isArray(script?.script?.scenes) ? script.script.scenes : [];
  let changed = false;

  for (const sc of scenes) {
    const lines = Array.isArray(sc?.lines) ? sc.lines : [];
    const next = [];
    for (const ln of lines) {
      if (!ln || typeof ln !== "object") continue;
      const speaker = String(ln.speaker || "").trim();
      const text = String(ln.text || "").trim();
      if (!text) continue;

      const sentCount = countSentences(text);
      if (sentCount <= maxSentences) {
        next.push(ln);
        continue;
      }

      const sentences = splitIntoSentences(text);
      const chunks = chunkSentences(sentences, maxSentences);
      chunks.forEach((t) => next.push({ speaker, text: t }));
      changed = true;
      notes.push({
        type: "SPLIT_TOO_MANY_SENTENCES",
        speaker,
        fromCount: sentCount,
        toLines: chunks.length,
      });
    }
    sc.lines = next;
  }

  return changed;
}

function hasForbidden(text, forbidden) {
  const t = String(text || "");
  return forbidden.filter((w) => w && t.includes(w));
}

export function validateGrade(script, constraints) {
  const lines = getAllLines(script);
  const issues = [];
  const maxChars = Number(constraints?.maxChars || 0) || 26;
  const maxSentences = Number(constraints?.maxSentences || 0) || 2;
  const forbidden = Array.isArray(constraints?.forbiddenWords) ? constraints.forbiddenWords : [];

  for (const ln of lines) {
    const speaker = String(ln?.speaker || "").trim();
    const text = String(ln?.text || "").trim();
    if (!text) continue;
    if (text.length > maxChars) {
      issues.push({ code: "LINE_TOO_LONG", speaker, len: text.length, max: maxChars, text });
    }
    // TOO_MANY_SENTENCES is considered auto-repairable (handled by enforceSentenceLimits),
    // so it should never block generation. Keep it as a warning-only issue if needed.
    if (countSentences(text) > maxSentences) {
      issues.push({ code: "TOO_MANY_SENTENCES", speaker, text });
    }
    const forb = hasForbidden(text, forbidden);
    if (forb.length) {
      issues.push({ code: "FORBIDDEN_WORD", speaker, words: forb, text });
    }
    if ((constraints?.maxSentences || 0) <= 1) {
      // For LOW grades: avoid heavy punctuation patterns
      if (/[(),]/.test(text)) {
        issues.push({ code: "PUNCTUATION_COMPLEX", speaker, text });
      }
    }
  }

  return { ok: issues.length === 0, issues };
}

export function validateAll({ script, characterList, scenesCount, gradeBand, grade }) {
  const speaker = validateSpeakers(script, characterList);
  const gc = getGradeConstraints({ gradeBand, grade });
  const gradeCheck = validateGrade(script, gc);
  const expectedScenes = Number.isFinite(Number(scenesCount)) ? Number(scenesCount) : null;
  const actualScenes = Array.isArray(script?.script?.scenes) ? script.script.scenes.length : 0;
  const scenesOk = expectedScenes ? actualScenes === expectedScenes : true;

  // Fatal constraints: speakers + scenes must match.
  // Grade issues are warnings (auto-repairable) and must not cause 502.
  const ok = speaker.ok && scenesOk;
  const details = [];
  const warnings = [];

  if (!scenesOk) {
    details.push({
      code: "SCENES_COUNT_MISMATCH",
      expectedScenes,
      actualScenes,
    });
  }

  if (!speaker.ok) {
    details.push({
      code: "SPEAKER_MISMATCH",
      unknownSpeakers: speaker.unknownSpeakers,
      missingSpeakers: speaker.missingSpeakers,
      expectedCount: Array.isArray(characterList) ? characterList.length : 0,
      actualSpeakers: speaker.speakers,
    });
  }
  if (!gradeCheck.ok) {
    warnings.push({ code: "GRADE_RULES", issues: gradeCheck.issues.slice(0, 30) });
  }

  return {
    ok,
    details,
    warnings,
    speaker,
    gradeCheck,
    gradeConstraints: gc,
    scenesOk,
    expectedScenes,
    actualScenes,
  };
}

function simplifyText(text, constraints) {
  let t = String(text || "");
  const repl = constraints?.replacements || {};
  for (const [from, to] of Object.entries(repl)) {
    if (!from) continue;
    t = t.split(from).join(String(to));
  }

  // Remove parentheses for low grades
  if ((constraints?.maxSentences || 2) <= 1) {
    t = t.replace(/[()]/g, "");
    t = t.replace(/,+/g, " ");
  }

  const maxChars = Number(constraints?.maxChars || 0) || 26;
  // Hard clamp
  t = t.trim();
  if (t.length > maxChars) t = t.slice(0, maxChars - 1).trimEnd() + "…";
  return t;
}

export function repairScript({ script, characterList, scenesCount, gradeBand, grade }) {
  const notes = [];
  const list = Array.isArray(characterList) ? characterList.map(String) : [];
  const allowed = new Set(list);
  const validation = validateAll({ script, characterList: list, gradeBand, grade });

  // Clone minimal (avoid deep clone libraries)
  const out = JSON.parse(JSON.stringify(script || {}));
  out.characterList = list;

  // Ensure script.scenes structure
  out.script = out.script && typeof out.script === "object" ? out.script : { scenes: [] };
  out.script.scenes = Array.isArray(out.script.scenes) ? out.script.scenes : [];

  // 0) Scenes count normalization (if required)
  const expectedScenes = Number.isFinite(Number(scenesCount)) ? Number(scenesCount) : null;
  if (expectedScenes) {
    if (out.script.scenes.length > expectedScenes) {
      out.script.scenes = out.script.scenes.slice(0, expectedScenes);
      notes.push({ type: "trim_scenes", to: expectedScenes });
    } else if (out.script.scenes.length < expectedScenes) {
      const start = out.script.scenes.length;
      for (let i = start; i < expectedScenes; i++) {
        out.script.scenes.push({
          scene_title: `장면 ${i + 1}`,
          stage_directions: [],
          lines: [],
        });
      }
      notes.push({ type: "pad_scenes", from: start, to: expectedScenes });
    }
  }

  function normalizeForMatch(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[^\p{L}\p{N}]/gu, "");
  }

  function bestMatchSpeaker(unknown) {
    const u = normalizeForMatch(unknown).replace(/\d+/g, "");
    if (!u) return list[0] || unknown;
    let best = list[0] || unknown;
    let bestScore = -1;
    for (const cand of list) {
      const c = normalizeForMatch(cand);
      let score = 0;
      // Overlap score (Korean names are short; overlap works well enough)
      for (const ch of u) if (c.includes(ch)) score += 1;
      if (c === u) score += 10;
      if (u.startsWith(c) || c.startsWith(u)) score += 2;
      if (score > bestScore) {
        bestScore = score;
        best = cand;
      }
    }
    return best;
  }

  // 1) Speaker normalization: map unknown speakers into allowed set
  for (const sc of out.script.scenes) {
    sc.lines = Array.isArray(sc?.lines) ? sc.lines : [];
    for (const ln of sc.lines) {
      const sp = String(ln?.speaker || "").trim();
      if (!sp) continue;
      if (!allowed.has(sp)) {
        const mapped = bestMatchSpeaker(sp);
        ln.speaker = mapped;
        notes.push({ type: "mapped_unknown_speaker", from: sp, to: mapped });
      }
    }
  }

  // 2) Insert missing speakers: ensure everyone speaks at least once
  const afterNorm = validateSpeakers(out, list);
  const missing = afterNorm.missingSpeakers.slice();
  if (missing.length) {
    const constraints = getGradeConstraints({ gradeBand, grade });
    const templatesLow = ["나도 그래.", "나도 그래요.", "좋아!", "알겠어.", "같이 하자."];
    const templatesMid = ["나도 그렇게 생각해.", "좋아, 그렇게 하자.", "왜 그렇게 생각해?", "내가 도와줄게."];
    const templatesHigh = ["나는 이렇게 생각해.", "근거는 뭐야?", "좋은 의견이야.", "다른 방법도 있어."];
    const pick = (arr, i) => arr[i % arr.length];
    const tpl =
      (Number(grade || 0) || 0) <= 2
        ? templatesLow
        : (Number(grade || 0) || 0) <= 4
        ? templatesMid
        : templatesHigh;

    // If no scenes, create at least 1.
    if (!out.script.scenes.length) {
      out.script.scenes.push({ scene_title: "장면 1", stage_directions: [], lines: [] });
      notes.push({ type: "created_scene_for_missing_speakers" });
    }

    // Round-robin insert: distribute missing speakers across scenes.
    const scenes = out.script.scenes;
    missing.forEach((name, idx) => {
      const sceneIdx = idx % scenes.length;
      const targetScene = scenes[sceneIdx];
      targetScene.lines = Array.isArray(targetScene.lines) ? targetScene.lines : [];
      const insertAt = Math.max(0, targetScene.lines.length - 2);
      const text = simplifyText(pick(tpl, idx), constraints);
      targetScene.lines.splice(insertAt, 0, { speaker: name, text });
    });
    notes.push({ type: "insert_missing_speakers_round_robin", missing });
  }

  // 3) Grade sentence enforcement (deterministic split)
  const constraints = getGradeConstraints({ gradeBand, grade });
  const didSplit = enforceSentenceLimits(out, constraints, notes);

  // 4) Grade text simplification (clamp + replacement)
  let didSimplify = false;
  for (const sc of out.script.scenes) {
    sc.lines = Array.isArray(sc?.lines) ? sc.lines : [];
    for (const ln of sc.lines) {
      if (!ln || typeof ln !== "object") continue;
      const before = String(ln.text || "");
      const after = simplifyText(before, constraints);
      if (after !== before) didSimplify = true;
      ln.text = after;
    }
  }
  if (didSimplify) notes.push({ type: "grade_simplify", maxChars: constraints.maxChars });

  // Final validation snapshot
  const final = validateAll({ script: out, characterList: list, scenesCount: expectedScenes || undefined, gradeBand, grade });
  const repaired = notes.length > 0;
  return { script: out, repaired, repairNotes: notes, finalValidation: final };
}

export function buildRetryInstruction({ characterList, details, gradeBand, grade }) {
  const list = Array.isArray(characterList) ? characterList.join(", ") : "";
  const detailText = (details || [])
    .map((d) => {
      if (d.code === "SPEAKER_MISMATCH") {
        return `- 화자 불일치: 누락=[${(d.missingSpeakers || []).join(", ")}], 알 수 없는 화자=[${(d.unknownSpeakers || []).join(", ")}]`;
      }
      if (d.code === "GRADE_RULES") {
        return `- 학년 규칙 위반: 예시 ${(d.issues || []).slice(0, 5).map((x) => x.code).join(", ")}`;
      }
      return `- ${d.code}`;
    })
    .join("\n");

  return `아래 조건을 반드시 만족하도록 JSON만 다시 생성하세요.

[화자 규칙(가장 중요)]
- speaker는 아래 characterList에 있는 이름만 사용하세요. 다른 이름/내레이터/선생님 등 금지.
- 모든 캐릭터가 최소 1번 이상 말해야 합니다.
- 캐릭터 수는 정확히 ${Array.isArray(characterList) ? characterList.length : ""}명입니다.
- characterList를 그대로 echo하세요.

characterList: [${list}]

[학년 규칙]
- 학년 모드: ${gradeBand}, 학년: ${grade}
- 문장은 짧게, 쉬운 말 사용.

[이전 출력의 문제]
${detailText}
`.trim();
}


