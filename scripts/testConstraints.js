import { makeCharacterList } from "../services/characterList.js";
import { extractSpeakers, repairScript, validateAll } from "../services/scriptConstraints.js";
import { getMaxSentences } from "../services/gradeRules.js";

function makeEmptyScript({ scenesCount } = {}) {
  const scenes = [];
  for (let i = 0; i < (scenesCount || 3); i++) {
    scenes.push({ scene_title: `장면 ${i + 1}`, stage_directions: [], lines: [] });
  }
  return {
    header: { title: "테스트", subject: "국어", grade: 1, duration_min: 20, group_size: 12 },
    script: { scenes },
  };
}

function logCase(name, res, list, scenesCount) {
  const speakers = extractSpeakers(res);
  const v = validateAll({ script: res, characterList: list, scenesCount, gradeBand: "LOW", grade: 1 });
  console.log(`\n[${name}]`);
  console.log(`- expected chars: ${list.length}, unique speakers: ${speakers.length}`);
  console.log(`- missing: ${v.speaker?.missingSpeakers?.length || 0}, unknown: ${v.speaker?.unknownSpeakers?.length || 0}`);
  console.log(`- scenes expected=${scenesCount}, actual=${v.actualScenes}`);
  console.log(`- ok=${v.ok}`);
  if (!v.ok) console.log(`- details=`, JSON.stringify(v.details, null, 2));
}

// 1) characters=12, scenes=8, grade=1, model returns only 2 speakers -> repair must make 12
{
  const scenesCount = 8;
  const characterList = makeCharacterList({ count: 12, gradeBand: "LOW", seed: "case1" });
  const script = makeEmptyScript({ scenesCount });
  // only 2 speakers talk
  script.script.scenes[0].lines.push({ speaker: characterList[0], text: "안녕! 오늘 뭐 할까? 같이 하자!" }); // too many sentences for LOW
  script.script.scenes[0].lines.push({ speaker: characterList[1], text: "나도 안녕! 좋아!" });
  const repaired = repairScript({ script, characterList, scenesCount, gradeBand: "LOW", grade: 1 });
  logCase("case1_repair_12chars_8scenes_grade1", repaired.script, characterList, scenesCount);
  console.log(`- repaired=${repaired.repaired}, notes=${repaired.repairNotes.length}`);

  // Ensure each line has <= maxSentences for LOW (1)
  const maxS = getMaxSentences({ gradeBand: "LOW", grade: 1 });
  const scenes = repaired.script?.script?.scenes || [];
  const bad = [];
  const count = (t) =>
    String(t || "")
      .trim()
      .split(/[.!?。！？]/)
      .map((x) => x.trim())
      .filter(Boolean).length || 1;
  scenes.forEach((sc) =>
    (sc.lines || []).forEach((ln) => {
      if (count(ln.text) > maxS) bad.push({ speaker: ln.speaker, text: ln.text });
    })
  );
  console.log(`- sentence_limit_ok=${bad.length === 0} (maxSentences=${maxS})`);
}

// 2) characters=5, scenes=3, grade=4 already ok
{
  const scenesCount = 3;
  const characterList = makeCharacterList({ count: 5, gradeBand: "MID", seed: "case2" });
  const script = makeEmptyScript({ scenesCount });
  script.header.grade = 4;
  script.script.scenes[0].lines.push({ speaker: characterList[0], text: "좋아, 시작하자." });
  script.script.scenes[0].lines.push({ speaker: characterList[1], text: "나는 이렇게 생각해." });
  script.script.scenes[1].lines.push({ speaker: characterList[2], text: "왜냐하면 이유가 있어." });
  script.script.scenes[2].lines.push({ speaker: characterList[3], text: "그럼 이렇게 하자." });
  script.script.scenes[2].lines.push({ speaker: characterList[4], text: "좋아!" });

  const v = validateAll({ script, characterList, scenesCount, gradeBand: "MID", grade: 4 });
  console.log(`\n[case2_ok_5chars_3scenes_grade4] ok=${v.ok} unique=${extractSpeakers(script).length}`);
}

// 3) unknown speaker appears + missing speakers -> repair should map unknown + insert missing round-robin
{
  const scenesCount = 4;
  const characterList = makeCharacterList({ count: 6, gradeBand: "LOW", seed: "case3" });
  const script = makeEmptyScript({ scenesCount });
  script.script.scenes[0].lines.push({ speaker: "내레이터", text: "설명" }); // illegal speaker
  script.script.scenes[0].lines.push({ speaker: characterList[0], text: "좋아!" });
  const repaired = repairScript({ script, characterList, scenesCount, gradeBand: "LOW", grade: 1 });
  logCase("case3_unknown_speaker_and_missing", repaired.script, characterList, scenesCount);
  console.log(`- repaired=${repaired.repaired}, notes_sample=${JSON.stringify(repaired.repairNotes.slice(0,2))}`);
}


