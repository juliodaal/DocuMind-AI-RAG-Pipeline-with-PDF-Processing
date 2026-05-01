import { redirect } from "next/navigation";
import { createClient } from "@/lib/auth/server";
import type { User } from "@supabase/supabase-js";

export type Organization = {
  id: string;
  name: string;
  slug: string;
  role: "owner" | "admin" | "member";
};

export type AuthContext = {
  user: User;
  org: Organization;
};

/**
 * Use in server components and server actions inside the (dashboard) route group.
 * Throws via redirect() if the user is not authenticated, or has no membership in
 * the requested workspace.
 */
export async function requireOrg(workspaceId: string): Promise<AuthContext> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(`/login?next=/w/${workspaceId}`);

  const { data: membership, error } = await supabase
    .from("organization_members")
    .select("role, organizations:org_id(id, name, slug)")
    .eq("user_id", user.id)
    .eq("org_id", workspaceId)
    .maybeSingle();

  if (error || !membership || !membership.organizations) {
    redirect("/dashboard");
  }

  const orgRow = membership.organizations as unknown as {
    id: string;
    name: string;
    slug: string;
  };

  return {
    user,
    org: {
      id: orgRow.id,
      name: orgRow.name,
      slug: orgRow.slug,
      role: membership.role as Organization["role"],
    },
  };
}

/**
 * Use in server components / actions to require a logged-in user without binding
 * to a specific workspace.
 */
export async function requireUser(): Promise<User> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Returns all organizations the current user is a member of, ordered alphabetically.
 */
export async function listUserOrgs(userId: string): Promise<Organization[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organization_members")
    .select("role, organizations:org_id(id, name, slug)")
    .eq("user_id", userId);

  if (error || !data) return [];

  return data
    .map((row) => {
      const o = row.organizations as unknown as {
        id: string;
        name: string;
        slug: string;
      } | null;
      if (!o) return null;
      return {
        id: o.id,
        name: o.name,
        slug: o.slug,
        role: row.role as Organization["role"],
      };
    })
    .filter((x): x is Organization => x !== null)
    .sort((a, b) => a.name.localeCompare(b.name));
}
