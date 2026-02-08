import { redirect } from "next/navigation";

export default function WorkspaceIndex({ params }: { params: { id: string } }) {
  redirect(`/app/workspaces/${params.id}/dashboard`);
}