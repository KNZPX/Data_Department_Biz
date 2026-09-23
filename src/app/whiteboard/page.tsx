import { Metadata } from "next";
import { WhiteboardPage } from "@/features/WhiteboardPage";

export const metadata: Metadata = {
  title: "Whiteboard | Power BI Portal",
  description: "Miro-Style Workflow Canvas for Drafting Workflows and Semantic Models",
};

export default function Page() {
  return <WhiteboardPage />;
}
