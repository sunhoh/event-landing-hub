"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { type Prize, pickPrize } from "../_lib/prizes";
import { WIN_HOLD_HOURS } from "../_lib/event";
import { CountdownInline, usePersonalDeadline } from "../_components/Countdown";

// ─── Config ──────────────────────────────────────────────────────────────────

const BRUSH = 22;           // CSS px radius
const REVEAL_RATIO = 0.5;   // 이 비율 이상 긁으면 자동 공개

// ─── Scratch Card ────────────────────────────────────────────────────────────

function ScratchCard({ prize, onReveal }: { prize: Prize; onReveal: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const last = useRef<{ x: number; y: number } | null>(null);
  const moves = useRef(0);
  const done = useRef(false);
  const [started, setStarted] = useState(false);
  const [revealed, setRevealed] = useState(false);

  // Paint the cover, sized to the element at device pixel ratio
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const { width: w, height: h } = canvas.getBoundingClientRect();
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.scale(dpr, dpr);

    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, "#C5856A");
    grad.addColorStop(0.5, "#D9A58E");
    grad.addColorStop(1, "#B07050");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Sparkle texture
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    for (let i = 0; i < 140; i++) {
      ctx.beginPath();
      ctx.arc(Math.random() * w, Math.random() * h, Math.random() * 1.6 + 0.4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "800 22px -apple-system, 'Apple SD Gothic Neo', sans-serif";
    ctx.fillText("여기를 긁어주세요", w / 2, h / 2 - 12);
    ctx.font = "600 13px -apple-system, 'Apple SD Gothic Neo', sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillText("수능 특가 혜택이 숨어있어요", w / 2, h / 2 + 16);

    ctx.globalCompositeOperation = "destination-out";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = BRUSH * 2;
  }, []);

  const pos = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const reveal = useCallback(() => {
    if (done.current) return;
    done.current = true;
    setRevealed(true);
    if (navigator.vibrate) navigator.vibrate(40);
    onReveal();
  }, [onReveal]);

  const checkProgress = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || done.current) return;
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let clear = 0;
    let sampled = 0;
    for (let i = 3; i < data.length; i += 32) {
      sampled++;
      if (data[i] === 0) clear++;
    }
    if (clear / sampled >= REVEAL_RATIO) reveal();
  }, [reveal]);

  const scratchTo = (x: number, y: number) => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const from = last.current ?? { x, y };
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(x, y);
    ctx.stroke();
    last.current = { x, y };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (done.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    if (!started) setStarted(true);
    last.current = null;
    const { x, y } = pos(e);
    scratchTo(x, y);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!last.current || done.current) return;
    const { x, y } = pos(e);
    scratchTo(x, y);
    if (++moves.current % 12 === 0) checkProgress();
  };

  const onPointerUp = () => {
    last.current = null;
    checkProgress();
  };

  return (
    <div className="relative w-full aspect-[4/3] rounded-3xl overflow-hidden shadow-[0_12px_32px_rgba(197,133,106,0.28)] select-none">
      {/* Prize underneath */}
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-[#FFF8F4] to-[#FEF3ED] p-6 text-center border-2 border-dashed border-[#E8C9BA] rounded-3xl">
        <span className={`text-5xl mb-2 transition-transform duration-500 ${revealed ? "scale-110 animate-bounce" : ""}`}>🎉</span>
        <span className="inline-block bg-[#C5856A] text-white text-[11px] font-bold px-2.5 py-0.5 rounded-md mb-2">{prize.tag}</span>
        <p className="text-[20px] font-extrabold leading-snug break-keep">{prize.name}</p>
        <p className="text-[13px] text-[#8E8E93] mt-1 mb-2 break-keep">{prize.desc}</p>
        <p className="text-[32px] font-extrabold text-[#C5856A] leading-none">{prize.price}</p>
      </div>

      {/* Cover */}
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 w-full h-full touch-none cursor-pointer transition-opacity duration-500 ${revealed ? "opacity-0 pointer-events-none" : "opacity-100"}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />

      {/* Finger hint before first touch */}
      {!started && (
        <span className="pointer-events-none absolute right-6 bottom-5 text-3xl animate-bounce">👆</span>
      )}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ScratchEvent() {
  const [prize, setPrize] = useState<Prize | null>(null);
  const [revealed, setRevealed] = useState(false);
  const deadline = usePersonalDeadline("scratch", WIN_HOLD_HOURS, revealed);
  const ctaRef = useRef<HTMLDivElement>(null);

  // Math.random()은 클라이언트에서만 — SSR과 결과가 달라 hydration 에러 남
  useEffect(() => { setPrize(pickPrize()); }, []);

  const handleReveal = useCallback(() => {
    setRevealed(true);
    setTimeout(() => ctaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 450);
  }, []);

  const share = () => {
    if (!prize) return;
    const text = `지유의원 강남 수능 스크래치 당첨 🎉\n${prize.name} ${prize.price}\n너도 긁어봐!`;
    if (navigator.share) {
      navigator.share({ title: "수능 특가 스크래치", text, url: location.href });
    } else {
      navigator.clipboard.writeText(`${text}\n${location.href}`).then(() => alert("링크가 복사됐어요! 친구에게 공유해보세요 😊"));
    }
  };

  return (
    <div className="max-w-md mx-auto px-5 pt-12 pb-14 min-h-screen">
      {/* Header */}
      <div className="text-center mb-8">
        <span className="inline-block bg-[#FEF3ED] text-[#C5856A] text-sm font-semibold px-4 py-1.5 rounded-full mb-5">
          지유의원 강남 × 수능 특가
        </span>
        <h1 className="text-[32px] font-extrabold leading-[1.28] tracking-tight mb-3 break-keep">
          수능 끝난 너에게<br />
          선물이 도착했어요 🎁
        </h1>
        <p className="text-[#8E8E93] text-[15px] leading-relaxed break-keep">
          {revealed ? "축하해요! 예약 시 이 화면을 보여주세요." : "카드를 손가락으로 긁어서 혜택을 확인하세요"}
        </p>
      </div>

      {/* Card — reserve space until prize is picked to avoid layout shift */}
      {prize ? (
        <ScratchCard prize={prize} onReveal={handleReveal} />
      ) : (
        <div className="w-full aspect-[4/3] rounded-3xl bg-[#F0EDE8]" />
      )}

      {/* CTA after reveal */}
      <div
        ref={ctaRef}
        className={`transition-all duration-500 ${revealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none h-0 overflow-hidden"}`}
      >
        <div className="rounded-2xl p-5 text-center text-white mt-7 mb-5" style={{ background: "linear-gradient(135deg, #C5856A, #D4A090)" }}>
          <span className="inline-block bg-white/25 text-[11px] font-bold px-3 py-0.5 rounded-full tracking-wider mb-2">당첨 혜택 안내</span>
          <p className="text-[17px] font-extrabold mb-1">수험표 지참 시 당첨가 적용</p>
          <p className="text-[13px] opacity-85">2026.11.13 ~ 12.31 · 1인 1회</p>
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
