import { EditorView } from "@/components/ai-clips/editor-view";
export default async function EditPage({
  params,
}: {
  params: Promise<{ projectId: string; clipId: string }>;
}) {
  const { projectId, clipId } = await params;
  return <EditorView projectId={projectId} clipId={clipId} />;
}
