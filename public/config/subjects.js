export const SUBJECTS = [
  {
    slug: "korean",
    name: "국어",
    oneLiner: "말하기·듣기·읽기·쓰기를 역할극으로 연습해요.",
    description:
      "대화 연습, 주장-근거 말하기, 인물 인터뷰 등 국어 수업에 바로 쓰는 역할극 생성기를 사용합니다.",
    iconSvg: `
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="neonKorean" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#FF5D8F" />
            <stop offset="100%" stop-color="#F24CFF" />
          </linearGradient>
        </defs>
        <path d="M20 10V18C20 19.1046 19.1046 20 18 20H8.82843C8.29799 20 7.78929 20.2107 7.41421 20.5858L4 24V6C4 4.89543 4.89543 4 6 4H14" stroke="url(#neonKorean)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M16 2L22 8" stroke="url(#neonKorean)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M22 2L16 8" stroke="url(#neonKorean)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="11" cy="12" r="1.5" fill="url(#neonKorean)" />
        <circle cx="15" cy="12" r="1.5" fill="url(#neonKorean)" />
        <circle cx="7" cy="12" r="1.5" fill="url(#neonKorean)" />
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
        <defs>
          <linearGradient id="neonSocial" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#00DBDE" />
            <stop offset="100%" stop-color="#FC00FF" />
          </linearGradient>
        </defs>
        <circle cx="12" cy="12" r="9" stroke="url(#neonSocial)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M3.6 9H20.4" stroke="url(#neonSocial)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M3.6 15H20.4" stroke="url(#neonSocial)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M12 3C14.5013 5.73835 15.9228 8.29203 16 12C15.9228 15.708 14.5013 18.2616 12 21C9.49872 18.2616 8.07725 15.708 8 12C8.07725 8.29203 9.49872 5.73835 12 3Z" stroke="url(#neonSocial)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
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
        <defs>
          <linearGradient id="neonEthics" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#FF9A9E" />
            <stop offset="100%" stop-color="#FECFEF" />
          </linearGradient>
        </defs>
        <path d="M12 21.35L10.55 20.03C5.4 15.36 2 12.28 2 8.5C2 5.42 4.42 3 7.5 3C9.24 3 10.91 3.81 12 5.09C13.09 3.81 14.76 3 16.5 3C19.58 3 22 5.42 22 8.5C22 12.28 18.6 15.36 13.45 20.04L12 21.35Z" stroke="url(#neonEthics)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M8 10L11 13L16 8" stroke="url(#neonEthics)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
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
        <defs>
          <linearGradient id="neonHistory" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#F4D03F" />
            <stop offset="100%" stop-color="#16A085" />
          </linearGradient>
        </defs>
        <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="url(#neonHistory)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M12 6V12L16 14" stroke="url(#neonHistory)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
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
        <defs>
          <linearGradient id="neonEnglish" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#8EC5FC" />
            <stop offset="100%" stop-color="#E0C3FC" />
          </linearGradient>
        </defs>
        <path d="M4 5V19C4 20.1046 4.89543 21 6 21H19C19.5523 21 20 20.5523 20 20V4C20 3.44772 19.5523 3 19 3H6C4.89543 3 4 3.89543 4 5Z" stroke="url(#neonEnglish)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M2 9H22" stroke="url(#neonEnglish)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M9 13H15" stroke="url(#neonEnglish)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M9 17H13" stroke="url(#neonEnglish)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `.trim(),
  },
];

export function findSubjectBySlug(slug) {
  const s = String(slug || "").trim();
  return SUBJECTS.find((x) => x.slug === s) || null;
}


