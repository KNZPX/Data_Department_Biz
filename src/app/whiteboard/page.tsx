import { Metadata } from "next";
import { WhiteboardPage } from "@/features/WhiteboardPage";

export const metadata: Metadata = {
  title: "Whiteboard | Power BI Portal",
  description: "Interactive Workflow Canvas for Drafting Business Workflows and Semantic Models",
};

export default function Page() {
  return <WhiteboardPage />;
}
