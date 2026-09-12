import type { Metadata } from "next";
import { ProjectReview } from "@/components/project-review";

export const metadata: Metadata = {
  title: "Script workspace — VoxReels",
};

export default async function ProjectPage({ params }: PageProps<"/app/projects/[projectId]">) {
  const { projectId } = await params;
  return <ProjectReview projectId={projectId} />;
}
