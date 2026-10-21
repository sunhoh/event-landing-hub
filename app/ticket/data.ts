// ─── Seoul Glow Ticket 설정 ───────────────────────────────────────────────────
// 기획: Plan/2026-10-21-Seoul-Glow-Ticket-기획.md
// ⚠️ TODO 표시된 값은 프로토타입용 임시값 — 실제 정보로 교체 필요

export interface Clinic {
  name: string;
  gate: string;      // 티켓에 찍히는 게이트 이름
  address: string;
  lat: number;
  lng: number;
  floor: string;
  hours: string;
  naverPlaceUrl?: string;
}

// TODO: 실제 주소·좌표·층수로 교체 (지금은 강남역 좌표)
export const CLINIC: Clinic = {
  name: "GU Clinic Gangnam",
  gate: "GU GANGNAM",
  address: "Gangnam-daero, Gangnam-gu, Seoul (TODO)",
  lat: 37.4979,
  lng: 127.0276,
  floor: "TODO F",
  hours: "Mon–Sat 10:00–20:00 (TODO)",
};

export const ICN = { code: "ICN", city: "Seoul", lat: 37.4602, lng: 126.4407 };

export interface City {
  code: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
}

// 출발 도시 — 타겟 국가 위주 (태국·미국·일본·중화권·동남아)
export const CITIES: City[] = [
  { code: "BKK", city: "Bangkok",          country: "Thailand",    lat: 13.69,  lng: 100.75 },
  { code: "LAX", city: "Los Angeles",      country: "USA",         lat: 33.94,  lng: -118.41 },
  { code: "JFK", city: "New York",         country: "USA",         lat: 40.64,  lng: -73.78 },
  { code: "NRT", city: "Tokyo",            country: "Japan",       lat: 35.77,  lng: 140.39 },
  { code: "KIX", city: "Osaka",            country: "Japan",       lat: 34.43,  lng: 135.24 },
  { code: "TPE", city: "Taipei",           country: "Taiwan",      lat: 25.08,  lng: 121.23 },
  { code: "HKG", city: "Hong Kong",        country: "Hong Kong",   lat: 22.31,  lng: 113.91 },
  { code: "PVG", city: "Shanghai",         country: "China",       lat: 31.14,  lng: 121.81 },
  { code: "SIN", city: "Singapore",        country: "Singapore",   lat: 1.36,   lng: 103.99 },
  { code: "SGN", city: "Ho Chi Minh City", country: "Vietnam",     lat: 10.82,  lng: 106.66 },
  { code: "MNL", city: "Manila",           country: "Philippines", lat: 14.51,  lng: 121.02 },
  { code: "CGK", city: "Jakarta",          country: "Indonesia",   lat: -6.13,  lng: 106.66 },
  { code: "SYD", city: "Sydney",           country: "Australia",   lat: -33.94, lng: 151.18 },
  { code: "LHR", city: "London",           country: "UK",          lat: 51.47,  lng: -0.45 },
  { code: "DXB", city: "Dubai",            country: "UAE",         lat: 25.25,  lng: 55.36 },
];

export const INTERESTS = [
  { key: "glass",   label: "Glass Skin Care" },
  { key: "lifting", label: "Lifting & Contour" },
  { key: "acne",    label: "Acne & Pores" },
  { key: "tone",    label: "Brightening & Tone" },
  { key: "booster", label: "Skin Booster" },
  { key: "consult", label: "Not sure yet — consult" },
] as const;
export type InterestKey = (typeof INTERESTS)[number]["key"];

export const CHANNELS = ["WhatsApp", "LINE", "Email"] as const;
export type Channel = (typeof CHANNELS)[number];

// ─── 티켓 ────────────────────────────────────────────────────────────────────
// 프로토타입: 티켓 정보를 URL(?t=)에 담아 서버 없이 다시 열 수 있게 함
// 연락처는 URL에 넣지 않음 (실서비스에선 서버 DB에 저장)

export interface Ticket {
  id: string;
  name: string;
  from: string;      // City.code
  date: string;      // 방문 예정일 YYYY-MM-DD (KST)
  interest: InterestKey;
  issued: number;    // 발권 시각 ms
}

export function encodeTicket(t: Ticket): string {
  const json = JSON.stringify(t);
  const b64 = btoa(String.fromCharCode(...new TextEncoder().encode(json)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeTicket(s: string): Ticket | null {
  try {
    const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const t = JSON.parse(new TextDecoder().decode(bytes)) as Ticket;
    if (!t.id || !t.name || !t.from || !t.date) return null;
    return t;
  } catch {
    return null;
  }
}

export function newTicketId(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export const cityByCode = (code: string) => CITIES.find((c) => c.code === code) ?? CITIES[0];

// ─── 거리·여정 계산 ───────────────────────────────────────────────────────────

export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const DAY = 86_400_000;

// 방문일 KST 자정
export const visitTime = (t: Ticket) => new Date(`${t.date}T00:00:00+09:00`).getTime();

// 발권 → 방문일 사이 진행률 (0~1). now에 데모용 날짜 이동을 더해서 넘김
export function journeyProgress(t: Ticket, now: number): number {
  const start = t.issued;
  const end = visitTime(t);
  if (end <= start) return 1;
  return Math.min(1, Math.max(0, (now - start) / (end - start)));
}

export function daysLeft(t: Ticket, now: number): number {
  return Math.ceil((visitTime(t) - now) / DAY);
}

// ─── 길찾기 링크 ──────────────────────────────────────────────────────────────
// 한국에선 구글맵 길찾기가 대중교통 위주로 제한적 → 네이버지도 우선

export function mapLinks(c: Clinic) {
  const q = encodeURIComponent(c.name);
  return {
    // TODO: 네이버 플레이스 URL 받으면 교체 (지금은 검색 링크)
    naver: c.naverPlaceUrl ?? `https://map.naver.com/p/search/${q}`,
    kakao: `https://map.kakao.com/link/to/${q},${c.lat},${c.lng}`,
    google: `https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}&travelmode=transit`,
  };
}
