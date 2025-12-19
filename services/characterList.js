/**
 * Deterministic character list generator (One Source of Truth)
 * - Server generates the canonical list and passes it to the model.
 * - Model must not introduce any other speaker names.
 */

const NAME_POOL_LOW = [
  "민지",
  "준호",
  "서연",
  "지우",
  "현우",
  "수아",
  "민수",
  "지민",
  "서준",
  "예린",
  "하준",
  "유진",
  "도윤",
  "아린",
  "지훈",
  "수민",
  "윤서",
  "시우",
];

const NAME_POOL_MID = [
  "민준",
  "서연",
  "지훈",
  "수민",
  "현우",
  "예린",
  "도윤",
  "하린",
  "서준",
  "지우",
  "유진",
  "태윤",
  "나연",
  "시우",
  "지민",
  "민지",
  "준호",
  "아린",
];

const NAME_POOL_HIGH = [
  "민준",
  "서연",
  "지훈",
  "수민",
  "현우",
  "예린",
  "도윤",
  "하린",
  "서준",
  "지우",
  "유진",
  "태윤",
  "나연",
  "시우",
  "지민",
  "민지",
  "준호",
  "아린",
];

function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(str) {
  const s = String(str || "");
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function makeCharacterList({
  count,
  gradeBand,
  seed,
} = {}) {
  const n = Math.max(3, Math.min(12, Number(count || 0) || 5));
  const band = gradeBand === "LOW" || gradeBand === "HIGH" ? gradeBand : "MID";
  const pool =
    band === "LOW" ? NAME_POOL_LOW : band === "HIGH" ? NAME_POOL_HIGH : NAME_POOL_MID;
  const rnd = mulberry32(hashSeed(seed || "default"));

  // Shuffle (stable per seed)
  const arr = pool.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }

  // Take first N unique
  const list = [];
  const seen = new Set();
  for (const name of arr) {
    if (seen.has(name)) continue;
    seen.add(name);
    list.push(name);
    if (list.length >= n) break;
  }

  // Fallback if pool too small (shouldn't happen)
  while (list.length < n) list.push(`학생${list.length + 1}`);

  return list;
}


