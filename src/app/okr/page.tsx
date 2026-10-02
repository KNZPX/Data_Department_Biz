import { Metadata } from "next";
import { OkrPage } from "@/features/OkrPage";

export const metadata: Metadata = {
  title: "EBO & OKR | Power BI Portal",
  description: "Business outcomes and key results for each CoE / SBU",
};

export default function Page() {
  return <OkrPage />;
}
