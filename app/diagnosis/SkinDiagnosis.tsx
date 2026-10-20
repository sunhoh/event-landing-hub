"use client";

import { useState, useEffect, useRef } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

type Screen = "hero" | "quiz" | "result";

interface Option {
  emoji: string;
  text: string;
  score: number;
  tx?: string;
  exclusive?: boolean;
}

interface Question {
  step: string;
  text: string;
  sub?: string;
  type: "single" | "multiple";
  options: Option[];
}

interface Treatment {
  tag: string;
  name: string;
  desc: string;
  price: string;
}

interface Tier {
  max: number;
  level: string;
  emoji: string;
  color: string;
  title: string;
  msg: string;
}

// ─── Data ────────────────────────────────────────────────────────────────────

const QUESTIONS: Question[] = [
  {
    step: "1 / 4",
    text: "수능 준비하면서 마지막으로 피부과에 간 게 언제예요?",
    type: "single",
    options: [
      { emoji: "😱", text: "1년이 넘었어요",    score: 25 },
      { emoji: "😅", text: "6개월 ~ 1년",       score: 15 },
      { emoji: "🙂", text: "3 ~ 6개월 전",      score: 8  },
      { emoji: "✨", text: "최근에 다녀왔어요",   score: 0  },
    ],
  },
  {
    step: "2 / 4",
    text: "요즘 피부에서 느끼는 게 있나요?",
    sub: "해당하는 것 모두 선택해주세요",
    type: "multiple",
    options: [
      { emoji: "😩", text: "여드름·트러블이 생겼어요",     score: 15, tx: "acne"        },
      { emoji: "😔", text: "피부가 칙칙하고 어두워졌어요", score: 10, tx: "brightening" },
      { emoji: "😴", text: "다크서클이 심해졌어요",         score: 10, tx: "brightening" },
      { emoji: "🔍", text: "모공이 넓어진 것 같아요",       score: 10, tx: "pore"        },
      { emoji: "💧", text: "피부가 건조하고 당겨요",        score: 10, tx: "hydration"   },
      { emoji: "😊", text: "별다른 변화 없어요",            score: 0,  exclusive: true  },
    ],
  },
  {
    step: "3 / 4",
    text: "수능 준비 기간 동안 하루 평균 수면 시간은?",
    type: "single",
    options: [
      { emoji: "😵", text: "4시간 이하",  score: 25 },
      { emoji: "😪", text: "5 ~ 6시간",   score: 15 },
      { emoji: "😌", text: "7시간 이상",  score: 5  },
    ],
  },
  {
    step: "4 / 4",
    text: "수능 준비하면서 주로 어떻게 먹었나요?",
    type: "single",
    options: [
      { emoji: "🍜", text: "야식·편의점 음식 위주였어요",   score: 15 },
      { emoji: "☕", text: "커피를 하루 3잔 이상 마셨어요", score: 10 },
      { emoji: "🤷", text: "그냥 대충 먹었어요",            score: 5  },
      { emoji: "🥗", text: "규칙적으로 잘 챙겨먹었어요",   score: 0  },
    ],
  },
];

const TREATMENTS: Record<string, Treatment> = {
  package:     { tag: "베스트",     name: "수능 완주 패키지 ⭐",    desc: "피코토닝 + 여드름관리 + 진정팩",  price: "₩59,000" },
  acne:        { tag: "수험생 특가", name: "여드름 압출 + 진정 관리", desc: "트러블 피부 빠른 진정",            price: "₩29,000" },
  brightening: { tag: "체험가",     name: "피코 레이저 토닝",        desc: "스트레스성 색소·잡티·칙칙함 케어", price: "₩9,900"  },
  pore:        { tag: "수험생 특가", name: "스킨보톡스",              desc: "모공·피부결 개선, 당일 복귀 가능", price: "₩49,000" },
  hydration:   { tag: "수험생 특가", name: "수분 물광주사",            desc: "피부 속 수분 빠르게 충전",         price: "₩39,000" },
};

const TIERS: Tier[] = [
  {
    max: 24, level: "생존형", emoji: "✨", color: "#34C759",
    title: "피부가 생각보다 잘 버텼어요",
    msg: "수험 생활 동안 피부를 꽤 잘 관리했어요! 지금이 피부 관리를 시작하기 딱 좋은 타이밍이에요. 수능 끝난 기념으로 가볍게 케어 받아보세요.",
  },
  {
    max: 49, level: "지침형", emoji: "😮", color: "#FF9F0A",
    title: "피부가 살짝 지쳐있어요",
    msg: "수험 스트레스가 피부에 조금씩 쌓였어요. 지금 케어해주면 금방 회복될 수 있어요. 연말까지 환해질 수 있어요!",
  },
  {
    max: 74, level: "손상형", emoji: "😰", color: "#FF6B35",
    title: "피부가 많이 지쳐있어요",
    msg: "12년 공부의 흔적이 피부에 남아있어요. 수능도 끝났으니 그동안 못 챙겨준 피부를 돌봐줄 시간이에요. 전문의 상담으로 빠르게 회복할 수 있어요.",
  },
  {
    max: Infinity, level: "긴급형", emoji: "🆘", color: "#FF3B30",
    title: "피부가 SOS를 보내고 있어요",
    msg: "수능 스트레스가 피부에 고스란히 쌓여있어요. 걱정하지 마세요 — 지유의원 전문의가 맞춤 케어로 빠르게 회복시켜드릴게요.",
  },
];

// ─── Hero ────────────────────────────────────────────────────────────────────

function HeroScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center text-center px-5 pt-16 pb-12 min-h-screen">
      <span className="inline-block bg-[#FEF3ED] text-[#C5856A] text-sm font-semibold px-4 py-1.5 rounded-full mb-7">
        지유의원 강남 × 수능 특가
      </span>
      <h1 className="text-[36px] font-extrabold leading-[1.28] tracking-tight mb-5 break-keep">
        수능 끝났어요.<br />
        내 피부가 얼마나<br />
        지쳐있는지<br />
        확인해볼까요?
      </h1>
      <p className="text-[#8E8E93] text-base leading-relaxed mb-10 break-keep">
        1분 테스트로 수능 스트레스 피부 점수를 확인하고<br />
        맞춤 케어를 추천받아보세요.
      </p>
      <button
        onClick={onStart}
        className="w-full max-w-sm bg-[#C5856A] hover:bg-[#B07050] active:scale-[0.98] text-white font-bold text-lg py-[18px] rounded-2xl transition-all"
      >
        내 피부 진단하기 →
      </button>
      <p className="text-[#8E8E93] text-sm mt-4">수험생 인증 시 수능 특가 적용 · 12월 31일까지</p>
    </div>
  );
}

// ─── Quiz ────────────────────────────────────────────────────────────────────

function QuizScreen({
  question,
  qIndex,
  total,
  onNext,
}: {
  question: Question;
  qIndex: number;
  total: number;
  onNext: (score: number, symptoms: string[]) => void;
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    el.style.transition = "none";
    el.style.opacity = "0";
    el.style.transform = "translateX(16px)";
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        el.style.transition = "opacity 0.28s ease, transform 0.28s ease";
        el.style.opacity = "1";
        el.style.transform = "translateX(0)";
      })
    );
    setSelected(new Set());
  }, [qIndex]);

  const toggle = (i: number) => {
    const opt = question.options[i];
    if (question.type === "single") {
      setSelected(new Set([i]));
      return;
    }
    setSelected((prev) => {
      const next = new Set(prev);
      if (opt.exclusive) {
        next.clear();
        next.add(i);
        return next;
      }
      question.options.forEach((o, idx) => { if (o.exclusive) next.delete(idx); });
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  const handleNext = () => {
    let score = 0;
    const symptoms: string[] = [];
    selected.forEach((i) => {
      score += question.options[i].score;
      const tx = question.options[i].tx;
      if (tx) symptoms.push(tx);
    });
    onNext(score, symptoms);
  };

  const progress = ((qIndex + 1) / total) * 100;

  return (
    <div className="flex flex-col px-5 pt-6 pb-10 min-h-screen max-w-lg mx-auto">
      {/* Progress */}
      <div className="flex items-center gap-3 mb-8">
        <div className="flex-1 h-1.5 bg-[#F0EDE8] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#C5856A] rounded-full transition-[width] duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-xs font-semibold text-[#8E8E93] shrink-0">{question.step}</span>
      </div>

      {/* Question */}
      <div ref={wrapRef} className="flex-1">
        <h2 className="text-2xl font-bold leading-snug mb-2 break-keep">{question.text}</h2>
        {question.sub && <p className="text-sm text-[#8E8E93] mb-1">{question.sub}</p>}
        <div className="flex flex-col gap-3 mt-6">
          {question.options.map((opt, i) => {
            const isSelected = selected.has(i);
            return (
              <button
                key={i}
                onClick={() => toggle(i)}
                className={`flex items-center gap-3.5 w-full text-left px-4 py-4 rounded-xl border-[1.5px] transition-all active:scale-[0.98] shadow-sm
                  ${isSelected ? "border-[#C5856A] bg-[#FEF3ED]" : "border-[#F0EDE8] bg-white"}`}
              >
                <span className="text-2xl w-7 text-center shrink-0">{opt.emoji}</span>
                <span className="flex-1 text-[15px] font-medium break-keep">{opt.text}</span>
                {question.type === "multiple" && (
                  <span className={`text-base font-bold text-[#C5856A] shrink-0 transition-opacity ${isSelected ? "opacity-100" : "opacity-0"}`}>
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Next button */}
      <div className="pt-5">
        <button
          onClick={handleNext}
          disabled={selected.size === 0}
          className="w-full bg-[#C5856A] hover:bg-[#B07050] disabled:bg-[#DDD] disabled:cursor-not-allowed text-white font-bold text-lg py-[18px] rounded-2xl transition-all active:scale-[0.98]"
        >
          다음
        </button>
      </div>
    </div>
  );
}

// ─── Score Circle ─────────────────────────────────────────────────────────────

function ScoreCircle({ score, tier }: { score: number; tier: Tier }) {
  const [displayed, setDisplayed] = useState(0);
  const C = 283;

  useEffect(() => {
    let start: number | null = null;
    const dur = 1300;
    const tick = (ts: number) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / dur, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setDisplayed(Math.round(ease * score));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [score]);

  return (
    <div className="relative w-40 h-40 mx-auto mb-5">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="45" fill="none" stroke="#F0EDE8" strokeWidth="8" />
        <circle
          cx="50" cy="50" r="45" fill="none"
          stroke={tier.color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={C * (1 - displayed / 100)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl leading-none mb-1">{tier.emoji}</span>
        <span className="text-[38px] font-extrabold tracking-tight leading-none" style={{ color: tier.color }}>
          {displayed}
        </span>
        <span className="text-xs text-[#8E8E93] mt-0.5">/ 100</span>
      </div>
    </div>
  );
}

// ─── Result ──────────────────────────────────────────────────────────────────

function ResultScreen({ rawScore, symptoms }: { rawScore: number; symptoms: string[] }) {
  const displayScore = Math.min(100, Math.round((rawScore / 120) * 100));
  const tier = TIERS.find((t) => rawScore <= t.max)!;

  const seen = new Set<string>();
  const recs: Treatment[] = [];
  if (rawScore >= 50) { recs.push(TREATMENTS.package); seen.add("package"); }
  [...new Set(symptoms)].forEach((k) => {
    if (!seen.has(k) && recs.length < 3) { recs.push(TREATMENTS[k]); seen.add(k); }
  });
  if (recs.length === 0) { recs.push(TREATMENTS.brightening, TREATMENTS.hydration); }

  const share = () => {
    const text = `내 수험생 피부 스트레스 점수: ${displayScore}/100 ${tier.emoji}\n지유의원 강남에서 수능 특가 케어 받을 수 있어요!`;
    if (navigator.share) {
      navigator.share({ title: "수험생 피부 스트레스 진단", text, url: location.href });
    } else {
      navigator.clipboard.writeText(text).then(() => alert("결과가 복사됐어요! 친구에게 공유해보세요 😊"));
    }
  };

  return (
    <div className="max-w-lg mx-auto px-5 pt-8 pb-12">
      {/* Score */}
      <div className="text-center mb-6">
        <ScoreCircle score={displayScore} tier={tier} />
        <p className="text-sm font-bold tracking-widest mb-2" style={{ color: tier.color }}>{tier.level}</p>
        <h2 className="text-[22px] font-extrabold mb-3 break-keep">{tier.title}</h2>
        <p className="text-[15px] text-[#8E8E93] leading-relaxed break-keep">{tier.msg}</p>
      </div>

      {/* Treatments */}
      <div className="mb-6">
        <h3 className="text-[17px] font-bold mb-3">전문의 추천 케어</h3>
        <div className="flex flex-col gap-2.5">
          {recs.map((t, i) => (
            <div key={i} className="bg-white border border-[#F0EDE8] rounded-xl p-4 shadow-sm">
              <span className="inline-block bg-[#FEF3ED] text-[#C5856A] text-[11px] font-bold px-2 py-0.5 rounded-md mb-2">{t.tag}</span>
              <p className="text-base font-bold mb-0.5">{t.name}</p>
              <p className="text-[13px] text-[#8E8E93] mb-1.5">{t.desc}</p>
              <p className="text-lg font-extrabold text-[#C5856A]">{t.price}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Offer banner */}
      <div className="rounded-2xl p-5 text-center text-white mb-5" style={{ background: "linear-gradient(135deg, #C5856A, #D4A090)" }}>
        <span className="inline-block bg-white/25 text-[11px] font-bold px-3 py-0.5 rounded-full tracking-wider mb-2">수능 특가</span>
        <p className="text-[18px] font-extrabold mb-1">수험생 인증 시 전 시술 49% 할인</p>
        <p className="text-[13px] opacity-85">2026.11.13 ~ 12.31 · 수험표 지참</p>
      </div>

      {/* CTA */}
      <a href="#" className="block w-full bg-[#C5856A] hover:bg-[#B07050] text-white text-center font-bold text-lg py-[18px] rounded-2xl transition-all mb-3">
        지금 예약하기
      </a>
      <a href="#" className="block w-full bg-[#FEE500] text-[#1C1C1E] text-center font-bold text-lg py-[18px] rounded-2xl transition-all mb-3">
        💬 카카오 상담하기
      </a>
      <button
        onClick={share}
        className="w-full border border-[#F0EDE8] text-[#8E8E93] font-semibold text-[15px] py-4 rounded-2xl hover:border-[#C5856A] hover:text-[#C5856A] transition-all"
      >
        📤 결과 친구한테 공유하기
      </button>

      <p className="text-center text-xs text-[#8E8E93] mt-5">지유의원 강남 · 피부과 전문의 직접 시술</p>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function SkinDiagnosis() {
  const [screen, setScreen] = useState<Screen>("hero");
  const [currentQ, setCurrentQ] = useState(0);
  const [totalScore, setTotalScore] = useState(0);
  const [allSymptoms, setAllSymptoms] = useState<string[]>([]);

  const handleNext = (score: number, symptoms: string[]) => {
    const newScore = totalScore + score;
    const newSymptoms = [...allSymptoms, ...symptoms];
    const nextQ = currentQ + 1;

    setTotalScore(newScore);
    setAllSymptoms(newSymptoms);

    if (nextQ < QUESTIONS.length) {
      setCurrentQ(nextQ);
    } else {
      setScreen("result");
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  };

  if (screen === "hero")   return <HeroScreen onStart={() => setScreen("quiz")} />;
  if (screen === "result") return <ResultScreen rawScore={totalScore} symptoms={allSymptoms} />;
  return <QuizScreen question={QUESTIONS[currentQ]} qIndex={currentQ} total={QUESTIONS.length} onNext={handleNext} />;
}
