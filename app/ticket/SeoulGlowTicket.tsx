"use client";

import { useEffect, useMemo, useState } from "react";
import Globe from "./Globe";
import {
  CHANNELS, CITIES, CLINIC, ICN, INTERESTS,
  cityByCode, daysLeft, decodeTicket, encodeTicket, haversineKm, journeyProgress, mapLinks, newTicketId,
  type Channel, type InterestKey, type Ticket,
} from "./data";

// ─── Config ──────────────────────────────────────────────────────────────────

const DAY = 86_400_000;
const LAST_KEY = "sgt:last";
const stampKey = (id: string) => `sgt:stamps:${id}`;
const NAVY = "#1f2a44";
const PEACH = "#C5856A";

// localStorage는 막혀 있을 수 있음 (사파리 비공개 모드 등)
const store = {
  get(k: string) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string) { try { localStorage.setItem(k, v); } catch {} },
  del(k: string) { try { localStorage.removeItem(k); } catch {} },
};

const todayKST = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
const fmtDate = (d: string) =>
  new Date(`${d}T00:00:00+09:00`).toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Seoul" }).toUpperCase();
const interestLabel = (k: InterestKey) => INTERESTS.find((i) => i.key === k)?.label ?? "";

// ─── Page ────────────────────────────────────────────────────────────────────

export default function SeoulGlowTicket() {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [ready, setReady] = useState(false);
  const [justIssued, setJustIssued] = useState(false);
  const [offsetDays, setOffsetDays] = useState(0); // 데모: 날짜 앞당기기
  const [inSeoul, setInSeoul] = useState(false);   // "이미 서울이에요" 수동 전환

  // URL ?t= → 없으면 마지막 티켓
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("t");
    const found = (t && decodeTicket(t)) || (store.get(LAST_KEY) && decodeTicket(store.get(LAST_KEY)!));
    if (found) setTicket(found);
    setReady(true);
  }, []);

  const issue = (t: Ticket) => {
    const enc = encodeTicket(t);
    store.set(LAST_KEY, enc);
    window.history.replaceState(null, "", `?t=${enc}`);
    setOffsetDays(0);
    setInSeoul(false);
    setJustIssued(true);
    setTicket(t);
    window.scrollTo({ top: 0 });
  };

  const reset = () => {
    store.del(LAST_KEY);
    window.history.replaceState(null, "", window.location.pathname);
    setTicket(null);
    setJustIssued(false);
  };

  if (!ready) return <div className="min-h-screen" style={{ background: NAVY }} />;

  return (
    <div className="min-h-screen text-[#1f2a44]" style={{ background: NAVY }}>
      <div className={`max-w-md mx-auto px-4 pb-40 ${ticket ? "pt-5" : "pt-8"}`}>
        {!ticket && <Header />}
        {ticket ? (
          <TicketView
            ticket={ticket}
            justIssued={justIssued}
            offsetDays={offsetDays}
            inSeoul={inSeoul}
            setInSeoul={setInSeoul}
            onReset={reset}
          />
        ) : (
          <IssueForm onIssue={issue} />
        )}
      </div>
      {ticket && <DemoPanel ticket={ticket} offsetDays={offsetDays} setOffsetDays={setOffsetDays} />}
    </div>
  );
}

function Header() {
  return (
    <div className="text-center text-white mb-6">
      <p className="text-[11px] tracking-[0.35em] text-[#f2b896] font-semibold">GU CLINIC GANGNAM</p>
      <h1 className="text-[28px] font-extrabold tracking-tight mt-1">Seoul Glow Trip ✈️</h1>
      <p className="text-sm text-white/70 mt-1">Your K-skin journey, from your city to our door.</p>
    </div>
  );
}

// ─── ① 발권 폼 ───────────────────────────────────────────────────────────────

function IssueForm({ onIssue }: { onIssue: (t: Ticket) => void }) {
  const [name, setName] = useState("");
  const [from, setFrom] = useState(CITIES[0].code);
  const [date, setDate] = useState("");
  const [interest, setInterest] = useState<InterestKey>("glass");
  const [channel, setChannel] = useState<Channel>("WhatsApp");
  const [contact, setContact] = useState("");
  const [agree, setAgree] = useState(false);
  const [printing, setPrinting] = useState(false);

  const valid = name.trim().length >= 2 && date >= todayKST() && contact.trim().length >= 3 && agree;

  const submit = () => {
    if (!valid || printing) return;
    setPrinting(true);
    // TODO: 실서비스에선 여기서 서버로 리드 전송 (이름·연락처·방문일·관심 시술·유입 경로)
    setTimeout(() => {
      onIssue({ id: newTicketId(), name: name.trim().toUpperCase(), from, date, interest, issued: Date.now() });
    }, 1100);
  };

  return (
    <div className={`bg-white rounded-3xl shadow-xl overflow-hidden ${printing ? "animate-[ticket-print_1.1s_ease-in_forwards]" : ""}`}>
      <div className="px-5 py-3 flex items-center justify-between text-white" style={{ background: PEACH }}>
        <span className="text-[11px] font-bold tracking-[0.25em]">BOARDING PASS</span>
        <span className="text-[11px] font-mono">GATE · {CLINIC.gate}</span>
      </div>

      <div className="p-5 flex flex-col gap-4">
        <Field label="PASSENGER NAME">
          <input
            value={name}
            onChange={(e) => setName(e.target.value.replace(/[^a-zA-Z .'-]/g, ""))}
            placeholder="EMMA WATSON"
            className="w-full text-lg font-bold uppercase tracking-wide outline-none placeholder:text-[#d6d2cc]"
            autoComplete="name"
          />
        </Field>

        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
          <Field label="FROM">
            <select value={from} onChange={(e) => setFrom(e.target.value)} className="w-full min-w-0 text-lg font-bold font-mono outline-none bg-transparent">
              {CITIES.map((c) => (
                <option key={c.code} value={c.code}>{c.code} · {c.city}</option>
              ))}
            </select>
          </Field>
          <span className="pb-3 text-xl" style={{ color: PEACH }}>✈</span>
          <Field label="TO">
            <p className="text-lg font-bold font-mono">ICN · Seoul</p>
          </Field>
        </div>

        <Field label="VISIT DATE">
          <input type="date" value={date} min={todayKST()} onChange={(e) => setDate(e.target.value)} className="w-full text-lg font-bold font-mono outline-none bg-transparent" />
        </Field>

        <div>
          <Label>CLASS · WHAT BRINGS YOU</Label>
          <div className="flex flex-wrap gap-2 mt-2">
            {INTERESTS.map((i) => (
              <button
                key={i.key}
                onClick={() => setInterest(i.key)}
                className={`text-[13px] font-semibold px-3 py-1.5 rounded-full border-[1.5px] transition-colors ${interest === i.key ? "text-white border-transparent" : "border-[#ece8e2] text-[#5b6478]"}`}
                style={interest === i.key ? { background: NAVY } : undefined}
              >
                {i.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label>SEND MY TICKET VIA</Label>
          <div className="flex gap-2 mt-2">
            {CHANNELS.map((c) => (
              <button
                key={c}
                onClick={() => setChannel(c)}
                className={`flex-1 text-[13px] font-bold py-2 rounded-xl border-[1.5px] ${channel === c ? "border-[#C5856A] text-[#C5856A] bg-[#FEF3ED]" : "border-[#ece8e2] text-[#8E8E93]"}`}
              >
                {c}
              </button>
            ))}
          </div>
          <input
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder={channel === "Email" ? "you@email.com" : channel === "LINE" ? "LINE ID" : "+66 81 234 5678"}
            className="mt-2 w-full border-[1.5px] border-[#ece8e2] rounded-xl px-3 py-2.5 text-[15px] outline-none focus:border-[#C5856A]"
            inputMode={channel === "Email" ? "email" : channel === "WhatsApp" ? "tel" : "text"}
          />
        </div>

        <label className="flex gap-2 items-start text-[12px] text-[#8E8E93] leading-snug">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 accent-[#C5856A]" />
          {/* TODO: 국가별 개인정보 수집·이용 동의 문구 확정 */}
          I agree that GU Clinic may contact me about my visit using the details above. (Privacy notice — TODO)
        </label>
      </div>

      <Perforation />

      <div className="p-5 pt-3">
        <button
          onClick={submit}
          disabled={!valid || printing}
          className="w-full py-4 rounded-2xl text-white text-base font-extrabold tracking-wide transition-all active:scale-[0.98] disabled:opacity-35"
          style={{ background: PEACH }}
        >
          {printing ? "Printing your ticket…" : "Issue my Glow Ticket ✈"}
        </button>
      </div>
    </div>
  );
}

// ─── ②~⑤ 티켓 화면 ────────────────────────────────────────────────────────────

function TicketView({
  ticket, justIssued, offsetDays, inSeoul, setInSeoul, onReset,
}: {
  ticket: Ticket; justIssued: boolean; offsetDays: number; inSeoul: boolean;
  setInSeoul: (v: boolean) => void; onReset: () => void;
}) {
  const now = Date.now() + offsetDays * DAY;
  const from = cityByCode(ticket.from);
  const progress = journeyProgress(ticket, now);
  const left = daysLeft(ticket, now);
  const landed = left <= 0 || inSeoul;
  const totalKm = haversineKm(from.lat, from.lng, ICN.lat, ICN.lng);
  const remainKm = Math.round(totalKm * (1 - progress));
  const status = landed ? "LANDED" : left <= 7 ? "BOARDING SOON" : "IN FLIGHT";

  return (
    <div className="flex flex-col gap-5">
      {/* 지구본 — 메인 */}
      <section className={`-mx-4 text-white text-center ${justIssued ? "animate-[hero-in_0.9s_ease-out]" : ""}`}>
        <p className="text-[11px] tracking-[0.35em] text-[#f2b896] font-semibold">SEOUL GLOW TRIP · {CLINIC.gate}</p>
        <p className="text-[22px] font-extrabold tracking-tight mt-1.5 px-4">
          {landed ? `You've landed, ${firstName(ticket)} ✨` : `Hi ${firstName(ticket)}, ${Math.round(progress * 100)}% of the way to Seoul`}
        </p>
        <div className="relative mt-1" style={{ background: "radial-gradient(circle at 50% 50%, #2b3a5e 0%, rgba(31,42,68,0) 70%)" }}>
          <Globe from={{ code: from.code, lat: from.lat, lng: from.lng }} to={ICN} progress={progress} landed={landed} />
        </div>
        <div className="px-6 -mt-3">
          {landed ? (
            <p className="text-sm text-white/60">Your ticket now guides you to our door ↓</p>
          ) : (
            <>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${progress * 100}%`, background: "#f2b896" }} />
              </div>
              <div className="flex justify-between text-[12px] text-white/60 font-mono mt-2">
                <span>{from.code}</span>
                <span className="text-[#f2b896] font-bold">{status} · D-{left}</span>
                <span>ICN</span>
              </div>
              <p className="text-[12px] text-white/45 mt-1">{remainKm.toLocaleString()} km to go · open again to watch your plane move</p>
            </>
          )}
        </div>
      </section>

      <Tabs
        key={landed ? "landed" : "flight"}
        initial={landed ? "guide" : "ticket"}
        tabs={[
          { key: "ticket", label: "Ticket", node: <BoardingPass ticket={ticket} left={left} status={status} animate={justIssued} inset /> },
          landed
            ? { key: "guide", label: "Directions", node: <ArrivalGuide /> }
            : { key: "guide", label: "Before you fly", node: <BeforeYouFly left={left} onInSeoul={() => setInSeoul(true)} /> },
          { key: "miles", label: "Glow Miles", node: <GlowMiles ticket={ticket} landed={landed} /> },
          { key: "keep", label: "Keep handy", node: <SaveShare ticket={ticket} /> },
        ]}
      />

      <button onClick={onReset} className="text-[13px] text-white/50 underline underline-offset-4 mx-auto">
        Issue a new ticket
      </button>
    </div>
  );
}

const firstName = (t: Ticket) => t.name.split(" ")[0];

// ─── 탭 ──────────────────────────────────────────────────────────────────────

function Tabs({ tabs, initial }: { tabs: { key: string; label: string; node: React.ReactNode }[]; initial?: string }) {
  const [active, setActive] = useState(initial ?? tabs[0].key);
  const current = tabs.find((t) => t.key === active) ?? tabs[0];
  return (
    <section className="bg-white rounded-3xl shadow-xl overflow-hidden">
      <div className="flex p-1.5 gap-1 bg-[#f4f2ef] m-3 rounded-2xl">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActive(t.key)}
            className={`flex-1 min-w-0 px-1 py-2 rounded-xl text-[12px] font-bold leading-tight transition-all ${current.key === t.key ? "bg-white shadow-sm text-[#1f2a44]" : "text-[#8E8E93]"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div key={current.key} className={`${current.key === "ticket" ? "px-3 pb-3" : "px-5 pb-5"} pt-1 animate-[tab-in_0.25s_ease-out]`}>{current.node}</div>
    </section>
  );
}

function BoardingPass({ ticket, left, status, animate, inset }: { ticket: Ticket; left: number; status: string; animate: boolean; inset?: boolean }) {
  const from = cityByCode(ticket.from);
  return (
    <div className={`bg-white rounded-3xl overflow-hidden ${inset ? "border-[1.5px] border-[#F0EDE8]" : "shadow-xl"} ${animate ? "animate-[ticket-in_0.7s_cubic-bezier(.2,.9,.3,1.2)]" : ""}`}>
      <div className="px-5 py-3 flex items-center justify-between text-white" style={{ background: PEACH }}>
        <span className="text-[11px] font-bold tracking-[0.25em]">SEOUL GLOW TRIP</span>
        <span className="text-[11px] font-mono">SGT-{ticket.id}</span>
      </div>

      <div className="p-5">
        <Label>PASSENGER</Label>
        <p className="text-xl font-extrabold tracking-wide">{ticket.name}</p>

        <div className="flex items-center justify-between mt-4">
          <div>
            <p className="text-[34px] font-black font-mono leading-none">{from.code}</p>
            <p className="text-[12px] text-[#8E8E93] mt-1">{from.city}</p>
          </div>
          <div className="flex-1 mx-3 flex items-center gap-1" style={{ color: PEACH }}>
            <span className="flex-1 border-t-2 border-dashed border-current opacity-50" />
            <span className="text-xl">✈</span>
            <span className="flex-1 border-t-2 border-dashed border-current opacity-50" />
          </div>
          <div className="text-right">
            <p className="text-[34px] font-black font-mono leading-none">ICN</p>
            <p className="text-[12px] text-[#8E8E93] mt-1">Seoul</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-5">
          <Info label="DATE" value={fmtDate(ticket.date)} />
          <Info label="GATE" value={CLINIC.gate} />
          <Info label="SEAT" value="GLOW 1A" />
        </div>
        <div className="mt-3">
          <Info label="CLASS" value={interestLabel(ticket.interest)} />
        </div>
      </div>

      <Perforation color={inset ? "#ffffff" : NAVY} />

      <div className="px-5 pb-5 pt-2 flex items-center justify-between gap-4">
        <Barcode seed={ticket.id} />
        <div className="text-right shrink-0">
          <p className="text-[10px] font-bold tracking-[0.2em] text-[#8E8E93]">{status}</p>
          <p className="text-[30px] font-black font-mono leading-none" style={{ color: PEACH }}>
            {left > 0 ? `D-${left}` : "TODAY"}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── 출국 전 ─────────────────────────────────────────────────────────────────

function BeforeYouFly({ left, onInSeoul }: { left: number; onInSeoul: () => void }) {
  // TODO: 실서비스에선 D-7, D-1에 연락 채널로 자동 메시지
  const items = [
    { d: 14, text: "Confirm your consultation with our coordinator" },
    { d: 7,  text: "Check payment options (card · cash · stablecoin soon)" },
    { d: 1,  text: "Save this ticket — it becomes your map in Seoul" },
  ];
  return (
    <div>
      <ul className="mt-2 flex flex-col gap-2.5">
        {items.map((it) => {
          const due = left <= it.d;
          return (
            <li key={it.d} className="flex items-start gap-3">
              <span className={`shrink-0 text-[11px] font-mono font-bold px-2 py-0.5 rounded-md ${due ? "bg-[#FEF3ED] text-[#C5856A]" : "bg-[#f4f2ef] text-[#a8a29b]"}`}>D-{it.d}</span>
              <span className={`text-[14px] leading-snug ${due ? "" : "text-[#a8a29b]"}`}>{it.text}</span>
            </li>
          );
        })}
      </ul>
      <button onClick={onInSeoul} className="mt-4 w-full py-3 rounded-xl border-[1.5px] border-[#1f2a44] text-[14px] font-bold">
        I&apos;m already in Seoul →
      </button>
    </div>
  );
}

// ─── ③ 착륙: 지점까지 안내 ───────────────────────────────────────────────────

function ArrivalGuide() {
  const [dist, setDist] = useState<{ km: number } | null>(null);
  const [locState, setLocState] = useState<"idle" | "loading" | "denied">("idle");
  const links = useMemo(() => mapLinks(CLINIC), []);

  // 위치는 브라우저 안에서만 계산 — 서버로 보내거나 저장하지 않음
  const locate = () => {
    if (!navigator.geolocation) return setLocState("denied");
    setLocState("loading");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setDist({ km: haversineKm(p.coords.latitude, p.coords.longitude, CLINIC.lat, CLINIC.lng) });
        setLocState("idle");
      },
      () => setLocState("denied"),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  const distText = dist
    ? dist.km < 1
      ? `${Math.round(dist.km * 1000)} m away · about ${Math.max(1, Math.round((dist.km * 1000) / 75))} min walk`
      : dist.km < 3
        ? `${dist.km.toFixed(1)} km away · about ${Math.round((dist.km * 1000) / 75)} min walk`
        : `${dist.km.toFixed(1)} km away · subway or taxi recommended`
    : null;

  return (
    <div>
      <p className="text-[11px] font-bold tracking-[0.25em] mt-1" style={{ color: PEACH }}>FINAL DESTINATION</p>
      <h2 className="text-lg font-extrabold mt-1">{CLINIC.name}</h2>
      <p className="text-[13px] text-[#5b6478] mt-1">{CLINIC.address} · {CLINIC.floor}</p>
      <p className="text-[12px] text-[#8E8E93] mt-0.5">{CLINIC.hours}</p>

      <div className="mt-4 rounded-2xl p-4" style={{ background: "#f6f4f1" }}>
        {distText ? (
          <p className="text-[15px] font-bold">📍 {distText}</p>
        ) : (
          <button onClick={locate} disabled={locState === "loading"} className="w-full text-[14px] font-bold py-1">
            {locState === "loading" ? "Finding you…" : locState === "denied" ? "Location unavailable — use the map buttons below" : "📍 How far am I?"}
          </button>
        )}
        <p className="text-[11px] text-[#a8a29b] mt-1.5 text-center">Your location stays on your phone. We never save it.</p>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-3">
        <MapBtn href={links.naver} label="Naver Map" sub="Best in Korea" primary />
        <MapBtn href={links.kakao} label="Kakao Map" sub="Directions" />
        <MapBtn href={links.google} label="Google" sub="Transit only" />
      </div>
    </div>
  );
}

function MapBtn({ href, label, sub, primary }: { href: string; label: string; sub: string; primary?: boolean }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`rounded-xl py-2.5 text-center border-[1.5px] active:scale-[0.97] transition-transform ${primary ? "text-white border-transparent" : "border-[#ece8e2]"}`}
      style={primary ? { background: "#03C75A" } : undefined}
    >
      <span className="block text-[13px] font-extrabold">{label}</span>
      <span className={`block text-[10px] ${primary ? "text-white/80" : "text-[#8E8E93]"}`}>{sub}</span>
    </a>
  );
}

// ─── ④⑤ 체크인 스탬프 · Glow Miles ──────────────────────────────────────────

function GlowMiles({ ticket, landed }: { ticket: Ticket; landed: boolean }) {
  const [stamps, setStamps] = useState<string[]>([]);
  const [fresh, setFresh] = useState(false);

  useEffect(() => {
    try { setStamps(JSON.parse(store.get(stampKey(ticket.id)) ?? "[]")); } catch { setStamps([]); }
  }, [ticket.id]);

  // 프로토타입: 데스크 QR 스캔 대신 버튼. 실서비스에선 데스크에서 QR 스캔 → 서버 기록
  const checkIn = () => {
    const next = [...stamps, todayKST()];
    setStamps(next);
    store.set(stampKey(ticket.id), JSON.stringify(next));
    setFresh(true);
    setTimeout(() => setFresh(false), 1200);
  };

  const slots = Math.max(4, stamps.length + 1);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mt-1">
        <p className="text-[13px] text-[#8E8E93]">Get your ticket stamped at the front desk on every visit.</p>
        <span className="shrink-0 text-[13px] font-mono font-bold" style={{ color: PEACH }}>{stamps.length} visit{stamps.length === 1 ? "" : "s"}</span>
      </div>

      <div className="grid grid-cols-4 gap-2 mt-4">
        {Array.from({ length: slots }, (_, i) => {
          const s = stamps[i];
          const isNew = fresh && i === stamps.length - 1;
          return (
            <div key={i} className="aspect-square rounded-2xl border-2 border-dashed border-[#ece8e2] flex items-center justify-center">
              {s && (
                <div
                  className={`w-[88%] aspect-square rounded-full border-[3px] flex flex-col items-center justify-center -rotate-12 ${isNew ? "animate-[stamp_0.5s_ease-out]" : ""}`}
                  style={{ borderColor: PEACH, color: PEACH }}
                >
                  <span className="text-[9px] font-black tracking-wider">ARRIVED</span>
                  <span className="text-[8px] font-mono font-bold">{s.slice(5).replace("-", ".")}</span>
                  <span className="text-[8px] font-black">#{i + 1}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {landed && (
        <button onClick={checkIn} className="mt-4 w-full py-3 rounded-xl text-white text-[14px] font-bold" style={{ background: NAVY }}>
          🛎 Front-desk check-in <span className="opacity-60 font-normal">(demo)</span>
        </button>
      )}
    </div>
  );
}

// ─── 저장·공유 ────────────────────────────────────────────────────────────────

function SaveShare({ ticket }: { ticket: Ticket }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined" ? `${window.location.origin}${window.location.pathname}?t=${encodeTicket(ticket)}` : "";
  const msg = `My Seoul Glow Ticket ✈️ ${ticket.from} → ICN · ${fmtDate(ticket.date)}\n${url}`;

  const share = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: "My Seoul Glow Ticket", text: msg.split("\n")[0], url }); } catch {}
      return;
    }
    copy();
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
  };

  return (
    <div>
      <p className="text-[13px] text-[#8E8E93] mt-1">Open it again anytime to see how close you are.</p>
      <div className="grid grid-cols-2 gap-2 mt-3">
        <a href={`https://wa.me/?text=${encodeURIComponent(msg)}`} target="_blank" rel="noopener noreferrer" className="py-2.5 rounded-xl text-center text-white text-[13px] font-bold" style={{ background: "#25D366" }}>WhatsApp</a>
        <a href={`https://line.me/R/share?text=${encodeURIComponent(msg)}`} target="_blank" rel="noopener noreferrer" className="py-2.5 rounded-xl text-center text-white text-[13px] font-bold" style={{ background: "#06C755" }}>LINE</a>
        <button onClick={copy} className="py-2.5 rounded-xl border-[1.5px] border-[#ece8e2] text-[13px] font-bold">{copied ? "Copied ✓" : "Copy link"}</button>
        <button onClick={share} className="py-2.5 rounded-xl border-[1.5px] border-[#ece8e2] text-[13px] font-bold">Share ✈</button>
      </div>
    </div>
  );
}

// ─── 데모 패널 (내부 시연용) ───────────────────────────────────────────────────

function DemoPanel({ ticket, offsetDays, setOffsetDays }: { ticket: Ticket; offsetDays: number; setOffsetDays: (n: number) => void }) {
  const [open, setOpen] = useState(true);
  const total = Math.max(1, daysLeft(ticket, Date.now()));
  return (
    <div className="fixed bottom-0 inset-x-0 z-50 px-3 pb-3 pointer-events-none">
      <div className="max-w-md mx-auto pointer-events-auto bg-[#111827]/95 text-white rounded-2xl shadow-2xl backdrop-blur px-4 py-3">
        <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between text-[12px] font-bold">
          <span>🧪 프로토타입 시연 · 날짜 미리 넘겨보기</span>
          <span className="text-white/50">{open ? "접기 ▾" : "열기 ▴"}</span>
        </button>
        {open && (
          <div className="mt-2">
            <input
              type="range"
              min={0}
              max={total}
              value={Math.min(offsetDays, total)}
              onChange={(e) => setOffsetDays(Number(e.target.value))}
              className="w-full accent-[#f2b896]"
            />
            <div className="flex justify-between text-[11px] text-white/60 font-mono">
              <span>오늘 (+{Math.min(offsetDays, total)}일)</span>
              <span>방문일 {daysLeft(ticket, Date.now()) - offsetDays > 0 ? `D-${daysLeft(ticket, Date.now()) - offsetDays}` : "도착"}</span>
            </div>
            <div className="flex gap-2 mt-2">
              <button onClick={() => setOffsetDays(0)} className="flex-1 text-[11px] py-1.5 rounded-lg bg-white/10">오늘로</button>
              <button onClick={() => setOffsetDays(Math.round(total / 2))} className="flex-1 text-[11px] py-1.5 rounded-lg bg-white/10">절반</button>
              <button onClick={() => setOffsetDays(total)} className="flex-1 text-[11px] py-1.5 rounded-lg bg-[#f2b896] text-[#1f2a44] font-bold">착륙</button>
              <button onClick={() => { store.del(stampKey(ticket.id)); location.reload(); }} className="flex-1 text-[11px] py-1.5 rounded-lg bg-white/10">스탬프 초기화</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 작은 조각들 ──────────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-bold tracking-[0.2em] text-[#8E8E93]">{children}</p>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 border-b-[1.5px] border-[#F0EDE8] pb-2">
      <Label>{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <Label>{label}</Label>
      <p className="text-[13px] font-bold font-mono mt-0.5 truncate">{value}</p>
    </div>
  );
}

// 티켓 절취선 + 양쪽 반원 홈
function Perforation({ color = NAVY }: { color?: string }) {
  const hole = color === NAVY ? undefined : "1.5px solid #F0EDE8";
  return (
    <div className="relative h-6 flex items-center">
      <span className="absolute -left-3 w-6 h-6 rounded-full" style={{ background: color, border: hole }} />
      <span className="flex-1 mx-5 border-t-2 border-dashed border-[#ece8e2]" />
      <span className="absolute -right-3 w-6 h-6 rounded-full" style={{ background: color, border: hole }} />
    </div>
  );
}

function Barcode({ seed }: { seed: string }) {
  const bars = useMemo(() => {
    let h = 0;
    for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return Array.from({ length: 42 }, () => {
      h = (h * 1103515245 + 12345) >>> 0;
      return 1 + (h % 3);
    });
  }, [seed]);
  return (
    <div className="flex items-stretch h-12 gap-[2px] min-w-0 overflow-hidden">
      {bars.map((w, i) => (
        <span key={i} style={{ width: w, background: i % 2 ? "transparent" : NAVY }} />
      ))}
    </div>
  );
}
