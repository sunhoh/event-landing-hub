import type { Metadata } from "next";
import CardPick from "./CardPick";

export const metadata: Metadata = {
  title: "수능 특가 카드 뽑기 | 지유의원 강남",
  description: "6장 중 1장을 골라 뒤집고 수험생 전용 피부 시술 특가 혜택을 확인하세요.",
};

export default function PickPage() {
  return <CardPick />;
}
