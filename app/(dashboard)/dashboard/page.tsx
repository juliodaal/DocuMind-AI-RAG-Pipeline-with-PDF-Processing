import { redirect } from "next/navigation";
import { requireUser, listUserOrgs } from "@/lib/auth/require-org";

export default async function DashboardIndex() {
  const user = await requireUser();
  const orgs = await listUserOrgs(user.id);
  if (orgs.length > 0 && orgs[0]) redirect(`/w/${orgs[0].id}`);
  redirect("/login");
}
