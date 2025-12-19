import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  PageOrientation,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
} from "docx";

/**
 * topicTitle에서 영어/숫자/하이픈/언더스코어만 남기고 파일명용으로 정리
 */
export function sanitizeFilename(topic, scriptId) {
  const today = new Date().toISOString().split("T")[0].replace(/-/g, "");
  const safeTopic = topic
    .replace(/[^\w\sㄱ-ㅎㅏ-ㅣ가-힣-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 30);

  const englishOnly = safeTopic
    .replace(/[ㄱ-ㅎㅏ-ㅣ가-힣]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  const finalTopic = englishOnly || "script";
  const safeId = String(scriptId || "").slice(0, 12);

  return `${today}-roleplay-${finalTopic}-${safeId}-v2`;
}

const ROLE_COLORS = [
  "2563EB", // cool blue
  "0EA5E9", // sky
  "14B8A6", // teal
  "22C55E", // cool green
  "6366F1", // indigo
  "A855F7", // purple
  "06B6D4", // cyan
  "3B82F6", // blue
];

export async function buildDocx(topicTitle, script, options = {}) {
  // Readability first. Default to 1 column; allow 2 columns only when explicitly requested.
  const columns =
    typeof options.columns === "number" ? Number(options.columns) : 1;
  const includeStandards = options.includeStandards !== false;
  const previewOnly = options.previewOnly === true;
  const scriptId = options.scriptId;
  const durationMin = options.durationMin || script.durationMin;
  const groupSize = options.groupSize || script.groupSize;
  const maxPages = Number(options.maxPages || 4);

  const pt = (n) => Math.round(Number(n) * 2); // docx uses half-points
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const scale = (n, k) => Math.round(Number(n) * k);

  function estimateContentLines(s) {
    // Heuristic: treat paragraphs/rows as "lines", plus text length contribution.
    const scenes = Array.isArray(s?.scenes) ? s.scenes : [];
    const keyTerms = Array.isArray(s?.key_terms) ? s.key_terms : [];
    const cast = Array.isArray(s?.cast) ? s.cast : [];
    const wrapQs = Array.isArray(s?.wrap_up?.questions)
      ? s.wrap_up.questions
      : [];
    const teacherTips = Array.isArray(s?.teacher_tips) ? s.teacher_tips : [];
    const lessonPts = Array.isArray(s?.lesson_points) ? s.lesson_points : [];
    const stageLines = scenes.reduce(
      (acc, sc) =>
        acc +
        (Array.isArray(sc?.stage_directions) ? sc.stage_directions.length : 0),
      0
    );
    const dialogueLines = scenes.reduce(
      (acc, sc) => acc + (Array.isArray(sc?.lines) ? sc.lines.length : 0),
      0
    );

    const textBits = [
      s?.narrator_setup,
      s?.situation_roles,
      keyTerms.map((t) => `${t?.term} ${t?.easy_def} ${t?.example}`).join(" "),
      cast
        .map((c) => `${c?.name} ${c?.description || c?.role_hint || ""}`)
        .join(" "),
      teacherTips.join(" "),
      lessonPts.join(" "),
      wrapQs.join(" "),
      s?.wrap_up?.writing_prompt,
      s?.extension_activity?.discussion,
      s?.extension_activity?.writing,
      (s?.curriculum?.standards || []).join(" "),
      (s?.curriculum?.keywords || []).join(" "),
    ]
      .filter(Boolean)
      .join(" ");

    const charLines = Math.ceil(textBits.length / 60); // rough
    const base =
      8 + // headings/spacing
      keyTerms.length * 3 +
      cast.length * 1.2 +
      wrapQs.length +
      teacherTips.length +
      lessonPts.length +
      stageLines * 0.9 +
      dialogueLines * 1.1 +
      charLines * 0.6;
    return Math.ceil(base);
  }

  function estimatePages(lines, colCount, capacityMultiplier) {
    const baseLinesPerPage = colCount === 2 ? 95 : 55;
    const cap = Math.round(baseLinesPerPage * (capacityMultiplier || 1));
    return lines / cap;
  }

  const contentLines = estimateContentLines(script);
  const profiles = [
    {
      name: "base",
      bodyPt: 11,
      headingPt: 12,
      h1Pt: 16,
      examplePt: 10,
      line: 276, // ~1.15-1.2
      spaceScale: 1,
      capacity: 1,
    },
    {
      name: "compact",
      bodyPt: 10,
      headingPt: 11,
      h1Pt: 15,
      examplePt: 9,
      line: 264,
      spaceScale: 0.86,
      capacity: 1.12,
    },
    {
      name: "tight",
      bodyPt: 9,
      headingPt: 10,
      h1Pt: 14,
      examplePt: 8.5,
      line: 252,
      spaceScale: 0.75,
      capacity: 1.26,
    },
  ];

  let profile = profiles[0];
  const est0 = estimatePages(contentLines, columns, profile.capacity);
  if (est0 > maxPages) {
    const est1 = estimatePages(contentLines, columns, profiles[1].capacity);
    profile = est1 <= maxPages ? profiles[1] : profiles[2];
  }
  const estFinal = estimatePages(contentLines, columns, profile.capacity);

  // 역할별 색상 매핑
  const cast = script.cast || [];
  const roleColorMap = {};
  cast.forEach((c, idx) => {
    const name = c.name || c.role_name;
    roleColorMap[name] = ROLE_COLORS[idx % ROLE_COLORS.length];
  });

  function toStringArray(v) {
    if (!v) return [];
    if (Array.isArray(v))
      return v.map((x) => String(x || "").trim()).filter(Boolean);
    if (typeof v === "string") {
      const s = v.trim();
      if (!s) return [];
      const parts = s.split(/\r?\n+/).map((x) => x.trim()).filter(Boolean);
      return parts.length ? parts : [s];
    }
    return [String(v).trim()].filter(Boolean);
  }

  function toLineObjects(v) {
    if (!v) return [];
    if (Array.isArray(v)) {
      return v
        .map((line) => {
          if (typeof line === "string") return { speaker: "", text: line };
          if (line && typeof line === "object") {
            return {
              speaker: typeof line.speaker === "string" ? line.speaker : "",
              text:
                typeof line.text === "string"
                  ? line.text
                  : String(line.text ?? ""),
            };
          }
          return { speaker: "", text: String(line ?? "") };
        })
        .filter((x) => String(x.text || "").trim());
    }
    if (typeof v === "string") {
      return v
        .split(/\r?\n+/)
        .map((t) => t.trim())
        .filter(Boolean)
        .map((t) => ({ speaker: "", text: t }));
    }
    return [{ speaker: "", text: String(v) }].filter((x) => x.text.trim());
  }

  function normScene(scene) {
    const sc = scene && typeof scene === "object" ? scene : {};
    return {
      ...sc,
      stage_directions: toStringArray(
        sc.stage_directions ?? sc.stageDirections ?? sc.stage_direction
      ),
      lines: toLineObjects(sc.lines),
    };
  }

  function getScenes(s) {
    const scenes = Array.isArray(s?.scenes) ? s.scenes : [];
    return scenes.map(normScene);
  }

  function normalizeStandards(input) {
    if (!input) return [];
    if (Array.isArray(input)) return input.map(String);
    if (typeof input === "string")
      return input
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
    return [];
  }

  const S = {
    h1: pt(profile.h1Pt),
    heading: pt(profile.headingPt),
    body: pt(profile.bodyPt),
    example: pt(profile.examplePt),
  };

  const SP = {
    // Keep existing values but scale down when compacting
    after50: scale(50, profile.spaceScale),
    after80: scale(80, profile.spaceScale),
    after100: scale(100, profile.spaceScale),
    after120: scale(120, profile.spaceScale),
    after200: scale(200, profile.spaceScale),
    before150: scale(150, profile.spaceScale),
    before200: scale(200, profile.spaceScale),
    before300: scale(300, profile.spaceScale),
  };

  const pageWarningNeeded = estFinal > maxPages;

  const previewChildren = [
    new Paragraph({
      text: topicTitle,
      heading: HeadingLevel.HEADING_1,
      spacing: { after: SP.after100, line: profile.line },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text:
            `${script.subject ? `과목: ${script.subject} | ` : ""}` +
            `학년: ${options.grade || script.grade || "-"}학년 | ` +
            `수업시간: ${durationMin || "-"}분 | 모둠 인원: ${
              groupSize || "-"
            }명`,
          italics: true,
          size: S.body,
        }),
      ],
      spacing: { after: SP.after200, line: profile.line },
    }),
    ...(typeof script?.header?.rationale === "string" &&
    script.header.rationale.trim()
      ? [
          new Paragraph({
            children: [
              new TextRun({
                text: `근거(성취요소 요약): ${script.header.rationale.trim()}`,
                italics: true,
                color: "64748B",
                size: S.example,
              }),
            ],
            spacing: { after: SP.after200, line: profile.line },
          }),
        ]
      : []),
    ...(typeof script?.header?.era === "string" && script.header.era.trim()
      ? [
          new Paragraph({
            children: [
              new TextRun({
                text: `시대: ${script.header.era.trim()}`,
                italics: true,
                color: "64748B",
                size: S.example,
              }),
            ],
            spacing: { after: SP.after200, line: profile.line },
          }),
        ]
      : []),
    new Paragraph({
      children: [new TextRun({ text: "▣ 대본", bold: true, size: S.heading })],
      spacing: { before: SP.before200, after: SP.after100, line: profile.line },
    }),
    ...getScenes(script).flatMap((scene) => [
      new Paragraph({
        children: [
          new TextRun({
            text: `[${scene.scene_title || "장면"}]`,
            bold: true,
            color: "000000",
          }),
        ],
        spacing: {
          before: SP.before150,
          after: SP.after80,
          line: profile.line,
        },
      }),
      ...(scene.stage_directions || []).slice(0, 2).map(
        (d) =>
          new Paragraph({
            children: [
              new TextRun({
                text: `(${d})`,
                italics: true,
                color: "475569",
                size: S.example,
              }),
            ],
            spacing: { after: SP.after80, line: profile.line },
          })
      ),
      ...(scene.lines || []).map((line) => {
        const speaker = (line.speaker || "").trim() || "화자 미정";
        const color = roleColorMap[line.speaker] || "111827";
        return new Paragraph({
          children: [
            new TextRun({
              text: `${speaker}: `,
              bold: true,
              color,
              size: S.body,
            }),
            new TextRun({ text: `${line.text || ""}`, size: S.body }),
          ],
          spacing: { after: SP.after120, line: profile.line },
        });
      }),
    ]),
    ...(includeStandards
      ? (() => {
          const standards = normalizeStandards(script.curriculum?.standards);
          const keywords = Array.isArray(script.curriculum?.keywords)
            ? script.curriculum.keywords.map(String)
            : typeof script.curriculum?.keywords === "string"
            ? [script.curriculum.keywords]
            : [];
          if (!standards.length && !keywords.length) return [];
          return [
            new Paragraph({
              children: [
                new TextRun({
                  text: "▣ 성취기준(근거)",
                  bold: true,
                  size: S.heading,
                }),
              ],
              spacing: {
                before: SP.before200,
                after: SP.after100,
                line: profile.line,
              },
            }),
            ...standards.map(
              (s) =>
                new Paragraph({
                  text: `• ${s}`,
                  spacing: { after: SP.after50, line: profile.line },
                })
            ),
            ...(keywords.length
              ? [
                  new Paragraph({
                    text: `핵심 키워드: ${keywords.join(", ")}`,
                    spacing: {
                      before: SP.after100,
                      after: SP.after200,
                      line: profile.line,
                    },
                  }),
                ]
              : []),
          ];
        })()
      : []),
  ];

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: "Malgun Gothic",
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: {
              orientation: PageOrientation.PORTRAIT,
            },
            margin: {
              top: 1134,
              bottom: 1134,
              left: 1134,
              right: 1134,
            },
          },
          column: {
            count: columns,
            space: 708,
          },
        },
        children: previewOnly
          ? previewChildren
          : [
              // 제목
              new Paragraph({
                text: topicTitle,
                heading: HeadingLevel.HEADING_1,
                spacing: { after: SP.after100, line: profile.line },
              }),

              // 메타 라인 추가 (학년 포함)
              new Paragraph({
                children: [
                  new TextRun({
                    text: `학년: ${
                      options.grade || script.grade || "-"
                    }학년 | 수업시간: ${durationMin || "-"}분 | 모둠 인원: ${
                      groupSize || "-"
                    }명`,
                    italics: true,
                    size: S.body,
                  }),
                ],
                spacing: { after: SP.after200, line: profile.line },
              }),

              ...(typeof script?.header?.rationale === "string" &&
              script.header.rationale.trim()
                ? [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: `근거(성취요소 요약): ${script.header.rationale.trim()}`,
                          italics: true,
                          color: "64748B",
                          size: S.example,
                        }),
                      ],
                      spacing: { after: SP.after200, line: profile.line },
                    }),
                  ]
                : []),

              ...(typeof script?.header?.era === "string" &&
              script.header.era.trim()
                ? [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: `시대: ${script.header.era.trim()}`,
                          italics: true,
                          color: "64748B",
                          size: S.example,
                        }),
                      ],
                      spacing: { after: SP.after200, line: profile.line },
                    }),
                  ]
                : []),

              ...(pageWarningNeeded
                ? [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: `※ 내용이 길어 A4 ${maxPages}쪽을 초과할 수 있습니다. (자동 맞춤 단계: ${profile.name})`,
                          italics: true,
                          color: "64748B",
                          size: S.example,
                        }),
                      ],
                      spacing: { after: SP.after200, line: profile.line },
                    }),
                  ]
                : []),

              // 상황 및 역할(해설)
              new Paragraph({
                children: [
                  new TextRun({
                    text: "▣ 상황 및 역할(해설)",
                    bold: true,
                    size: S.heading,
                  }),
                ],
                spacing: {
                  before: SP.before200,
                  after: SP.after100,
                  line: profile.line,
                },
              }),
              new Paragraph({
                text:
                  script.situation_roles ||
                  script.narrator_setup ||
                  "상황 설명이 없습니다.",
                spacing: { after: SP.after200, line: profile.line },
              }),

              // 핵심 용어 섹션 (v4 추가)
              ...(script.key_terms && script.key_terms.length > 0
                ? [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: "▣ 핵심 용어 살펴보기",
                          bold: true,
                          size: S.heading,
                        }),
                      ],
                      spacing: {
                        before: SP.before200,
                        after: SP.after100,
                        line: profile.line,
                      },
                    }),
                    new Table({
                      width: { size: 100, type: WidthType.PERCENTAGE },
                      rows: script.key_terms.map(
                        (t) =>
                          new TableRow({
                            children: [
                              new TableCell({
                                children: [
                                  new Paragraph({
                                    children: [
                                      new TextRun({
                                        text: `• ${t.term}`,
                                        bold: true,
                                        size: S.body,
                                      }),
                                      new TextRun({
                                        text: `: ${t.easy_def}`,
                                        size: S.body,
                                      }),
                                    ],
                                    spacing: {
                                      before: SP.after100,
                                      after: SP.after50,
                                      line: profile.line,
                                    },
                                  }),
                                  new Paragraph({
                                    children: [
                                      new TextRun({
                                        text: `  (예문) ${t.example}`,
                                        size: S.example,
                                        italics: true,
                                        color: "666666",
                                      }),
                                    ],
                                    spacing: {
                                      after: SP.after100,
                                      line: profile.line,
                                    },
                                  }),
                                ],
                                borders: {
                                  top: { style: BorderStyle.SINGLE, size: 1 },
                                  bottom: {
                                    style: BorderStyle.SINGLE,
                                    size: 1,
                                  },
                                  left: { style: BorderStyle.SINGLE, size: 1 },
                                  right: { style: BorderStyle.SINGLE, size: 1 },
                                },
                              }),
                            ],
                          })
                      ),
                    }),
                    new Paragraph({
                      text: "",
                      spacing: { after: SP.after200, line: profile.line },
                    }), // 간격용
                  ]
                : []),

              // 등장인물(역할) - 색상 적용 (역할명+설명 전체)
              new Paragraph({
                children: [
                  new TextRun({
                    text: "▣ 등장인물(역할)",
                    bold: true,
                    size: S.heading,
                  }),
                ],
                spacing: {
                  before: SP.before200,
                  after: SP.after100,
                  line: profile.line,
                },
              }),
              ...cast.map((c) => {
                const name = c.name || c.role_name;
                const color = roleColorMap[name] || "111827";
                const desc =
                  c.description ||
                  c.role_hint ||
                  [c.description, c.speech_tip].filter(Boolean).join(" / ") ||
                  "";
                return new Paragraph({
                  children: [
                    new TextRun({
                      text: `${name}: ${desc}`,
                      color: color,
                      size: S.body,
                    }),
                  ],
                  spacing: { after: SP.after50, line: profile.line },
                });
              }),

              // 대본(장면별)
              new Paragraph({
                children: [
                  new TextRun({ text: "▣ 대본", bold: true, size: S.heading }),
                ],
                spacing: {
                  before: SP.before200,
                  after: SP.after100,
                  line: profile.line,
                },
              }),
              ...getScenes(script).flatMap((scene) => [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `[${scene.scene_title || "장면"}]`,
                      bold: true,
                      color: "000000",
                      size: S.body,
                    }),
                  ],
                  spacing: {
                    before: SP.before150,
                    after: SP.after80,
                    line: profile.line,
                  },
                }),
                ...(scene.stage_directions || []).slice(0, 2).map(
                  (d) =>
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: `(${d})`,
                          italics: true,
                          color: "475569",
                          size: S.example,
                        }),
                      ],
                      spacing: { after: SP.after80, line: profile.line },
                    })
                ),
                ...(scene.lines || []).map((line) => {
                  const color = roleColorMap[line.speaker] || "111827";
                  return new Paragraph({
                    children: [
                      new TextRun({
                        text: `${line.speaker}: ${line.text || ""}`,
                        color: color,
                        size: S.body,
                      }),
                    ],
                    spacing: { after: SP.after120, line: profile.line },
                  });
                }),
              ]),

              // 수업 포인트
              new Paragraph({
                children: [
                  new TextRun({
                    text: "▣ 수업 포인트(해설)",
                    bold: true,
                    size: S.heading,
                  }),
                ],
                spacing: {
                  before: SP.before300,
                  after: SP.after100,
                  line: profile.line,
                },
              }),
              ...(() => {
                const pts = Array.isArray(script.lesson_points)
                  ? script.lesson_points
                  : null;
                if (pts && pts.length) {
                  return pts.slice(0, 3).map(
                    (p, idx) =>
                      new Paragraph({
                        text: `${idx + 1}. ${p}`,
                        spacing: {
                          after: idx === 2 ? SP.after200 : SP.after50,
                          line: profile.line,
                        },
                      })
                  );
                }
                return [
                  new Paragraph({
                    text: "1. 배역에 몰입하여 당시의 상황을 생생하게 표현해 봅시다.",
                    spacing: { after: SP.after50, line: profile.line },
                  }),
                  new Paragraph({
                    text: "2. 인물 간의 갈등 해결 방식에 주목하여 감상해 봅시다.",
                    spacing: { after: SP.after50, line: profile.line },
                  }),
                  new Paragraph({
                    text: "3. 대본의 내용을 바탕으로 오늘날의 가치를 찾아봅시다.",
                    spacing: { after: SP.after200, line: profile.line },
                  }),
                ];
              })(),

              // 교사용 지도 팁
              ...(Array.isArray(script.teacher_tips) &&
              script.teacher_tips.length
                ? [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: "▣ 교사용 지도 팁",
                          bold: true,
                          size: S.heading,
                        }),
                      ],
                      spacing: {
                        before: SP.before200,
                        after: SP.after100,
                        line: profile.line,
                      },
                    }),
                    ...script.teacher_tips.slice(0, 3).map(
                      (t, idx) =>
                        new Paragraph({
                          text: `${idx + 1}. ${t}`,
                          spacing: {
                            after: idx === 2 ? SP.after200 : SP.after50,
                            line: profile.line,
                          },
                        })
                    ),
                  ]
                : []),

              // 교육과정 성취기준 (조건부)
              ...(includeStandards
                ? [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: "▣ 관련 성취기준(요약)",
                          bold: true,
                          size: S.heading,
                        }),
                      ],
                      spacing: {
                        before: SP.before200,
                        after: SP.after100,
                        line: profile.line,
                      },
                    }),
                    ...(script.achievement_standards?.note ||
                    script.curriculum?.note
                      ? [
                          new Paragraph({
                            text:
                              script.achievement_standards?.note ||
                              script.curriculum?.note,
                            spacing: { after: SP.after50, line: profile.line },
                          }),
                        ]
                      : []),
                    ...(
                      script.achievement_standards?.standards ||
                      script.curriculum?.standards ||
                      []
                    ).map(
                      (s) =>
                        new Paragraph({
                          text: `• ${s}`,
                          spacing: { after: SP.after50, line: profile.line },
                        })
                    ),
                    new Paragraph({
                      text: `핵심 키워드: ${(
                        script.achievement_standards?.keywords ||
                        script.curriculum?.keywords ||
                        []
                      ).join(", ")}`,
                      spacing: {
                        before: SP.after100,
                        after: SP.after200,
                        line: profile.line,
                      },
                    }),
                  ]
                : []),

              // 마무리 질문
              new Paragraph({
                children: [
                  new TextRun({
                    text: "▣ 마무리 질문",
                    bold: true,
                    size: S.heading,
                  }),
                ],
                spacing: {
                  before: SP.before200,
                  after: SP.after100,
                  line: profile.line,
                },
              }),
              ...(script.wrap_up_questions || script.wrap_up?.questions || [])
                .slice(0, 3)
                .map(
                  (q) =>
                    new Paragraph({
                      text: `Q. ${q}`,
                      spacing: { after: SP.after50, line: profile.line },
                    })
                ),
              ...(script.extension_activity?.discussion
                ? [
                    new Paragraph({
                      text: `[확장 토론] ${script.extension_activity.discussion}`,
                      spacing: {
                        before: SP.after100,
                        after: SP.after50,
                        line: profile.line,
                      },
                    }),
                  ]
                : []),
              ...(script.extension_activity?.writing
                ? [
                    new Paragraph({
                      text: `[확장 글쓰기] ${script.extension_activity.writing}`,
                      spacing: { after: SP.after100, line: profile.line },
                    }),
                  ]
                : script.wrap_up?.writing_prompt
                ? [
                    new Paragraph({
                      text: `[글쓰기 과제] ${script.wrap_up.writing_prompt}`,
                      spacing: {
                        before: SP.after100,
                        after: SP.after100,
                        line: profile.line,
                      },
                    }),
                  ]
                : []),
            ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return { buffer, filename: sanitizeFilename(topicTitle, scriptId) };
}
