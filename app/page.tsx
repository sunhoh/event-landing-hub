import Link from "next/link";

// ─── Routes ──────────────────────────────────────────────────────────────────
// 새 이벤트 페이지를 만들면 여기에 추가

interface EventRoute {
  href: string;
  emoji: string;
  title: string;
  desc: string;
  tag: string;
}

const ROUTES: EventRoute[] = [
  { href: "/logo-qr",   emoji: "🧊", title: "3D 로고 QR",            desc: "QR 바닥 위 3D 로고 → 탭하면 스캔 가능한 QR로 접힘", tag: "QR" },
  { href: "/diagnosis", emoji: "🩺", title: "수험생 피부 스트레스 진단", desc: "4문항 퀴즈 → 피부 점수 → 맞춤 시술 추천", tag: "퀴즈형" },
  { href: "/scratch",   emoji: "🎁", title: "수능 특가 스크래치 카드",   desc: "카드 긁기 → 당첨 결과 확인 → 예약 CTA", tag: "스크래치" },
  { href: "/pick",      emoji: "🃏", title: "수능 특가 카드 뽑기",       desc: "6장 중 1장 선택 → 뒤집기 → 쿠폰 확인",   tag: "카드 뒤집기" },
  { href: "/slot",      emoji: "🎰", title: "수능 특가 슬롯머신",        desc: "버튼 누르기 → 3칸 회전 → 맞으면 당첨 (3회)", tag: "슬롯머신" },
  { href: "/countdown", emoji: "⏰", title: "수능 특가 카운트다운",      desc: "오픈·마감 타이머 + 특가 메뉴 + 하단 고정 CTA", tag: "카운트다운" },
  { href: "/game",      emoji: "⚡", title: "트러블 헌터 30초 챌린지",   desc: "30초 플레이 → 점수 → 등급별 쿠폰 → 도전장 공유", tag: "미니게임" },
  { href: "/memory",    emoji: "🧠", title: "피부 짝꿍 찾기",            desc: "4→8→16→24→40장 단계별 카드 맞추기 → 등급 쿠폰", tag: "미니게임" },
];

export default function Home() {
  return (
    <div className="max-w-lg mx-auto px-5 pt-12 pb-14 min-h-screen">
      <div className="mb-8">
        {/* <span className="inline-block bg-[#FEF3ED] text-[#C5856A] text-sm font-semibold px-4 py-1.5 rounded-full mb-4">
          지유의원 강남
        </span> */}
        <h1 className="text-[28px] font-extrabold tracking-tight mb-1">이벤트 페이지</h1>
        <p className="text-[#8E8E93] text-[15px]">{ROUTES.length}개 페이지 · 눌러서 바로 이동</p>
      </div>

      <ul className="flex flex-col gap-3">
        {ROUTES.map((r) => (
          <li key={r.href}>
            <Link
              href={r.href}
              className="flex items-center gap-4 bg-white border-[1.5px] border-[#F0EDE8] rounded-2xl px-4 py-4 shadow-sm transition-all hover:border-[#C5856A] active:scale-[0.98]"
            >
              <span className="text-3xl w-10 text-center shrink-0">{r.emoji}</span>
              <span className="flex-1 min-w-0">
                <span className="flex items-center gap-2 mb-0.5">
                  <span className="text-base font-bold truncate">{r.title}</span>
                  <span className="shrink-0 bg-[#FEF3ED] text-[#C5856A] text-[11px] font-bold px-2 py-0.5 rounded-md">{r.tag}</span>
                </span>
                <span className="block text-[13px] text-[#8E8E93] break-keep">{r.desc}</span>
                <span className="block text-xs text-[#C5856A] font-mono mt-1">{r.href}</span>
              </span>
              <span className="text-[#C5856A] text-lg font-bold shrink-0">→</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
