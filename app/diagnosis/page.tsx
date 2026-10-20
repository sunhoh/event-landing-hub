import type { Metadata } from "next";
import SkinDiagnosis from "./SkinDiagnosis";

export const metadata: Metadata = {
  title: "수험생 피부 스트레스 진단 | 지유의원 강남",
  description: "1분 테스트로 수능 스트레스 피부 점수를 확인하고 맞춤 케어를 추천받아보세요.",
};

export default function DiagnosisPage() {
  return <SkinDiagnosis />;
}
