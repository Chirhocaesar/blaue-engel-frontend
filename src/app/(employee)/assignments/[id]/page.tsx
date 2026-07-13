// src/app/assignments/[id]/page.tsx
import AssignmentDetailClient from "./AssignmentDetailClient";

export const dynamic = "force-dynamic";

export default async function AssignmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AssignmentDetailClient id={id} />;
}
