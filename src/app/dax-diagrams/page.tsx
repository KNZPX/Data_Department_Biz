import { Metadata } from "next";
import { WhiteboardPage } from "@/features/WhiteboardPage";

export const metadata: Metadata = {
  title: "DAX diagrams | Power BI Portal",
  description: "How each measure is calculated, drawn from its DAX formula",
};

export default function Page() {
  return <WhiteboardPage kind="dax" />;
}
