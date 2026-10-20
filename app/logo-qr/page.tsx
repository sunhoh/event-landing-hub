import type { Metadata } from "next";
import LogoQR from "./LogoQR";

export const metadata: Metadata = {
  title: "로고 QR | 지유의원 강남",
  description: "QR 바닥 위에 GU 로고가 3D로 서 있고, 탭하면 스캔 가능한 QR 코드로 접힙니다.",
};

export default function LogoQRPage() {
  return <LogoQR />;
}
