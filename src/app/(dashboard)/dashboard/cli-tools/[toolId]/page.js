import { notFound } from "next/navigation";
import { CLI_TOOLS } from "@/shared/constants/cliTools";
import { getMachineId } from "@/shared/utils/machine";
import ToolDetailClient from "./ToolDetailClient";

export default async function ToolDetailPage({ params }) {
  const { toolId } = await params;
  if (!CLI_TOOLS[toolId]) notFound();
  const machineId = await getMachineId();
  const baseUrl = process.env.BASE_URL || process.env.NEXT_PUBLIC_BASE_URL || "";
  return <ToolDetailClient toolId={toolId} machineId={machineId} defaultBaseUrl={baseUrl} />;
}
