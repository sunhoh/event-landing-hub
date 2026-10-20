import type { Metadata } from "next";
import MemoryGame from "./MemoryGame";

export const metadata: Metadata = {
  title: "피부 짝꿍 찾기 | 지유의원 강남",
  description: "4장부터 40장까지, 제한시간 안에 같은 그림을 맞추고 단계별 쿠폰을 받아가세요.",
};

export default function MemoryPage() {
  return <MemoryGame />;
}
