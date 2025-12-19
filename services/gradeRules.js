/**
 * Grade-level language constraints (One Source of Truth)
 * Keep the policy here so validator/repair can reuse without scattering.
 */

export function getGradeConstraints({ gradeBand, grade } = {}) {
  const g =
    Number(grade || 0) ||
    (gradeBand === "LOW" ? 2 : gradeBand === "HIGH" ? 6 : 4);

  if (g <= 2) {
    return {
      maxChars: Number(process.env.GRADE_LOW_MAX_CHARS || 25),
      maxSentences: 1,
      forbiddenWords: [
        "해결책",
        "원인",
        "결과",
        "논리",
        "추론",
        "가설",
        "사실상",
        "정책",
        "제도",
        "구조",
        "상충",
        "복합",
        "따라서",
        "그러므로",
      ],
      replacements: {
        해결책: "방법",
        원인: "이유",
        결과: "끝",
        논리: "말",
        추론: "생각",
        가설: "예상",
        정책: "약속",
        제도: "규칙",
        사실상: "거의",
        구조: "모양",
        상충: "부딪힘",
        복합: "여러",
        따라서: "그래서",
        그러므로: "그래서",
      },
    };
  }

  if (g <= 4) {
    return {
      maxChars: Number(process.env.GRADE_MID_MAX_CHARS || 40),
      maxSentences: 2,
      forbiddenWords: ["사실상", "추론", "가설", "복합", "상충"],
      replacements: { 사실상: "거의", 추론: "생각", 가설: "예상", 상충: "부딪힘" },
    };
  }

  return {
    maxChars: Number(process.env.GRADE_HIGH_MAX_CHARS || 55),
    // High grades may allow up to 3 short sentences per line.
    maxSentences: 3,
    forbiddenWords: [],
    replacements: {},
  };
}

export function getMaxSentences({ gradeBand, grade } = {}) {
  return getGradeConstraints({ gradeBand, grade }).maxSentences;
}

export function getMaxChars({ gradeBand, grade } = {}) {
  return getGradeConstraints({ gradeBand, grade }).maxChars;
}


