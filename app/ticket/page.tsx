import type { Metadata } from "next";
import SeoulGlowTicket from "./SeoulGlowTicket";

export const metadata: Metadata = {
  title: "Seoul Glow Trip | GU Clinic Gangnam",
  description: "Issue your Seoul Glow boarding pass and follow your journey to GU Clinic Gangnam.",
};

export default function TicketPage() {
  return <SeoulGlowTicket />;
}
