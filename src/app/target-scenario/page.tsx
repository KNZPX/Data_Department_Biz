import { Metadata } from "next";
import { TargetScenarioPage } from "@/features/TargetScenarioPage";

export const metadata: Metadata = {
  title: "Target Scenario 2027 | BDMS Phuket",
  description: "Target Scenario Calculator & Revenue Simulation for BDMS Phuket Network (BPK, BSI, DBK)",
};

export default function Page() {
  return <TargetScenarioPage />;
}
