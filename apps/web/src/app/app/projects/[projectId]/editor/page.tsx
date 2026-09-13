import type { Metadata } from "next";
import { ProjectEditor } from "@/components/project-editor";

export const metadata: Metadata = { title: "Editor — VoxReels" };

export default async function EditorPage({ params }: PageProps<"/app/projects/[projectId]/editor">) {
  const { projectId } = await params;
  return <ProjectEditor projectId={projectId} />;
}
