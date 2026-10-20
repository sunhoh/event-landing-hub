"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { type Prize, PRIZES, shuffle } from "../_lib/prizes";
import { WIN_HOLD_HOURS } from "../_lib/event";
import { CountdownInline, usePersonalDeadline } from "../_components/Countdown";

// ─── Config ──────────────────────────────────────────────────────────────────

// 단계별 카드 수 / 제한시간 / 열 수 / 미리보기(초) / 닮은꼴 그림 그룹 수
// 시뮬레이션 기준: 보통 실력 16장 클리어 ~75%, 24장 ~17%, 40장은 상위권만
const STAGES = [
  { cards: 4,  seconds: 10, cols: 2, preview: 3, lookalikes: 0 },
  { cards: 8,  seconds: 20, cols: 4, preview: 3, lookalikes: 0 },
  { cards: 16, seconds: 40, cols: 4, preview: 2, lookalikes: 0 },
  { cards: 24, seconds: 55, cols: 4, preview: 2, lookalikes: 4 },
  { cards: 40, seconds: 85, cols: 5, preview: 1, lookalikes: 6 },
];
const CUM_PAIRS = STAGES.reduce<number[]>((acc, s) => [...acc, (acc.at(-1) ?? 0) + s.cards / 2], []); // [2,6,14,26,46]
const TOTAL_PAIRS = CUM_PAIRS.at(-1)!;

const HINT_MS = 1000;
const MISS_PENALTY_S = 1;          // 짝 틀릴 때마다 차감
const MISMATCH_MS = 700;
const BEST_KEY = "gu-memory:best";

/* 이모지 버전 (쿠비 이미지로 교체 — 되돌리려면 아래 KOOBY 블록 대신 이걸 쓰고, 카드 앞면/토스트도 emoji로)
// 20종 그림 — 앞 6개는 경품 심볼(매칭 시 시술명 노출)
const SYMBOLS: { emoji: string; label: string }[] = [
  ...PRIZES.map((p) => ({ emoji: p.emoji, label: p.name.replace(" ⭐", "") })),
  { emoji: "🌸", label: "화사한 톤업" },
  { emoji: "🍑", label: "복숭아 피부" },
  { emoji: "🫧", label: "딥 클렌징" },
  { emoji: "🌺", label: "생기 케어" },
  { emoji: "🧖‍♀️", label: "진정 팩" },
  { emoji: "💆‍♀️", label: "피부 휴식" },
  { emoji: "🍋", label: "비타민 케어" },
  { emoji: "🍊", label: "비타민 톤업" },
  { emoji: "🌟", label: "광채 피부" },
  { emoji: "💦", label: "수분 충전" },
  { emoji: "🧊", label: "모공 쿨링" },
  { emoji: "🍯", label: "보습 장벽" },
  { emoji: "🌿", label: "시카 진정" },
  { emoji: "🫶", label: "피부 자신감" },
];

// 헷갈리는 닮은꼴 쌍 — 4단계부터 일부러 같이 넣음, 그 전엔 한 그룹에서 1개만
const LOOKALIKES: [number, number][] = [
  ["🌸", "🌺"], ["🍋", "🍊"], ["🍀", "🌿"], ["🧖‍♀️", "💆‍♀️"], ["⭐", "🌟"], ["💧", "💦"],
].map(([a, b]) => [SYMBOLS.findIndex((x) => x.emoji === a), SYMBOLS.findIndex((x) => x.emoji === b)]);
*/

// 20종 그림 — 쿠비 캐릭터 (public/kooby/1~20.png)
const SYMBOLS: { img: string; label: string }[] = [
  { img: "/kooby/1.png",  label: "생일 쿠비" },
  { img: "/kooby/2.png",  label: "셀카 쿠비" },
  { img: "/kooby/3.png",  label: "신난 쿠비" },
  { img: "/kooby/4.png",  label: "선글라스 쿠비" },
  { img: "/kooby/5.png",  label: "인사하는 쿠비" },
  { img: "/kooby/6.png",  label: "하트 쿠비" },
  { img: "/kooby/7.png",  label: "수줍은 쿠비" },
  { img: "/kooby/8.png",  label: "날아가는 쿠비" },
  { img: "/kooby/9.png",  label: "갸웃 쿠비" },
  { img: "/kooby/10.png", label: "노래하는 쿠비" },
  { img: "/kooby/11.png", label: "시무룩 쿠비" },
  { img: "/kooby/12.png", label: "원피스 쿠비" },
  { img: "/kooby/13.png", label: "인증서 쿠비" },
  { img: "/kooby/14.png", label: "신부 쿠비" },
  { img: "/kooby/15.png", label: "시술하는 쿠비" },
  { img: "/kooby/16.png", label: "풍선 쿠비" },
  { img: "/kooby/17.png", label: "운동하는 쿠비" },
  { img: "/kooby/18.png", label: "달리는 쿠비" },
  { img: "/kooby/19.png", label: "걱정 쿠비" },
  { img: "/kooby/20.png", label: "선생님 쿠비" },
];

// 헷갈리는 닮은꼴 쌍 (이미지 번호) — 4단계부터 일부러 같이 넣음, 그 전엔 한 그룹에서 1개만
const LOOKALIKES: [number, number][] = [
  [11, 19], // 시무룩 / 걱정
  [17, 18], // 운동복 2종
  [3, 7],   // 두 손 모은 기본 포즈
  [5, 9],   // 손 든 기본 포즈
  [1, 2],   // 앞에 뭔가 든 포즈 (케이크 / 폰)
  [12, 14], // 원피스 / 웨딩드레스
].map(([a, b]) => [a - 1, b - 1]);
const GROUPED = new Set(LOOKALIKES.flat());
const SINGLES = SYMBOLS.map((_, i) => i).filter((i) => !GROUPED.has(i));

const GRADES = [
  { stages: 5, grade: "S", title: "40장 올클리어! 기억력 천재", color: "#E8A800", prizeEmoji: "⭐" },
  { stages: 4, grade: "A", title: "24장까지 클리어!",          color: "#C5856A", prizeEmoji: "💎" },
  { stages: 3, grade: "B", title: "16장까지 클리어!",          color: "#D9967A", prizeEmoji: "🧴" },
  { stages: 0, grade: "C", title: "다음엔 더 멀리 갈 수 있어요", color: "#9A9AA0", prizeEmoji: "✨" },
];

const stagesFromPairs = (pairs: number) => CUM_PAIRS.filter((c) => pairs >= c).length;
const gradeOf = (pairs: number) => GRADES.find((g) => stagesFromPairs(pairs) >= g.stages)!;
const prizeOf = (pairs: number): Prize => PRIZES.find((p) => p.emoji === gradeOf(pairs).prizeEmoji)!;

type Phase = "intro" | "stageIntro" | "preview" | "play" | "clear" | "result";

interface Card { id: number; sym: number; open: boolean; matched: boolean }
interface Result { pairs: number; failedStage: number | null }

function dealStage(stageIdx: number): Card[] {
  const { cards, lookalikes } = STAGES[stageIdx];
  const groups = shuffle(LOOKALIKES);
  const forced = groups.slice(0, lookalikes).flat();
  const oneEach = groups.slice(lookalikes).map((g) => g[Math.random() < 0.5 ? 0 : 1]);
  const picked = [...forced, ...shuffle([...SINGLES, ...oneEach]).slice(0, cards / 2 - forced.length)];
  return shuffle([...picked, ...picked]).map((sym, id) => ({ id, sym, open: false, matched: false }));
}

// ─── Card ────────────────────────────────────────────────────────────────────

function MemoryCard({ card, faceUp, emojiSize, onFlip }: { card: Card; faceUp: boolean; emojiSize: number; onFlip: () => void }) {
  return (
    <button onClick={onFlip} aria-label="카드" className="relative aspect-square w-full" style={{ perspective: "600px" }}>
      <div
        className="relative w-full h-full"
        style={{
          transformStyle: "preserve-3d",
          transition: "transform 380ms cubic-bezier(.3,.7,.4,1.15)",
          transform: faceUp ? "rotateY(180deg)" : "rotateY(0deg)",
        }}
      >
        {/* Back */}
        <div
          className="absolute inset-0 rounded-xl shadow-sm flex items-center justify-center overflow-hidden"
          style={{ backfaceVisibility: "hidden", background: "linear-gradient(145deg, #C5856A, #E2AE96)" }}
        >
          <div className="absolute inset-[10%] rounded-lg border-2 border-white/30" />
          <span className="text-white/85 font-extrabold" style={{ fontSize: emojiSize * 0.55 }}>?</span>
        </div>
        {/* Front */}
        <div
          className={`absolute inset-0 rounded-xl flex items-center justify-center transition-colors duration-300
            ${card.matched ? "bg-white border-2 border-[#C5856A] shadow-[0_0_14px_rgba(197,133,106,0.45)]" : "bg-white border border-[#F0EDE8] shadow-sm"}`}
          style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
        >
          <Image
            src={SYMBOLS[card.sym].img}
            alt={SYMBOLS[card.sym].label}
            fill
            sizes="(max-width: 448px) 30vw, 140px"
            loading="eager"
            draggable={false}
            className="object-contain p-[8%]"
          />
        </div>
      </div>
    </button>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function MemoryGame() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [stage, setStage] = useState(0);
  const [cards, setCards] = useState<Card[]>([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [previewCount, setPreviewCount] = useState(3);
  const [peek, setPeek] = useState(false);
  const [hintUsed, setHintUsed] = useState(false);
  const [streak, setStreak] = useState(0);
  const [toast, setToast] = useState<{ id: number; sym: number } | null>(null);
  const [clearLeft, setClearLeft] = useState(0);
  const [penaltyId, setPenaltyId] = useState(0);
  const [result, setResult] = useState<Result>({ pairs: 0, failedStage: null });
  const [best, setBest] = useState(0);
  const [newBest, setNewBest] = useState(false);
  const [challenge, setChallenge] = useState<number | null>(null);
  const [plays, setPlays] = useState(0);

  const phaseRef = useRef<Phase>("intro");
  const cardsRef = useRef<Card[]>([]);
  const firstRef = useRef<number | null>(null);
  const lockRef = useRef(false);
  const endAtRef = useRef(0);
  const pairsRef = useRef(0);        // 전체 누적 매칭 수
  const streakRef = useRef(0);
  const bestRef = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const deadline = usePersonalDeadline("memory", WIN_HOLD_HOURS, plays > 0);

  const go = (p: Phase) => { phaseRef.current = p; setPhase(p); };
  const later = (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms));
  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  const updateCards = (next: Card[]) => { cardsRef.current = next; setCards(next); };

  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(BEST_KEY));
      if (saved > 0) { bestRef.current = saved; setBest(saved); }
    } catch {}
    const vs = Number(new URLSearchParams(location.search).get("vs"));
    if (Number.isFinite(vs) && vs > 0 && vs <= TOTAL_PAIRS) setChallenge(Math.round(vs));
    return clearTimers;
  }, []);

  // ── Flow ──
  const finish = useCallback((failedStage: number | null) => {
    clearTimers();
    const pairs = pairsRef.current;
    setResult({ pairs, failedStage });
    setPlays((n) => n + 1);
    const isNew = pairs > bestRef.current;
    setNewBest(isNew);
    if (isNew) {
      bestRef.current = pairs;
      setBest(pairs);
      try { localStorage.setItem(BEST_KEY, String(pairs)); } catch {}
    }
    go("result");
    if (navigator.vibrate) navigator.vibrate(failedStage === null ? [60, 40, 60, 40, 160] : [40, 30, 80]);
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  const startStage = (idx: number) => {
    setStage(idx);
    updateCards(dealStage(idx));
    firstRef.current = null;
    lockRef.current = false;
    streakRef.current = 0;
    setStreak(0);
    setToast(null);
    setTimeLeft(STAGES[idx].seconds);
    go("stageIntro");

    later(() => {
      const pv = STAGES[idx].preview;
      go("preview");
      setPreviewCount(pv);
      for (let k = 1; k < pv; k++) later(() => setPreviewCount(pv - k), k * 1000);
      later(() => {
        endAtRef.current = performance.now() + STAGES[idx].seconds * 1000;
        go("play");
      }, pv * 1000);
    }, 1300);
  };

  const startGame = () => {
    clearTimers();
    pairsRef.current = 0;
    setHintUsed(false);
    setPeek(false);
    window.scrollTo({ top: 0, behavior: "instant" });
    startStage(0);
  };

  // ── Timer ──
  useEffect(() => {
    if (phase !== "play") return;
    const id = setInterval(() => {
      const left = (endAtRef.current - performance.now()) / 1000;
      setTimeLeft(Math.max(0, left));
      if (left <= 0 && phaseRef.current === "play") finish(stage);
    }, 100);
    return () => clearInterval(id);
  }, [phase, stage, finish]);

  // ── Flip ──
  const flip = (i: number) => {
    if (phaseRef.current !== "play" || lockRef.current || peek) return;
    const cur = cardsRef.current;
    if (cur[i].open || cur[i].matched) return;

    const opened = cur.map((c, k) => (k === i ? { ...c, open: true } : c));
    updateCards(opened);
    if (navigator.vibrate) navigator.vibrate(8);

    const first = firstRef.current;
    if (first === null) {
      firstRef.current = i;
      return;
    }

    firstRef.current = null;

    // 매칭은 즉시 확정 — 마지막 쌍을 맞춘 순간 시간이 끝나도 클리어로 인정
    if (opened[first].sym === opened[i].sym) {
      const next = opened.map((c, k) => (k === i || k === first ? { ...c, matched: true } : c));
      updateCards(next);
      pairsRef.current++;
      streakRef.current++;
      setStreak(streakRef.current);
      setToast({ id: Date.now(), sym: opened[i].sym });
      if (navigator.vibrate) navigator.vibrate(25);

      if (next.every((c) => c.matched)) {
        setClearLeft(Math.max(0, (endAtRef.current - performance.now()) / 1000));
        go("clear");
        later(() => (stage === STAGES.length - 1 ? finish(null) : startStage(stage + 1)), 1600);
      }
    } else {
      lockRef.current = true;
      streakRef.current = 0;
      setStreak(0);
      endAtRef.current -= MISS_PENALTY_S * 1000;
      setPenaltyId((n) => n + 1);
      later(() => {
        updateCards(cardsRef.current.map((c, k) => (k === i || k === first ? { ...c, open: false } : c)));
        lockRef.current = false;
      }, MISMATCH_MS);
    }
  };

  const showHint = () => {
    if (hintUsed || phaseRef.current !== "play" || peek) return;
    setHintUsed(true);
    setPeek(true);
    later(() => setPeek(false), HINT_MS);
  };

  const share = () => {
    const g = gradeOf(best);
    const url = `${location.origin}${location.pathname}?vs=${best}`;
    const text = `피부 짝꿍 찾기 ${g.grade}등급 🧠\n${stagesFromPairs(best)}단계 클리어 (총 ${best}쌍), 넌 어디까지 갈 수 있어?`;
    if (navigator.share) {
      navigator.share({ title: "피부 짝꿍 찾기 도전장", text, url });
    } else {
      navigator.clipboard.writeText(`${text}\n${url}`).then(() => alert("도전장 링크가 복사됐어요! 친구에게 보내보세요 🔥"));
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  if (phase === "intro") return <Intro best={best} challenge={challenge} onStart={startGame} />;

  if (phase === "result") {
    return (
      <ResultView
        result={result}
        best={best}
        newBest={newBest}
        challenge={challenge}
        deadline={deadline}
        onRetry={startGame}
        onShare={share}
      />
    );
  }

  const cfg = STAGES[stage];
  const emojiSize = cfg.cols === 2 ? 52 : cfg.cols === 4 ? 34 : 26;
  const urgent = phase === "play" && timeLeft <= 5;
  const stagePairs = cards.filter((c) => c.matched).length / 2;

  return (
    <div className="max-w-md mx-auto px-4 pt-5 pb-10 min-h-screen select-none">
      {/* Stage dots */}
      <div className="flex items-center justify-center gap-1.5 mb-3">
        {STAGES.map((s, i) => (
          <span
            key={i}
            className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
              i < stage ? "bg-[#C5856A] text-white" : i === stage ? "bg-[#1C1C1E] text-white" : "bg-[#F0EDE8] text-[#B5B5B9]"
            }`}
          >
            {s.cards}
          </span>
        ))}
      </div>

      {/* HUD */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-[11px] font-bold text-[#8E8E93] tracking-wider">STAGE {stage + 1}</p>
          <p className="text-lg font-extrabold leading-tight">{stagePairs} / {cfg.cards / 2} 쌍</p>
        </div>
        <button
          onClick={showHint}
          disabled={hintUsed || phase !== "play"}
          className="text-[13px] font-bold px-3 py-2 rounded-xl border-[1.5px] border-[#C5856A] text-[#C5856A] bg-white disabled:border-[#E5E5EA] disabled:text-[#C7C7CC] transition-all active:scale-95"
        >
          💡 힌트 {hintUsed ? "사용함" : "1회"}
        </button>
        <div className="relative text-right">
          {penaltyId > 0 && phase === "play" && (
            <span
              key={penaltyId}
              className="pointer-events-none absolute left-1/2 top-full whitespace-nowrap text-[15px] font-extrabold text-[#FF3B30] animate-[float-up_700ms_ease-out_forwards]"
            >
              −{MISS_PENALTY_S}초
            </span>
          )}
          <p className={`text-[11px] font-bold tracking-wider ${urgent ? "text-[#FF3B30]" : "text-[#8E8E93]"}`}>TIME</p>
          <p className={`text-[28px] font-extrabold leading-none tabular-nums ${urgent ? "text-[#FF3B30] animate-pulse" : ""}`}>
            {Math.ceil(timeLeft)}
          </p>
        </div>
      </div>

      {/* Time bar */}
      <div className="h-2 bg-[#F0EDE8] rounded-full overflow-hidden mb-4">
        <div
          className={`h-full rounded-full ${urgent ? "bg-[#FF3B30]" : "bg-[#C5856A]"}`}
          style={{ width: `${(timeLeft / cfg.seconds) * 100}%`, transition: "width 100ms linear" }}
        />
      </div>

      {/* Board */}
      <div className="relative mx-auto" style={{ maxWidth: cfg.cols === 2 ? 240 : undefined }}>
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cfg.cols}, minmax(0, 1fr))` }}>
          {cards.map((c, i) => (
            <MemoryCard
              key={`${stage}-${c.id}`}
              card={c}
              faceUp={c.open || c.matched || peek || phase === "preview"}
              emojiSize={emojiSize}
              onFlip={() => flip(i)}
            />
          ))}
        </div>

        {/* Overlays */}
        {phase === "stageIntro" && (
          <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/80 backdrop-blur-sm">
            <div className="text-center animate-[pop-in_350ms_ease-out]">
              <p className="text-sm font-bold text-[#8E8E93] tracking-widest mb-1">STAGE {stage + 1} / {STAGES.length}</p>
              <p className="text-[34px] font-extrabold mb-1">{cfg.cards}장</p>
              <p className="text-[15px] font-semibold text-[#C5856A]">제한시간 {cfg.seconds}초 · 미리보기 {cfg.preview}초</p>
              {cfg.lookalikes > 0 && <p className="text-[13px] font-bold text-[#FF6B35] mt-2">⚠️ 닮은 쿠비 주의!</p>}
            </div>
          </div>
        )}
        {phase === "clear" && (
          <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/75 backdrop-blur-sm">
            <div className="text-center animate-[pop-in_350ms_ease-out]">
              <p className="text-5xl mb-2">{stage === STAGES.length - 1 ? "🏆" : "🎉"}</p>
              <p className="text-[30px] font-extrabold text-[#C5856A]">STAGE {stage + 1} CLEAR!</p>
              <p className="text-[14px] text-[#8E8E93] mt-1">남은 시간 {clearLeft.toFixed(1)}초</p>
              {stage < STAGES.length - 1 && (
                <p className="text-[14px] font-bold mt-2">다음은 {STAGES[stage + 1].cards}장 →</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Status line */}
      <div className="h-12 flex items-center justify-center mt-4">
        {phase === "preview" ? (
          <p className="text-[17px] font-extrabold text-[#C5856A]">👀 위치를 외우세요! {previewCount}</p>
        ) : peek ? (
          <p className="text-[15px] font-bold text-[#C5856A]">💡 힌트 공개 중…</p>
        ) : toast ? (
          <p key={toast.id} className="flex items-center gap-1.5 text-[15px] font-bold text-[#1C1C1E] animate-[pop-in_250ms_ease-out] break-keep text-center">
            <Image src={SYMBOLS[toast.sym].img} alt="" width={28} height={28} className="w-7 h-7 object-contain" />
            {SYMBOLS[toast.sym].label} 매칭!
            {streak >= 2 && <span className="ml-1.5 text-[#FF6B35]">{streak}연속 🔥</span>}
          </p>
        ) : (
          <p className="text-[13px] text-[#8E8E93]">같은 그림 2장을 찾아 뒤집으세요</p>
        )}
      </div>
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
          암기는 이제 끝?<br />
          마지막 기억력 테스트 🧠
        </h1>
        <p className="text-[#8E8E93] text-[15px] break-keep">같은 그림 2장을 찾아 뒤집고, 단계를 올라갈수록 좋은 쿠폰!</p>
      </div>

      {challenge !== null && (
        <div className="bg-[#1C1C1E] text-white rounded-2xl p-4 text-center mb-5">
          <p className="text-[13px] opacity-75 mb-0.5">🔥 친구가 도전장을 보냈어요</p>
          <p className="text-lg font-extrabold">{stagesFromPairs(challenge)}단계 · 총 {challenge}쌍을 넘어봐!</p>
        </div>
      )}

      {/* Stages + grades */}
      <div className="bg-white border border-[#F0EDE8] rounded-2xl p-4 mb-4">
        <p className="text-xs font-bold text-[#8E8E93] mb-3 text-center">5단계 · 클리어할수록 쿠폰 업그레이드</p>
        <ul className="flex flex-col gap-2">
          {STAGES.map((s, i) => {
            const g = GRADES.find((x) => x.stages === i + 1);
            const p = g && PRIZES.find((x) => x.emoji === g.prizeEmoji)!;
            return (
              <li key={i} className="flex items-center gap-3">
                <span className="w-14 shrink-0 text-[12px] font-bold text-[#8E8E93]">STAGE {i + 1}</span>
                <span className="w-16 shrink-0 text-[14px] font-extrabold">{s.cards}장</span>
                <span className="w-12 shrink-0 text-[12px] text-[#8E8E93] tabular-nums">{s.seconds}초</span>
                {g && p ? (
                  <span className="flex-1 min-w-0 flex items-center gap-1.5 justify-end">
                    <span className="w-5 h-5 rounded-full text-white text-[11px] font-extrabold flex items-center justify-center shrink-0" style={{ background: g.color }}>
                      {g.grade}
                    </span>
                    <span className="text-[12px] font-bold text-[#C5856A] truncate">{p.price}</span>
                  </span>
                ) : (
                  <span className="flex-1" />
                )}
              </li>
            );
          })}
        </ul>
        <p className="text-[12px] text-[#8E8E93] text-center mt-3 break-keep">
          참여만 해도 C등급 피코 토닝 ₩9,900 쿠폰 지급
        </p>
      </div>

      <div className="bg-[#FAF8F6] rounded-2xl p-4 mb-6 text-[13px] text-[#1C1C1E] leading-relaxed">
        <p>👀 매 단계 시작 전 <b>미리보기</b> — 단계가 오를수록 3초 → 1초</p>
        <p>❌ 짝이 틀리면 <b>−{MISS_PENALTY_S}초</b>, 아무 데나 누르면 손해!</p>
        <p>⚠️ 4단계부터 <b>닮은 쿠비</b> 등장 — 표정·옷차림을 잘 보세요!</p>
        <p>💡 막힐 땐 <b>힌트 1회</b> — 전체 카드 1초 공개</p>
        <p>⏱ 제한시간 안에 다 맞추면 다음 단계로!</p>
      </div>

      <button
        onClick={onStart}
        className="w-full bg-[#C5856A] hover:bg-[#B07050] active:scale-[0.98] text-white font-bold text-lg py-[18px] rounded-2xl transition-all"
      >
        게임 시작 ▶
      </button>
      {best > 0 && (
        <p className="text-center text-sm text-[#8E8E93] mt-3">
          내 최고 기록 <b className="text-[#C5856A]">{stagesFromPairs(best)}단계 · {best}쌍</b>
        </p>
      )}

      <p className="text-center text-xs text-[#8E8E93] mt-8">지유의원 강남 · 피부과 전문의 직접 시술</p>
    </div>
  );
}

// ─── Result ──────────────────────────────────────────────────────────────────

function ResultView({
  result,
  best,
  newBest,
  challenge,
  deadline,
  onRetry,
  onShare,
}: {
  result: Result;
  best: number;
  newBest: boolean;
  challenge: number | null;
  deadline: number | null;
  onRetry: () => void;
  onShare: () => void;
}) {
  const cleared = stagesFromPairs(result.pairs);
  const g = gradeOf(result.pairs);
  const bestGrade = gradeOf(best);
  const prize = prizeOf(best);
  const allClear = result.failedStage === null;

  return (
    <div className="max-w-md mx-auto px-5 pt-10 pb-14 min-h-screen">
      <div className="text-center mb-6">
        <p className="text-sm font-bold text-[#8E8E93] mb-3">
          {allClear ? "🏆 올클리어!" : `STAGE ${result.failedStage! + 1} (${STAGES[result.failedStage!].cards}장)에서 시간 초과`}
        </p>
        <div
          className="w-28 h-28 mx-auto rounded-full flex items-center justify-center text-white text-[56px] font-extrabold mb-3 shadow-lg animate-[pop-in_400ms_ease-out]"
          style={{ background: g.color }}
        >
          {g.grade}
        </div>
        {newBest && <span className="inline-block bg-[#FF3B30] text-white text-[11px] font-bold px-2 py-0.5 rounded-md mb-1">NEW BEST</span>}
        <p className="text-lg font-bold mt-1 break-keep">{g.title}</p>
        <p className="text-[14px] text-[#8E8E93] mt-1">총 {result.pairs}쌍 매칭</p>
      </div>

      {/* Stage progress */}
      <div className="flex items-center justify-center gap-1.5 mb-6">
        {STAGES.map((s, i) => {
          const done = i < cleared;
          const failed = result.failedStage === i;
          return (
            <span
              key={i}
              className={`w-12 py-2 rounded-xl text-center text-[13px] font-extrabold ${
                done ? "bg-[#C5856A] text-white" : failed ? "bg-[#FFE5E3] text-[#FF3B30]" : "bg-[#F0EDE8] text-[#C7C7CC]"
              }`}
            >
              {failed ? "✕" : s.cards}
            </span>
          );
        })}
      </div>

      {challenge !== null && (
        <div className={`rounded-2xl p-4 text-center mb-5 ${result.pairs > challenge ? "bg-[#1C1C1E] text-white" : "bg-[#F0EDE8]"}`}>
          {result.pairs > challenge ? (
            <p className="font-extrabold">🎉 친구 기록 {challenge}쌍을 이겼어요!</p>
          ) : (
            <p className="font-bold text-[#1C1C1E]">친구 기록 {challenge}쌍까지 {challenge - result.pairs + 1}쌍 남았어요 😤</p>
          )}
        </div>
      )}

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
          최고 기록 {stagesFromPairs(best)}단계 · <b style={{ color: bestGrade.color }}>{bestGrade.grade}등급</b> 쿠폰
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
