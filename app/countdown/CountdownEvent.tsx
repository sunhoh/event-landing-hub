"use client";

import { PRIZES } from "../_lib/prizes";
import { EVENT_START, EVENT_END } from "../_lib/event";
import { CountdownBoxes, CountdownInline, useNow } from "../_components/Countdown";

// 특가 메뉴 = 경품 중 시술만 (상담권 제외)
const MENU = PRIZES.filter((p) => p.tag !== "행운");

type Phase = "before" | "live" | "ended";

export default function CountdownEvent() {
  const now = useNow();
  const phase: Phase = now === null || now < EVENT_START ? "before" : now < EVENT_END ? "live" : "ended";
  const deadline = phase === "before" ? EVENT_START : EVENT_END;

  const copy = {
    before: { badge: "COMING SOON",  title: <>수능 끝나는 날,<br />특가가 열려요</>,          timer: "오픈까지",  cta: "💬 카카오 채널 추가하고 오픈 알림 받기", bar: "오픈까지" },
    live:   { badge: "NOW OPEN",     title: <>수험생 특가,<br />이 가격은 곧 끝나요</>,      timer: "마감까지",  cta: "지금 특가로 예약하기",                   bar: "마감까지" },
    ended:  { badge: "CLOSED",       title: <>수능 특가가<br />종료됐어요</>,                timer: "",          cta: "💬 다음 이벤트 알림 받기",              bar: "" },
  }[phase];

  return (
    <div className="max-w-md mx-auto px-5 pt-12 pb-32 min-h-screen">
      {/* Header */}
      <div className="text-center mb-8">
        <span className="inline-block bg-[#FEF3ED] text-[#C5856A] text-sm font-semibold px-4 py-1.5 rounded-full mb-5">
          지유의원 강남 × 수능 특가
        </span>
        <p className={`text-xs font-extrabold tracking-[0.25em] mb-2 ${phase === "live" ? "text-[#FF3B30]" : "text-[#C5856A]"}`}>
          {phase === "live" && <span className="inline-block w-2 h-2 rounded-full bg-[#FF3B30] animate-pulse mr-1.5 align-middle" />}
          {copy.badge}
        </p>
        <h1 className="text-[32px] font-extrabold leading-[1.28] tracking-tight break-keep">{copy.title}</h1>
      </div>

      {/* Timer */}
      {phase !== "ended" && (
        <div className="bg-white border border-[#F0EDE8] rounded-3xl px-4 pt-5 pb-4 shadow-sm mb-8">
          <p className="text-center text-sm font-bold text-[#8E8E93] mb-4">{copy.timer}</p>
          <CountdownBoxes deadline={deadline} />
          <p className="text-center text-xs text-[#8E8E93] mt-4">2026.11.13 ~ 12.31 · 수험표 지참 시 적용</p>
        </div>
      )}

      {/* Menu */}
      <h2 className="text-[17px] font-bold mb-3">수험생 특가 메뉴</h2>
      <div className="flex flex-col gap-2.5 mb-8">
        {MENU.map((t) => (
          <div key={t.name} className="flex items-center gap-3 bg-white border border-[#F0EDE8] rounded-xl p-4 shadow-sm">
            <span className="text-2xl w-8 text-center shrink-0">{t.emoji}</span>
            <div className="flex-1 min-w-0">
              <span className="inline-block bg-[#FEF3ED] text-[#C5856A] text-[11px] font-bold px-2 py-0.5 rounded-md mb-1">{t.tag}</span>
              <p className="text-[15px] font-bold break-keep">{t.name}</p>
              <p className="text-[12px] text-[#8E8E93] break-keep">{t.desc}</p>
            </div>
            <p className="text-lg font-extrabold text-[#C5856A] shrink-0">{t.price}</p>
          </div>
        ))}
      </div>

      <a href="#" className="block w-full bg-[#FEE500] text-[#1C1C1E] text-center font-bold text-lg py-[18px] rounded-2xl transition-all mb-3">
        💬 카카오 상담하기
      </a>

      <p className="text-center text-xs text-[#8E8E93] mt-6">지유의원 강남 · 피부과 전문의 직접 시술</p>

      {/* Sticky bottom bar — 스크롤해도 타이머 + CTA 항상 노출 */}
      <div className="fixed inset-x-0 bottom-0 z-20 bg-white/95 backdrop-blur border-t border-[#F0EDE8] px-5 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        <div className="max-w-md mx-auto">
          {phase !== "ended" && (
            <p className={`text-center text-[13px] mb-2 ${phase === "live" ? "text-[#FF3B30]" : "text-[#C5856A]"}`}>
              <CountdownInline deadline={deadline} label={copy.bar} />
            </p>
          )}
          <a href="#" className="block w-full bg-[#C5856A] hover:bg-[#B07050] text-white text-center font-bold text-[17px] py-4 rounded-2xl transition-all">
            {copy.cta}
          </a>
        </div>
      </div>
    </div>
  );
}
