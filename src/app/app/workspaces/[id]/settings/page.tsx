import { redirect } from "next/navigation";

export default async function WorkspaceSettingsIndex({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  const { id } = (await params) as { id: string };
  redirect(`/app/workspaces/${id}/settings/general`);
}

