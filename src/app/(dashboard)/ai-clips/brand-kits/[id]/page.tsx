import { BrandKitEditorView } from "@/components/ai-clips/brand-kit-editor-view";
export default async function BrandKitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <BrandKitEditorView kitId={id} />;
}
