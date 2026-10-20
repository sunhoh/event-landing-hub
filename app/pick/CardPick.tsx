"use client";

import { useState, useRef } from "react";
import { type Prize, PRIZES, pickPrize, shuffle } from "../_lib/prizes";
import { WIN_HOLD_HOURS } from "../_lib/event";
import { CountdownInline, usePersonalDeadline } from "../_components/Countdown";

// ─── Config ──────────────────────────────────────────────────────────────────

// 이미지 대신 카드 뒷면 색상 — 브랜드 톤 계열로 6장
const CARD_BACKS = [
  { from: "#C5856A", to: "#E2AE96" },
  { from: "#B07050", to: "#D4A090" },
  { from: "#D9967A", to: "#F2C4AE" },
  { from: "#A86B5A", to: "#CC9583" },
  { from: "#C98F7B", to: "#EBC0AE" },
  { from: "#B97D63", to: "#DDB09B" },
];

const FLIP_MS = 600;
const OTHERS_DELAY_MS = 900;  // 내 카드 뒤집힌 후 나머지 공개까지

type Phase = "choose" | "flipping" | "revealed" | "done";

// ─── Card ────────────────────────────────────────────────────────────────────

function FlipCard({
  index,
  prize,
  flipped,
  chosen,
  dimmed,
  disabled,
  onPick,
}: {
  index: number;
  prize: Prize | null;
  flipped: boolean;
  chosen: boolean;
  dimmed: boolean;
  disabled: boolean;
  onPick: () => void;
}) {
  const back = CARD_BACKS[index % CARD_BACKS.length];

  return (
    <button
      onClick={onPick}
      disabled={disabled}
      aria-label={`${index + 1}번 카드 선택`}
      className={`relative aspect-[3/4] w-full transition-[transform,opacity] duration-300
        ${chosen ? "z-10 scale-105" : ""}
        ${dimmed ? "opacity-45 scale-95" : ""}
        ${!disabled ? "active:scale-95 hover:-translate-y-1" : ""}`}
      style={{ perspective: "800px" }}
    >
      <div
        className="relative w-full h-full"
        style={{
          transformStyle: "preserve-3d",
          transition: `transform ${FLIP_MS}ms cubic-bezier(.3,.7,.4,1.2)`,
          transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
        }}
      >
        {/* Back (보이는 면) */}
        <div
          className="absolute inset-0 rounded-2xl shadow-md flex flex-col items-center justify-center overflow-hidden"
          style={{ backfaceVisibility: "hidden", background: `linear-gradient(145deg, ${back.from}, ${back.to})` }}
        >
          <div className="absolute inset-2 rounded-xl border-2 border-white/35" />
          <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full bg-white/10" />
          <div className="absolute -bottom-8 -left-8 w-24 h-24 rounded-full bg-white/10" />
          <span className="text-white/95 text-[28px] font-extrabold leading-none">?</span>
          <span className="text-white/80 text-[11px] font-bold tracking-widest mt-2">{String(index + 1).padStart(2, "0")}</span>
        </div>

        {/* Front (결과 면) */}
        <div
          className={`absolute inset-0 rounded-2xl flex flex-col items-center justify-center text-center px-1.5
            ${chosen ? "bg-white border-2 border-[#C5856A] shadow-[0_10px_28px_rgba(197,133,106,0.35)]" : "bg-[#FAF8F6] border border-[#F0EDE8]"}`}
          style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
        >
          {prize && (
            <>
              {chosen && <span className="text-xl mb-0.5">🎉</span>}
              <span className={`text-[10px] font-bold px-1.5 py-px rounded mb-1 ${chosen ? "bg-[#C5856A] text-white" : "bg-[#F0EDE8] text-[#8E8E93]"}`}>
                {prize.tag}
              </span>
              <span className={`text-[12px] font-bold leading-tight break-keep ${chosen ? "text-[#1C1C1E]" : "text-[#8E8E93]"}`}>
                {prize.name}
              </span>
              <span className={`text-[15px] font-extrabold mt-1 ${chosen ? "text-[#C5856A]" : "text-[#B5B5B9]"}`}>
                {prize.price}
              </span>
            </>
          )}
        </div>
      </div>
    </button>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function CardPick() {
  const [phase, setPhase] = useState<Phase>("choose");
  const [chosenIdx, setChosenIdx] = useState<number | null>(null);
  const [deck, setDeck] = useState<(Prize | null)[]>(() => CARD_BACKS.map(() => null));
  const ctaRef = useRef<HTMLDivElement>(null);
  const deadline = usePersonalDeadline("pick", WIN_HOLD_HOURS, phase === "done");

  // 고른 카드 = 가중치 추첨, 나머지 카드 = 남은 경품을 섞어서 배치
  const pick = (i: number) => {
    if (phase !== "choose") return;
    const won = pickPrize();
    const rest = shuffle(PRIZES.filter((p) => p !== won));
    const next = CARD_BACKS.map((_, idx) => (idx === i ? won : rest.pop() ?? null));

    setDeck(next);
    setChosenIdx(i);
    setPhase("flipping");
    if (navigator.vibrate) navigator.vibrate(30);

    setTimeout(() => setPhase("revealed"), FLIP_MS);
    setTimeout(() => {
      setPhase("done");
      setTimeout(() => ctaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 400);
    }, FLIP_MS + OTHERS_DELAY_MS);
  };

  const won = chosenIdx !== null ? deck[chosenIdx] : null;

  const share = () => {
    if (!won) return;
    const text = `지유의원 강남 카드 뽑기 당첨 🎉\n${won.name} ${won.price}\n너도 한 장 골라봐!`;
    if (navigator.share) {
      navigator.share({ title: "수능 특가 카드 뽑기", text, url: location.href });
    } else {
      navigator.clipboard.writeText(`${text}\n${location.href}`).then(() => alert("링크가 복사됐어요! 친구에게 공유해보세요 😊"));
    }
  };

  const subtitle =
    phase === "choose"   ? "마음이 가는 카드 한 장을 골라 터치하세요" :
    phase === "flipping" ? "두근두근… 🤞" :
    phase === "revealed" ? "축하해요! 다른 카드에는 뭐가 있었을까요?" :
                           "축하해요! 예약 시 이 화면을 보여주세요.";

  return (
    <div className="max-w-md mx-auto px-5 pt-12 pb-14 min-h-screen">
      {/* Header */}
      <div className="text-center mb-8">
        <span className="inline-block bg-[#FEF3ED] text-[#C5856A] text-sm font-semibold px-4 py-1.5 rounded-full mb-5">
          지유의원 강남 × 수능 특가
        </span>
        <h1 className="text-[32px] font-extrabold leading-[1.28] tracking-tight mb-3 break-keep">
          6장 중 단 1장,<br />
          너의 카드를 골라봐 🃏
        </h1>
        <p className="text-[#8E8E93] text-[15px] leading-relaxed break-keep min-h-[1.6em]">{subtitle}</p>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-3 gap-3">
        {CARD_BACKS.map((_, i) => {
          const isChosen = i === chosenIdx;
          const flipped = isChosen ? phase !== "choose" : phase === "done";
          return (
            <FlipCard
              key={i}
              index={i}
              prize={deck[i]}
              flipped={flipped}
              chosen={isChosen}
              dimmed={chosenIdx !== null && !isChosen}
              disabled={phase !== "choose"}
              onPick={() => pick(i)}
            />
          );
        })}
      </div>

      {/* Result + CTA */}
      <div
        ref={ctaRef}
        className={`transition-all duration-500 ${phase === "done" && won ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none h-0 overflow-hidden"}`}
      >
        {won && (
          <div className="bg-white border-2 border-[#C5856A] rounded-2xl p-5 text-center mt-8 mb-4 shadow-sm">
            <p className="text-xs text-[#8E8E93] mb-1.5">{chosenIdx! + 1}번 카드 당첨 혜택</p>
            <span className="inline-block bg-[#FEF3ED] text-[#C5856A] text-[11px] font-bold px-2 py-0.5 rounded-md mb-2">{won.tag}</span>
            <p className="text-[20px] font-extrabold break-keep">{won.name}</p>
            <p className="text-[13px] text-[#8E8E93] mt-0.5 mb-2 break-keep">{won.desc}</p>
            <p className="text-[32px] font-extrabold text-[#C5856A] leading-none">{won.price}</p>
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
