import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { db } from "@/server/db";
import SandboxEditor from "./sandbox-editor";

export default async function SandboxEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (user?.role !== "ADMIN") redirect("/");
  const { id } = await params;
  return <SandboxEditor id={id} />;
}
