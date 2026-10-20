"use client";

import { useState, useRef, useEffect } from "react";
import { type Prize, PRIZES, pickPrize } from "../_lib/prizes";
import { WIN_HOLD_HOURS } from "../_lib/event";
import { CountdownInline, usePersonalDeadline } from "../_components/Countdown";

// ─── Config ──────────────────────────────────────────────────────────────────

const SYMBOLS = PRIZES.map((p) => p.emoji);
const CELL = 96;                          // 심볼 1칸 높이(px)
const MAX_SPINS = 3;
const WIN_ODDS = [0.2, 0.35, 1];          // 회차별 당첨 확률 — 마지막 회차는 확정 당첨
const NEAR_MISS_ODDS = 0.6;               // 꽝일 때 "2개 맞고 1개 빗나감" 연출 비율
const REEL_MS = [1400, 1900, 2400];       // 왼쪽부터 순서대로 멈춤
const NEAR_MISS_EXTRA_MS = 1000;          // 2개 맞았을 때 마지막 릴 뜸들이기

// SSR과 동일해야 하므로 초기 화면은 고정 심볼
const INITIAL = [SYMBOLS[4], SYMBOLS[4], SYMBOLS[4]];

type Phase = "idle" | "spinning" | "lose" | "won";

interface Reel {
  strip: string[];
  y: number;
  ms: number;
}

const randomSymbol = () => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];

// ─── Outcome ─────────────────────────────────────────────────────────────────

function decideOutcome(spinIdx: number): { targets: string[]; prize: Prize | null } {
  if (Math.random() < WIN_ODDS[spinIdx]) {
    const prize = pickPrize();
    return { targets: [prize.emoji, prize.emoji, prize.emoji], prize };
  }
  if (Math.random() < NEAR_MISS_ODDS) {
    const a = randomSymbol();
    let c = randomSymbol();
    while (c === a) c = randomSymbol();
    return { targets: [a, a, c], prize: null };
  }
  let t: string[];
  do t = [randomSymbol(), randomSymbol(), randomSymbol()];
  while (t[0] === t[1]);
  return { targets: t, prize: null };
}

// ─── Reel ────────────────────────────────────────────────────────────────────

function ReelView({ reel, highlight }: { reel: Reel; highlight: boolean }) {
  return (
    <div
      className={`relative bg-white rounded-2xl overflow-hidden transition-shadow duration-300
        ${highlight ? "ring-4 ring-[#FFD66B] shadow-[0_0_24px_rgba(255,214,107,0.8)]" : "shadow-inner"}`}
      style={{ height: CELL }}
    >
      <div
        style={{
          transform: `translateY(${reel.y}px)`,
          transition: reel.ms ? `transform ${reel.ms}ms cubic-bezier(.12,.8,.22,1.04)` : "none",
        }}
      >
        {reel.strip.map((s, i) => (
          <div key={i} className="flex items-center justify-center text-[48px]" style={{ height: CELL }}>
            {s}
          </div>
        ))}
      </div>
      {/* 위아래 페이드 — 회전하는 느낌 */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/15 via-transparent to-black/15" />
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function SlotMachine() {
  const [reels, setReels] = useState<Reel[]>(() => INITIAL.map((s) => ({ strip: [s], y: 0, ms: 0 })));
  const [phase, setPhase] = useState<Phase>("idle");
  const [spinsUsed, setSpinsUsed] = useState(0);
  const [nearMiss, setNearMiss] = useState(false);
  const [prize, setPrize] = useState<Prize | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const ctaRef = useRef<HTMLDivElement>(null);
  const deadline = usePersonalDeadline("slot", WIN_HOLD_HOURS, phase === "won");

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const spin = () => {
    if (phase === "spinning" || phase === "won" || spinsUsed >= MAX_SPINS) return;

    const { targets, prize: won } = decideOutcome(spinsUsed);
    const isNear = !won && targets[0] === targets[1];
    const durations = REEL_MS.map((ms, i) => (i === 2 && isNear ? ms + NEAR_MISS_EXTRA_MS : ms));

    // 현재 심볼 → 랜덤 필러 → 목표 심볼 순서의 긴 스트립을 만들고 끝까지 굴림
    const strips = reels.map((r, i) => {
      const fillers = Array.from({ length: 16 + i * 6 + (i === 2 && isNear ? 8 : 0) }, randomSymbol);
      return [r.strip[r.strip.length - 1], ...fillers, targets[i]];
    });

    setPhase("spinning");
    setNearMiss(false);
    setSpinsUsed((n) => n + 1);
    if (navigator.vibrate) navigator.vibrate(20);
    setReels(strips.map((strip) => ({ strip, y: 0, ms: 0 })));

    requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        setReels(strips.map((strip, i) => ({ strip, y: -(strip.length - 1) * CELL, ms: durations[i] })))
      )
    );

    timers.current.push(
      setTimeout(() => {
        // 긴 스트립 정리 — 화면상 같은 심볼이라 티 안 남
        setReels(targets.map((s) => ({ strip: [s], y: 0, ms: 0 })));
        if (won) {
          setPrize(won);
          setPhase("won");
          if (navigator.vibrate) navigator.vibrate([60, 40, 60, 40, 120]);
          timers.current.push(setTimeout(() => ctaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 700));
        } else {
          setNearMiss(isNear);
          setPhase("lose");
        }
      }, Math.max(...durations) + 120)
    );
  };

  const share = () => {
    if (!prize) return;
    const text = `지유의원 강남 슬롯 잭팟 ${prize.emoji}${prize.emoji}${prize.emoji}\n${prize.name} ${prize.price}\n너도 돌려봐!`;
    if (navigator.share) {
      navigator.share({ title: "수능 특가 슬롯머신", text, url: location.href });
    } else {
      navigator.clipboard.writeText(`${text}\n${location.href}`).then(() => alert("링크가 복사됐어요! 친구에게 공유해보세요 😊"));
    }
  };

  const left = MAX_SPINS - spinsUsed;
  const message =
    phase === "idle"     ? `같은 그림 3개를 맞추면 당첨! 기회는 ${MAX_SPINS}번` :
    phase === "spinning" ? "돌아가는 중… 🤞" :
    phase === "won"      ? "🎉 잭팟! 축하해요!" :
    nearMiss             ? (left === 1 ? "아깝다! 마지막 기회는 꼭 터질 거예요 🔥" : "아깝다! 하나만 더 맞았으면… 😭") :
                           (left === 1 ? "마지막 기회! 행운을 빌어요 🍀" : "다시 한 번 돌려보세요!");

  const lightsOn = phase === "spinning" || phase === "won";

  return (
    <div className="max-w-md mx-auto px-5 pt-12 pb-14 min-h-screen">
      {/* Header */}
      <div className="text-center mb-7">
        <span className="inline-block bg-[#FEF3ED] text-[#C5856A] text-sm font-semibold px-4 py-1.5 rounded-full mb-5">
          지유의원 강남 × 수능 특가
        </span>
        <h1 className="text-[32px] font-extrabold leading-[1.28] tracking-tight mb-3 break-keep">
          수능 끝! 이제<br />
          잭팟 터뜨릴 차례 🎰
        </h1>
      </div>

      {/* Machine */}
      <div className="rounded-[28px] p-4 pb-5 shadow-[0_14px_36px_rgba(176,112,80,0.35)]" style={{ background: "linear-gradient(160deg, #C5856A, #A9654A)" }}>
        {/* Marquee lights */}
        <div className="flex justify-between px-2 mb-3">
          {Array.from({ length: 11 }).map((_, i) => (
            <span
              key={i}
              className={`w-2 h-2 rounded-full ${lightsOn ? "bg-[#FFD66B] animate-pulse" : "bg-white/35"}`}
              style={{ animationDelay: `${(i % 2) * 300}ms`, animationDuration: phase === "won" ? "400ms" : "800ms" }}
            />
          ))}
        </div>
        <p className="text-center text-white font-extrabold tracking-[0.2em] text-sm mb-3">JACKPOT</p>

        <div className="grid grid-cols-3 gap-2 bg-[#7E4A35]/40 p-2 rounded-[20px]">
          {reels.map((r, i) => (
            <ReelView key={i} reel={r} highlight={phase === "won"} />
          ))}
        </div>

        {/* Chances */}
        <div className="flex items-center justify-center gap-2 mt-4 mb-4">
          <span className="text-white/80 text-xs font-semibold">남은 기회</span>
          {Array.from({ length: MAX_SPINS }).map((_, i) => (
            <span key={i} className={`text-lg transition-all ${i < left ? "" : "grayscale opacity-30 scale-90"}`}>🪙</span>
          ))}
        </div>

        <button
          onClick={spin}
          disabled={phase === "spinning" || phase === "won" || left === 0}
          className="w-full bg-[#FFD66B] text-[#5A3322] font-extrabold text-xl py-[18px] rounded-2xl shadow-[0_5px_0_#D9A93A] transition-all
            active:translate-y-[5px] active:shadow-none
            disabled:bg-white/30 disabled:text-white/70 disabled:shadow-none disabled:translate-y-[5px] disabled:cursor-not-allowed"
        >
          {phase === "spinning" ? "돌아가는 중…" : phase === "won" ? "당첨 완료 🎉" : spinsUsed === 0 ? "돌리기 🎰" : "다시 돌리기 🎰"}
        </button>
      </div>

      <p className={`text-center text-[15px] font-semibold mt-5 break-keep ${phase === "won" ? "text-[#C5856A]" : "text-[#8E8E93]"}`}>
        {message}
      </p>

      {/* Paytable — 당첨 전까지 노출 */}
      {phase !== "won" && (
        <div className="mt-6 bg-white border border-[#F0EDE8] rounded-2xl p-4">
          <p className="text-xs font-bold text-[#8E8E93] mb-3 text-center">당첨표</p>
          <ul className="grid grid-cols-2 gap-x-3 gap-y-2.5">
            {PRIZES.map((p) => (
              <li key={p.name} className="flex items-center gap-2 min-w-0">
                <span className="text-sm shrink-0 tracking-tighter">{p.emoji}{p.emoji}{p.emoji}</span>
                <span className="min-w-0">
                  <span className="block text-[12px] font-semibold truncate">{p.name}</span>
                  <span className="block text-[12px] font-extrabold text-[#C5856A]">{p.price}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Result + CTA */}
      <div
        ref={ctaRef}
        className={`transition-all duration-500 ${phase === "won" ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none h-0 overflow-hidden"}`}
      >
        {prize && (
          <div className="bg-white border-2 border-[#C5856A] rounded-2xl p-5 text-center mt-6 mb-4 shadow-sm">
            <p className="text-3xl mb-1">{prize.emoji}{prize.emoji}{prize.emoji}</p>
            <span className="inline-block bg-[#FEF3ED] text-[#C5856A] text-[11px] font-bold px-2 py-0.5 rounded-md mb-2">{prize.tag}</span>
            <p className="text-[20px] font-extrabold break-keep">{prize.name}</p>
            <p className="text-[13px] text-[#8E8E93] mt-0.5 mb-2 break-keep">{prize.desc}</p>
            <p className="text-[32px] font-extrabold text-[#C5856A] leading-none">{prize.price}</p>
          </div>
        )}

        <div className="rounded-2xl p-4 text-center text-white mb-5" style={{ background: "linear-gradient(135deg, #C5856A, #D4A090)" }}>
          <p className="text-[15px] font-extrabold mb-0.5">수험표 지참 시 당첨가 적용</p>
          <p className="text-[12px] opacity-85">2026.11.13 ~ 12.31 · 1인 1회</p>
          <CountdownInline deadline={deadline} className="mt-3 bg-white/20 text-white text-[13px] font-semibold px-3 py-1.5 rounded-full" />
        </div>

        <a href="#" className="block w-full bg-[#C5856A] hover:bg-[#B07050] text-white text-center font-bold text-lg py-[18px] rounded-2xl transition-all mb-3">
          당첨가로 예약하기
        </a>
        <a href="#" className="block w-full bg-[#FEE500] text-[#1C1C1E] text-center font-bold text-lg py-[18px] rounded-2xl transition-all mb-3">
          💬 카카오 상담하기
        </a>
        <button
          onClick={share}
          className="w-full border border-[#F0EDE8] text-[#8E8E93] font-semibold text-[15px] py-4 rounded-2xl hover:border-[#C5856A] hover:text-[#C5856A] transition-all"
        >
          📤 친구에게 공유하기
        </button>
      </div>

      <p className="text-center text-xs text-[#8E8E93] mt-8">지유의원 강남 · 피부과 전문의 직접 시술</p>
    </div>
  );
}
