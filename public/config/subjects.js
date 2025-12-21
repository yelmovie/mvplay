export const SUBJECTS = [
  {
    slug: "korean",
    name: "국어",
    oneLiner: "말하기·듣기·읽기·쓰기를 역할극으로 연습해요.",
    description:
      "대화 연습, 주장-근거 말하기, 인물 인터뷰 등 국어 수업에 바로 쓰는 역할극 생성기를 사용합니다.",
    iconSvg: `
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M6 4h12a2 2 0 0 1 2 2v14H7a3 3 0 0 1-3-3V6a2 2 0 0 1 2-2Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
        <path d="M8 8h8M8 11h6M8 14h7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" opacity=".85"/>
      </svg>
    `.trim(),
  },
  {
    slug: "social",
    name: "사회",
    oneLiner: "우리 사회의 규칙과 공동체를 탐구해요.",
    description:
      "공정한 규칙 만들기, 지역 문제 해결, 환경/경제/시민성 등 수업에 바로 연결되는 자료를 모아둡니다.",
    iconSvg: `
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 2a10 10 0 1 0 0 20a10 10 0 0 0 0-20Z" stroke="currentColor" stroke-width="1.8"/>
        <path d="M2.5 12h19" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" opacity=".9"/>
        <path d="M12 2c2.8 2.7 4.6 6.2 4.6 10S14.8 19.3 12 22" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" opacity=".55"/>
        <path d="M12 2C9.2 4.7 7.4 8.2 7.4 12S9.2 19.3 12 22" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" opacity=".55"/>
      </svg>
    `.trim(),
  },
  {
    slug: "ethics",
    name: "도덕",
    oneLiner: "가치·공감·책임을 대화로 연습해요.",
    description:
      "사과/갈등 조정/배려/정의 등 핵심가치를 역할극과 토의로 자연스럽게 연결할 수 있는 자료를 제공합니다.",
    iconSvg: `
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 21s-7-4.7-9.2-9.3C1 8.6 3 5.5 6.2 5.5c1.9 0 3.1 1.1 3.8 2c.7-.9 1.9-2 3.8-2C17 5.5 19 8.6 21.2 11.7C19 16.3 12 21 12 21Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
        <path d="M8.4 12.1h1.8l1.1-2.2l1.5 4.6l1-2.4h2.8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" opacity=".75"/>
      </svg>
    `.trim(),
  },
  {
    slug: "history",
    name: "역사",
    oneLiner: "인물·사건을 ‘현장감’ 있게 이해해요.",
    description:
      "시대/인물 인터뷰, 선택의 순간 토론 등 역사 수업에 적합한 역할극 자료를 모아둡니다.",
    iconSvg: `
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M6 4h9.5a2.5 2.5 0 0 1 2.5 2.5V20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
        <path d="M6 17h12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" opacity=".65"/>
        <path d="M8.4 7.8h6.6M8.4 11h5.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" opacity=".85"/>
      </svg>
    `.trim(),
  },
  {
    slug: "english",
    name: "영어",
    oneLiner: "실생활 의사소통을 역할극으로 연습해요.",
    description:
      "영어 회화, 상황별 표현 연습, 일상 대화 등 영어 수업에 활용할 수 있는 역할극 자료를 제공합니다.",
    iconSvg: `
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
        <path d="M2.5 9h19M2.5 15h19M9 2.5v19M15 2.5v19" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity=".5"/>
        <path d="M7 7l10 10M17 7L7 17" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
      </svg>
    `.trim(),
  },
];

export function findSubjectBySlug(slug) {
  const s = String(slug || "").trim();
  return SUBJECTS.find((x) => x.slug === s) || null;
}


