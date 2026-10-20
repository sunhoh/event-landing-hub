import type { Metadata } from "next";
import SlotMachine from "./SlotMachine";

export const metadata: Metadata = {
  title: "수능 특가 슬롯머신 | 지유의원 강남",
  description: "슬롯을 돌려 3칸을 맞추고 수험생 전용 피부 시술 특가 혜택을 받아가세요.",
};

export default function SlotPage() {
  return <SlotMachine />;
}
