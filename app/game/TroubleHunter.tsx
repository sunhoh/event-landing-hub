"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { type Prize, PRIZES } from "../_lib/prizes";
import { WIN_HOLD_HOURS } from "../_lib/event";
import { CountdownInline, usePersonalDeadline } from "../_components/Countdown";

// ─── Config ──────────────────────────────────────────────────────────────────

const GAME_MS = 30_000;
const FEVER_MS = 5_000;               // 마지막 5초 피버타임
const HOLES = 9;
const HIT_FX_MS = 220;                // 맞힌 뒤 터지는 이펙트 유지 시간
const BEST_KEY = "gu-game:best";

type Kind = "acne" | "pore" | "spot" | "golden" | "water";

// life: [게임 시작 시, 게임 끝날 때] 노출 시간(ms) — 점점 빨라짐
const KINDS: Record<Kind, { label: string; points: number; weight: number; life: [number, number] }> = {
  acne:   { label: "여드름",          points: 10,  weight: 40, life: [1150, 700] },
  pore:   { label: "모공",            points: 10,  weight: 25, life: [1150, 700] },
  spot:   { label: "잡티",            points: 15,  weight: 18, life: [850, 520]  },
  golden: { label: "골든 피부",       points: 50,  weight: 4,  life: [650, 550]  },
  water:  { label: "수분 방울 (함정)", points: -20, weight: 13, life: [1300, 1000] },
};
const KIND_LIST = Object.keys(KINDS) as Kind[];
const KIND_TOTAL = KIND_LIST.reduce((s, k) => s + KINDS[k].weight, 0);

// 점수 컷은 플레이테스트 후 조정
const GRADES = [
  { min: 900, grade: "S", title: "트러블 킬러",          color: "#E8A800", prizeEmoji: "⭐" },
  { min: 600, grade: "A", title: "레이저 손놀림",        color: "#C5856A", prizeEmoji: "💎" },
  { min: 350, grade: "B", title: "꽤 하는데요?",         color: "#D9967A", prizeEmoji: "🧴" },
  { min: 0,   grade: "C", title: "트러블이 조금 이겼어요", color: "#9A9AA0", prizeEmoji: "✨" },
];

const gradeOf = (score: number) => GRADES.find((g) => score >= g.min)!;
const prizeOf = (score: number): Prize => PRIZES.find((p) => p.emoji === gradeOf(score).prizeEmoji)!;
const multOf = (combo: number) => (combo >= 10 ? 2 : combo >= 5 ? 1.5 : 1);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function randomKind(): Kind {
  let r = Math.random() * KIND_TOTAL;
  for (const k of KIND_LIST) {
    r -= KINDS[k].weight;
    if (r < 0) return k;
  }
  return "acne";
}

type Phase = "intro" | "ready" | "play" | "result";

interface Mole { id: number; kind: Kind; until: number; hit: boolean }
interface Pop { id: number; hole: number; text: string; bad: boolean }
interface Stats { score: number; hits: number; misses: number; traps: number; maxCombo: number }

const EMPTY_STATS: Stats = { score: 0, hits: 0, misses: 0, traps: 0, maxCombo: 0 };

// ─── Trouble visuals (이미지 대신 CSS) ────────────────────────────────────────

function TroubleIcon({ kind }: { kind: Kind }) {
  switch (kind) {
    case "acne":
      return (
        <span
          className="block w-full h-full rounded-full"
          style={{
            background: "radial-gradient(circle at 50% 42%, #FFF6E8 0 11%, #F28B73 22%, #D9493A 62%, #B5362A 100%)",
            boxShadow: "0 4px 8px rgba(181,54,42,0.35)",
          }}
        />
      );
    case "pore":
      return (
        <span
          className="block w-[88%] h-[88%] rounded-full"
          style={{ background: "radial-gradient(circle, #3E241B 0 26%, #6E4232 38%, #B98068 64%, rgba(185,128,104,0) 72%)" }}
        />
      );
    case "spot":
      return (
        <span
          className="block w-[82%] h-[70%]"
          style={{
            borderRadius: "48% 52% 44% 56% / 55% 45% 55% 45%",
            background: "radial-gradient(circle at 40% 40%, #9C6342, #7B4A30 70%)",
            opacity: 0.9,
          }}
        />
      );
    case "golden":
      return (
        <span
          className="flex items-center justify-center w-full h-full rounded-full text-[28px]"
          style={{
            background: "radial-gradient(circle at 40% 35%, #FFF7C2, #F5C542 55%, #D9A21B)",
            boxShadow: "0 0 18px 4px rgba(245,197,66,0.75)",
          }}
        >
          ✨
        </span>
      );
    case "water":
      return (
        <span
          className="flex items-center justify-center w-full h-full rounded-full text-[30px]"
          style={{ background: "radial-gradient(circle at 40% 35%, #F2FBFF, #BFE6FA 60%, #8CCFF0)", boxShadow: "0 4px 10px rgba(80,170,220,0.35)" }}
        >
          💧
        </span>
      );
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function useCountUp(target: number, run: boolean, dur = 1100) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!run) return;
    let start: number | null = null;
    let raf = 0;
    const tick = (ts: number) => {
      start ??= ts;
      const p = Math.min((ts - start) / dur, 1);
      setV(Math.round((1 - Math.pow(1 - p, 3)) * target));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, run, dur]);
  return v;
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function TroubleHunter() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [readyCount, setReadyCount] = useState(3);
  const [holes, setHoles] = useState<(Mole | null)[]>(() => Array(HOLES).fill(null));
  const [pops, setPops] = useState<Pop[]>([]);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_MS / 1000);
  const [fever, setFever] = useState(false);
  const [result, setResult] = useState<Stats>(EMPTY_STATS);
  const [best, setBest] = useState(0);
  const [newBest, setNewBest] = useState(false);
  const [challenge, setChallenge] = useState<number | null>(null);
  const [plays, setPlays] = useState(0);

  // 게임 루프에서 쓰는 실제 값 (state는 화면 표시용)
  const holesRef = useRef<(Mole | null)[]>(Array(HOLES).fill(null));
  const stats = useRef<Stats>({ ...EMPTY_STATS });
  const comboRef = useRef(0);
  const idRef = useRef(0);
  const bestRef = useRef(0);
  const boardRef = useRef<HTMLDivElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const deadline = usePersonalDeadline("game", WIN_HOLD_HOURS, plays > 0);

  // 최고 기록 + 도전장(?vs=점수) 읽기
  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(BEST_KEY));
      if (saved > 0) { bestRef.current = saved; setBest(saved); }
    } catch {}
    const vs = Number(new URLSearchParams(location.search).get("vs"));
    if (Number.isFinite(vs) && vs > 0 && vs < 100_000) setChallenge(Math.round(vs));
    return () => timers.current.forEach(clearTimeout);
  }, []);

  const later = (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms));

  // ── Start / Ready ──
  const start = () => {
    holesRef.current = Array(HOLES).fill(null);
    stats.current = { ...EMPTY_STATS };
    comboRef.current = 0;
    setHoles(holesRef.current);
    setPops([]);
    setScore(0);
    setCombo(0);
    setFever(false);
    setTimeLeft(GAME_MS / 1000);
    setReadyCount(3);
    setPhase("ready");
    window.scrollTo({ top: 0, behavior: "instant" });
    later(() => setReadyCount(2), 700);
    later(() => setReadyCount(1), 1400);
    later(() => setPhase("play"), 2100);
  };

  const finish = useCallback(() => {
    const s = { ...stats.current };
    setResult(s);
    setPlays((n) => n + 1);
    const isNew = s.score > bestRef.current;
    setNewBest(isNew);
    if (isNew) {
      bestRef.current = s.score;
      setBest(s.score);
      try { localStorage.setItem(BEST_KEY, String(s.score)); } catch {}
    }
    setPhase("result");
    if (navigator.vibrate) navigator.vibrate([40, 30, 80]);
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  // ── Game loop ──
  useEffect(() => {
    if (phase !== "play") return;
    const startAt = performance.now();
    let lastSpawn = -Infinity;
    let raf = 0;

    const loop = (t: number) => {
      const elapsed = t - startAt;
      const left = GAME_MS - elapsed;
      if (left <= 0) {
        holesRef.current = Array(HOLES).fill(null);
        setHoles(holesRef.current);
        finish();
        return;
      }

      const p = elapsed / GAME_MS;
      const isFever = left <= FEVER_MS;
      setTimeLeft(Math.ceil(left / 1000));
      setFever(isFever);

      const h = holesRef.current;
      let changed = false;

      // 만료 처리 — 못 잡은 트러블은 콤보 끊김
      for (let i = 0; i < HOLES; i++) {
        const m = h[i];
        if (m && t >= m.until) {
          if (!m.hit && m.kind !== "water") {
            stats.current.misses++;
            comboRef.current = 0;
            setCombo(0);
          }
          h[i] = null;
          changed = true;
        }
      }

      // 스폰 — 갈수록 빠르고 많이
      const interval = isFever ? 420 : lerp(760, 400, p);
      const maxActive = isFever ? 5 : p < 0.5 ? 3 : 4;
      if (t - lastSpawn >= interval) {
        lastSpawn = t;
        const n = isFever ? 2 : 1;
        for (let k = 0; k < n; k++) {
          const free = h.map((m, i) => (m ? -1 : i)).filter((i) => i >= 0);
          if (free.length === 0 || HOLES - free.length >= maxActive) break;
          const idx = free[Math.floor(Math.random() * free.length)];
          const kind = randomKind();
          const [l0, l1] = KINDS[kind].life;
          h[idx] = { id: ++idRef.current, kind, until: t + lerp(l0, l1, p), hit: false };
          changed = true;
        }
      }

      if (changed) setHoles([...h]);
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phase, finish]);

  // ── Tap ──
  const tap = (i: number) => {
    if (phase !== "play") return;
    const m = holesRef.current[i];
    if (!m || m.hit) return;

    const def = KINDS[m.kind];
    const s = stats.current;
    let gained: number;

    if (m.kind === "water") {
      gained = def.points;
      s.traps++;
      comboRef.current = 0;
      boardRef.current?.animate(
        [{ transform: "translateX(0)" }, { transform: "translateX(-8px)" }, { transform: "translateX(8px)" }, { transform: "translateX(-4px)" }, { transform: "translateX(0)" }],
        { duration: 280, easing: "ease-in-out" }
      );
      if (navigator.vibrate) navigator.vibrate(120);
    } else {
      comboRef.current++;
      s.hits++;
      s.maxCombo = Math.max(s.maxCombo, comboRef.current);
      gained = Math.round(def.points * multOf(comboRef.current));
      if (navigator.vibrate) navigator.vibrate(12);
    }

    s.score = Math.max(0, s.score + gained);
    setScore(s.score);
    setCombo(comboRef.current);

    holesRef.current[i] = { ...m, hit: true, until: performance.now() + HIT_FX_MS };
    setHoles([...holesRef.current]);

    const pop: Pop = { id: m.id, hole: i, text: gained > 0 ? `+${gained}` : `${gained}`, bad: gained < 0 };
    setPops((prev) => [...prev, pop]);
    later(() => setPops((prev) => prev.filter((x) => x.id !== pop.id)), 650);
  };

  // ── Share (도전장) ──
  const share = () => {
    const url = `${location.origin}${location.pathname}?vs=${best}`;
    const text = `트러블 헌터 30초 챌린지 ${gradeOf(best).grade}등급 🏆\n내 점수 ${best}점, 넌 이길 수 있어?`;
    if (navigator.share) {
      navigator.share({ title: "트러블 헌터 도전장", text, url });
    } else {
      navigator.clipboard.writeText(`${text}\n${url}`).then(() => alert("도전장 링크가 복사됐어요! 친구에게 보내보세요 🔥"));
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  if (phase === "intro") {
    return <Intro best={best} challenge={challenge} onStart={start} />;
  }

  if (phase === "result") {
    return (
      <Result
        stats={result}
        best={best}
        newBest={newBest}
        challenge={challenge}
        deadline={deadline}
        onRetry={start}
        onShare={share}
      />
    );
  }

  const mult = multOf(combo);

  return (
    <div className="max-w-md mx-auto px-5 pt-6 pb-10 min-h-screen select-none">
      {/* HUD */}
      <div className="flex items-end justify-between mb-3">
        <div>
          <p className="text-[11px] font-bold text-[#8E8E93] tracking-wider">SCORE</p>
          <p className="text-[34px] font-extrabold leading-none tabular-nums">{score}</p>
        </div>
        <div className="text-center h-[42px] flex flex-col justify-end">
          {combo >= 2 && (
            <>
              <p className="text-[11px] font-bold text-[#C5856A]">{combo} COMBO</p>
              {mult > 1 && <p className="text-lg font-extrabold text-[#C5856A] leading-none">×{mult}</p>}
            </>
          )}
        </div>
        <div className="text-right">
          <p className={`text-[11px] font-bold tracking-wider ${fever ? "text-[#FF3B30]" : "text-[#8E8E93]"}`}>
            {fever ? "🔥 FEVER" : "TIME"}
          </p>
          <p className={`text-[34px] font-extrabold leading-none tabular-nums ${fever ? "text-[#FF3B30]" : ""}`}>{timeLeft}</p>
        </div>
      </div>

      {/* Time bar */}
      <div className="h-2 bg-[#F0EDE8] rounded-full overflow-hidden mb-5">
        <div
          className={`h-full rounded-full ${fever ? "bg-[#FF3B30]" : "bg-[#C5856A]"}`}
          style={{ width: `${(timeLeft / (GAME_MS / 1000)) * 100}%`, transition: "width 1s linear" }}
        />
      </div>

      {/* Skin board */}
      <div
        ref={boardRef}
        className="relative rounded-[32px] p-4"
        style={{ background: "linear-gradient(160deg, #FBE6DA, #F3CBB5)", touchAction: "manipulation" }}
      >
        <div className="grid grid-cols-3 gap-3">
          {holes.map((m, i) => (
            <button
              key={i}
              onPointerDown={() => tap(i)}
              aria-label={`${i + 1}번 칸`}
              className="relative aspect-square rounded-full"
              style={{ background: "radial-gradient(circle, rgba(201,140,112,0.32), rgba(201,140,112,0.12) 70%)", boxShadow: "inset 0 3px 8px rgba(150,90,60,0.18)" }}
            >
              {m && (
                <span
                  key={m.id}
                  className={`absolute inset-[12%] flex items-center justify-center ${m.hit ? "animate-[burst_220ms_ease-out_forwards]" : "animate-[pop-in_180ms_ease-out]"}`}
                >
                  <TroubleIcon kind={m.kind} />
                </span>
              )}
              {m?.hit && m.kind !== "water" && (
                <span className="pointer-events-none absolute inset-0 rounded-full border-4 border-[#7FE3FF] animate-[laser-ring_260ms_ease-out_forwards]" />
              )}
              {pops.filter((p) => p.hole === i).map((p) => (
                <span
                  key={p.id}
                  className={`pointer-events-none absolute left-1/2 top-1 text-lg font-extrabold animate-[float-up_650ms_ease-out_forwards] ${p.bad ? "text-[#3A8FD9]" : "text-[#C5856A]"}`}
                  style={{ textShadow: "0 1px 0 #fff, 0 0 6px #fff" }}
                >
                  {p.text}
                </span>
              ))}
            </button>
          ))}
        </div>

        {/* 피버 테두리 — 보드 자체에 pulse 걸면 트러블까지 흐려져서 별도 레이어 */}
        {fever && <div className="pointer-events-none absolute -inset-1 rounded-[36px] border-4 border-[#FF3B30] animate-pulse" />}

        {/* 3·2·1 */}
        {phase === "ready" && (
          <div className="absolute inset-0 flex items-center justify-center rounded-[32px] bg-white/40 backdrop-blur-[2px]">
            <span key={readyCount} className="text-[96px] font-extrabold text-[#C5856A] animate-[count-pop_700ms_ease-out_forwards]">
              {readyCount}
            </span>
          </div>
        )}
      </div>

      <p className="text-center text-[13px] text-[#8E8E93] mt-5 break-keep">
        트러블을 톡! 💧 수분 방울은 건드리지 마세요
      </p>
    </div>
  );
}

// ─── Intro ───────────────────────────────────────────────────────────────────

function Intro({ best, challenge, onStart }: { best: number; challenge: number | null; onStart: () => void }) {
  return (
    <div className="max-w-md mx-auto px-5 pt-12 pb-14 min-h-screen">
      <div className="text-center mb-7">
        <span className="inline-block bg-[#FEF3ED] text-[#C5856A] text-sm font-semibold px-4 py-1.5 rounded-full mb-5">
          지유의원 강남 × 수능 특가
        </span>
        <h1 className="text-[32px] font-extrabold leading-[1.28] tracking-tight mb-3 break-keep">
          수능 동안 쌓인 트러블,<br />
          30초 안에 없애봐! ⚡
        </h1>
        <p className="text-[#8E8E93] text-[15px] break-keep">점수가 높을수록 더 좋은 쿠폰을 받아요</p>
      </div>

      {challenge !== null && (
        <div className="bg-[#1C1C1E] text-white rounded-2xl p-4 text-center mb-5">
          <p className="text-[13px] opacity-75 mb-0.5">🔥 친구가 도전장을 보냈어요</p>
          <p className="text-lg font-extrabold">{challenge}점을 넘어봐!</p>
        </div>
      )}

      {/* How to */}
      <div className="bg-white border border-[#F0EDE8] rounded-2xl p-4 mb-4">
        <p className="text-xs font-bold text-[#8E8E93] mb-3 text-center">이렇게 해요</p>
        <ul className="grid grid-cols-2 gap-x-3 gap-y-3">
          {KIND_LIST.map((k) => (
            <li key={k} className={`flex items-center gap-2.5 ${k === "water" ? "col-span-2 justify-center bg-[#F0F8FD] rounded-xl py-2" : ""}`}>
              <span className="w-9 h-9 flex items-center justify-center shrink-0 [&>span]:text-[18px]">
                <TroubleIcon kind={k} />
              </span>
              <span>
                <span className="block text-[13px] font-semibold">{KINDS[k].label}</span>
                <span className={`block text-[13px] font-extrabold ${KINDS[k].points < 0 ? "text-[#3A8FD9]" : "text-[#C5856A]"}`}>
                  {KINDS[k].points > 0 ? `+${KINDS[k].points}` : KINDS[k].points}점
                </span>
              </span>
            </li>
          ))}
        </ul>
        <p className="text-[12px] text-[#8E8E93] text-center mt-3 break-keep">
          연속으로 잡으면 콤보 ×1.5 → ×2 · 마지막 5초는 🔥피버타임
        </p>
      </div>

      {/* Grades */}
      <div className="bg-white border border-[#F0EDE8] rounded-2xl p-4 mb-6">
        <p className="text-xs font-bold text-[#8E8E93] mb-3 text-center">등급별 쿠폰</p>
        <ul className="flex flex-col gap-2">
          {GRADES.map((g) => {
            const p = PRIZES.find((x) => x.emoji === g.prizeEmoji)!;
            return (
              <li key={g.grade} className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-full text-white text-sm font-extrabold flex items-center justify-center shrink-0" style={{ background: g.color }}>
                  {g.grade}
                </span>
                <span className="text-[12px] text-[#8E8E93] w-14 shrink-0 tabular-nums">{g.min > 0 ? `${g.min}점+` : "누구나"}</span>
                <span className="flex-1 text-[13px] font-semibold truncate">{p.name}</span>
                <span className="text-[13px] font-extrabold text-[#C5856A] shrink-0">{p.price}</span>
              </li>
            );
          })}
        </ul>
      </div>

      <button
        onClick={onStart}
        className="w-full bg-[#C5856A] hover:bg-[#B07050] active:scale-[0.98] text-white font-bold text-lg py-[18px] rounded-2xl transition-all"
      >
        게임 시작 ▶
      </button>
      {best > 0 && <p className="text-center text-sm text-[#8E8E93] mt-3">내 최고 기록 <b className="text-[#C5856A]">{best}점</b></p>}

      <p className="text-center text-xs text-[#8E8E93] mt-8">지유의원 강남 · 피부과 전문의 직접 시술</p>
    </div>
  );
}

// ─── Result ──────────────────────────────────────────────────────────────────

function Result({
  stats,
  best,
  newBest,
  challenge,
  deadline,
  onRetry,
  onShare,
}: {
  stats: Stats;
  best: number;
  newBest: boolean;
  challenge: number | null;
  deadline: number | null;
  onRetry: () => void;
  onShare: () => void;
}) {
  const shown = useCountUp(stats.score, true);
  const g = gradeOf(stats.score);
  const bestGrade = gradeOf(best);
  const prize = prizeOf(best);

  return (
    <div className="max-w-md mx-auto px-5 pt-10 pb-14 min-h-screen">
      {/* Score */}
      <div className="text-center mb-6">
        <p className="text-sm font-bold text-[#8E8E93] mb-3">게임 종료!</p>
        <div
          className="w-28 h-28 mx-auto rounded-full flex items-center justify-center text-white text-[56px] font-extrabold mb-3 shadow-lg animate-[pop-in_400ms_ease-out]"
          style={{ background: g.color }}
        >
          {g.grade}
        </div>
        <p className="text-[44px] font-extrabold leading-none tabular-nums mb-1">{shown}<span className="text-xl text-[#8E8E93] ml-1">점</span></p>
        {newBest && <span className="inline-block bg-[#FF3B30] text-white text-[11px] font-bold px-2 py-0.5 rounded-md mb-1">NEW BEST</span>}
        <p className="text-lg font-bold mt-1">{g.title}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        {[
          { l: "없앤 트러블", v: `${stats.hits}개` },
          { l: "최대 콤보", v: `${stats.maxCombo}` },
          { l: "수분 터치", v: `${stats.traps}번` },
        ].map((x) => (
          <div key={x.l} className="bg-white border border-[#F0EDE8] rounded-xl py-3 text-center">
            <p className="text-[11px] text-[#8E8E93] mb-0.5">{x.l}</p>
            <p className="text-lg font-extrabold">{x.v}</p>
          </div>
        ))}
      </div>

      {challenge !== null && (
        <div className={`rounded-2xl p-4 text-center mb-5 ${stats.score > challenge ? "bg-[#1C1C1E] text-white" : "bg-[#F0EDE8]"}`}>
          {stats.score > challenge ? (
            <p className="font-extrabold">🎉 친구 점수 {challenge}점을 이겼어요!</p>
          ) : (
            <p className="font-bold text-[#1C1C1E]">친구 점수 {challenge}점까지 {challenge - stats.score + 1}점 남았어요 😤</p>
          )}
        </div>
      )}

      {/* Retry */}
      <button
        onClick={onRetry}
        className="w-full bg-[#1C1C1E] active:scale-[0.98] text-white font-bold text-lg py-[18px] rounded-2xl transition-all mb-2"
      >
        🔄 다시 도전하기
      </button>
      <p className="text-center text-[12px] text-[#8E8E93] mb-7 break-keep">최고 기록으로 쿠폰이 자동 업그레이드돼요</p>

      {/* Coupon (최고 기록 기준) */}
      <div className="bg-white border-2 border-[#C5856A] rounded-2xl p-5 text-center mb-4 shadow-sm">
        <p className="text-xs text-[#8E8E93] mb-1.5">
          최고 기록 {best}점 · <b style={{ color: bestGrade.color }}>{bestGrade.grade}등급</b> 쿠폰
        </p>
        <span className="inline-block bg-[#FEF3ED] text-[#C5856A] text-[11px] font-bold px-2 py-0.5 rounded-md mb-2">{prize.tag}</span>
        <p className="text-[20px] font-extrabold break-keep">{prize.name}</p>
        <p className="text-[13px] text-[#8E8E93] mt-0.5 mb-2 break-keep">{prize.desc}</p>
        <p className="text-[32px] font-extrabold text-[#C5856A] leading-none">{prize.price}</p>
      </div>

      <div className="rounded-2xl p-4 text-center text-white mb-5" style={{ background: "linear-gradient(135deg, #C5856A, #D4A090)" }}>
        <p className="text-[15px] font-extrabold mb-0.5">수험표 지참 시 쿠폰가 적용</p>
        <p className="text-[12px] opacity-85">2026.11.13 ~ 12.31 · 1인 1회</p>
        <CountdownInline deadline={deadline} label="쿠폰 소멸까지" className="mt-3 bg-white/20 text-white text-[13px] font-semibold px-3 py-1.5 rounded-full" />
      </div>

      <a href="#" className="block w-full bg-[#C5856A] hover:bg-[#B07050] text-white text-center font-bold text-lg py-[18px] rounded-2xl transition-all mb-3">
        쿠폰가로 예약하기
      </a>
      <a href="#" className="block w-full bg-[#FEE500] text-[#1C1C1E] text-center font-bold text-lg py-[18px] rounded-2xl transition-all mb-3">
        💬 카카오 상담하기
      </a>
      <button
        onClick={onShare}
        className="w-full border border-[#F0EDE8] text-[#8E8E93] font-semibold text-[15px] py-4 rounded-2xl hover:border-[#C5856A] hover:text-[#C5856A] transition-all"
      >
        ⚔️ 친구에게 도전장 보내기
      </button>

      <p className="text-center text-xs text-[#8E8E93] mt-8">지유의원 강남 · 피부과 전문의 직접 시술</p>
    </div>
  );
}
