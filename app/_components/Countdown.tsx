"use client";

import { useState, useEffect } from "react";

// ─── Hooks ───────────────────────────────────────────────────────────────────

// 현재 시각 (1초 갱신). 마운트 전에는 null — SSR과 시간이 달라 hydration 불일치 방지
export function useNow(): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

// 개인별 마감 시각 — active가 되는 순간 시작, 새로고침해도 유지(localStorage)
export function usePersonalDeadline(key: string, hours: number, active: boolean): number | null {
  const [deadline, setDeadline] = useState<number | null>(null);
  useEffect(() => {
    if (!active) return;
    const storageKey = `gu-deadline:${key}`;
    let saved: number | null = null;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw && !Number.isNaN(Number(raw))) saved = Number(raw);
    } catch {}
    const next = saved ?? Date.now() + hours * 3_600_000;
    if (saved === null) {
      try { localStorage.setItem(storageKey, String(next)); } catch {}
    }
    setDeadline(next);
  }, [key, hours, active]);
  return deadline;
}

export function splitRemaining(ms: number) {
  const t = Math.max(0, Math.floor(ms / 1000));
  return {
    d: Math.floor(t / 86400),
    h: Math.floor((t % 86400) / 3600),
    m: Math.floor((t % 3600) / 60),
    s: t % 60,
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

// ─── Inline (배너·버튼 옆 조합용) ─────────────────────────────────────────────

export function CountdownInline({
  deadline,
  label = "혜택 소멸까지",
  expiredText = "혜택 유지 시간이 끝났어요",
  className = "",
}: {
  deadline: number | null;
  label?: string;
  expiredText?: string;
  className?: string;
}) {
  const now = useNow();
  const ready = now !== null && deadline !== null;
  const left = ready ? deadline - now : 0;

  if (ready && left <= 0) {
    return <span className={`inline-flex items-center gap-1.5 ${className}`}>⌛ {expiredText}</span>;
  }

  const { d, h, m, s } = splitRemaining(left);
  const hours = d * 24 + h;
  const urgent = ready && left < 3_600_000;

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span className={urgent ? "animate-pulse" : ""}>⏰</span>
      <span>{label}</span>
      <span className="font-mono font-extrabold tabular-nums tracking-tight">
        {ready ? `${pad(hours)}:${pad(m)}:${pad(s)}` : "--:--:--"}
      </span>
    </span>
  );
}

// ─── Boxes (단독 페이지 메인 타이머) ──────────────────────────────────────────

export function CountdownBoxes({ deadline }: { deadline: number }) {
  const now = useNow();
  const { d, h, m, s } = splitRemaining(now === null ? 0 : deadline - now);
  const units = [
    ...(d > 0 || now === null ? [{ v: d, l: "일" }] : []),
    { v: h, l: "시간" },
    { v: m, l: "분" },
    { v: s, l: "초" },
  ];

  return (
    <div className="flex items-start justify-center gap-2">
      {units.map((u, i) => (
        <div key={u.l} className="flex items-start gap-2">
          {i > 0 && <span className="text-[32px] font-extrabold text-[#C5856A]/50 leading-[64px]">:</span>}
          <div className="flex flex-col items-center">
            <span className="w-[64px] h-[64px] flex items-center justify-center bg-[#1C1C1E] text-white text-[32px] font-extrabold font-mono tabular-nums rounded-xl shadow-md">
              {now === null ? "--" : pad(u.v)}
            </span>
            <span className="text-[11px] font-semibold text-[#8E8E93] mt-1.5">{u.l}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
