import { Metadata } from "next";
import { EboOkrPage } from "@/features/EboOkrPage";

export const metadata: Metadata = {
  title: "EBO & OKR | Power BI Portal",
  description: "Emerging business opportunities and OKRs for each CoE / SBU, against its target",
};

export default function Page() {
  return <EboOkrPage />;
}
