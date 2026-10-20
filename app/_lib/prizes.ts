// 이벤트 페이지 공통 경품 데이터 (/scratch, /pick, /slot)

export interface Prize {
  emoji: string;  // 슬롯 심볼 등 이미지 대체용
  tag: string;
  name: string;
  desc: string;
  price: string;
  weight: number;
}

export const PRIZES: Prize[] = [
  { emoji: "✨", tag: "체험가",     name: "피코 레이저 토닝",        desc: "스트레스성 색소·잡티·칙칙함 케어", price: "₩9,900",  weight: 30 },
  { emoji: "🧴", tag: "수험생 특가", name: "여드름 압출 + 진정 관리", desc: "트러블 피부 빠른 진정",            price: "₩29,000", weight: 25 },
  { emoji: "💧", tag: "수험생 특가", name: "수분 물광주사",            desc: "피부 속 수분 빠르게 충전",         price: "₩39,000", weight: 15 },
  { emoji: "💎", tag: "수험생 특가", name: "스킨보톡스",              desc: "모공·피부결 개선, 당일 복귀 가능", price: "₩49,000", weight: 15 },
  { emoji: "⭐", tag: "베스트",     name: "수능 완주 패키지 ⭐",    desc: "피코토닝 + 여드름관리 + 진정팩",  price: "₩59,000", weight: 10 },
  { emoji: "🍀", tag: "행운",       name: "전문의 1:1 상담권",       desc: "피부과 전문의 무료 피부 상담",     price: "무료",    weight: 5  },
];

// 가중치 랜덤 — 클라이언트에서만 호출 (SSR에서 호출하면 hydration 불일치)
export function pickPrize(): Prize {
  const total = PRIZES.reduce((s, p) => s + p.weight, 0);
  let r = Math.random() * total;
  for (const p of PRIZES) {
    r -= p.weight;
    if (r < 0) return p;
  }
  return PRIZES[0];
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
