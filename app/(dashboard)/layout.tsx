import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { requireUser, listUserOrgs } from "@/lib/auth/require-org";
import { DashboardShell } from "@/components/workspace/DashboardShell";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const orgs = await listUserOrgs(user.id);

  if (orgs.length === 0) {
    // Edge case: trigger failed or membership lost. Send to a recovery page later;
    // for now, force re-login which re-runs the trigger if needed.
    redirect("/login");
  }

  return (
    <DashboardShell user={{ id: user.id, email: user.email ?? "" }} orgs={orgs}>
      {children}
    </DashboardShell>
  );
}
