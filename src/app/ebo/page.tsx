import { Metadata } from "next";
import { EboPage } from "@/features/EboPage";

export const metadata: Metadata = {
  title: "EBO | Power BI Portal",
  description: "Emerging business opportunities for each CoE / SBU, against its target",
};

export default function Page() {
  return <EboPage />;
}
