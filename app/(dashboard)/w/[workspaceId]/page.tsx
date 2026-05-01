import { requireOrg } from "@/lib/auth/require-org";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function WorkspaceHome({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const { org, user } = await requireOrg(workspaceId);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{org.name}</h1>
        <p className="text-muted-foreground text-sm">
          Signed in as {user.email} · role: {org.role}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Documents</CardTitle>
            <CardDescription>Upload PDFs to build your knowledge base.</CardDescription>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">Coming next phase.</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Chat</CardTitle>
            <CardDescription>Ask questions, get cited answers.</CardDescription>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">Coming next phase.</CardContent>
        </Card>
      </div>
    </div>
  );
}
