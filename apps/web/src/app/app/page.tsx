import type { Metadata } from "next";
import { Dashboard } from "@/components/dashboard";

export const metadata: Metadata = {
  title: "Workspace — VoxReels",
};

export default async function WorkspacePage({ searchParams }: PageProps<"/app">) {
  const { topic } = await searchParams;
  return <Dashboard initialTopic={typeof topic === "string" ? topic : ""} />;
}
