import type { Metadata } from "next";
import CountdownEvent from "./CountdownEvent";

export const metadata: Metadata = {
  title: "수능 특가 카운트다운 | 지유의원 강남",
  description: "수험생 전용 피부 시술 특가, 놓치기 전에 확인하세요. 2026.11.13 ~ 12.31",
};

export default function CountdownPage() {
  return <CountdownEvent />;
}
