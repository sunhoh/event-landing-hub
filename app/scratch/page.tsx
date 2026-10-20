import type { Metadata } from "next";
import ScratchEvent from "./ScratchEvent";

export const metadata: Metadata = {
  title: "수능 특가 행운의 스크래치 | 지유의원 강남",
  description: "카드를 긁어서 수험생 전용 피부 시술 특가 혜택을 확인하세요.",
};

export default function ScratchPage() {
  return <ScratchEvent />;
}
