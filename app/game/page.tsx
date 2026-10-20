import type { Metadata } from "next";
import TroubleHunter from "./TroubleHunter";

export const metadata: Metadata = {
  title: "트러블 헌터 30초 챌린지 | 지유의원 강남",
  description: "30초 동안 피부 트러블을 없애고 점수에 따라 수험생 특가 쿠폰을 받아가세요.",
};

export default function GamePage() {
  return <TroubleHunter />;
}
