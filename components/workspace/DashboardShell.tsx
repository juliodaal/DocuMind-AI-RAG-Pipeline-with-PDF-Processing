"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { logoutAction } from "@/app/(auth)/actions";
import type { Organization } from "@/lib/auth/require-org";

type Props = {
  user: { id: string; email: string };
  orgs: Organization[];
  children: ReactNode;
};

export function DashboardShell({ user, orgs, children }: Props) {
  const params = useParams<{ workspaceId?: string }>();
  const currentOrg = orgs.find((o) => o.id === params.workspaceId) ?? orgs[0]!;

  const initial = (user.email[0] ?? "?").toUpperCase();

  return (
    <div className="bg-background flex min-h-svh flex-col">
      <header className="border-border bg-card/50 sticky top-0 z-30 border-b backdrop-blur-md">
        <div className="flex h-14 items-center gap-3 px-4">
          <Link href={`/w/${currentOrg.id}`} className="font-semibold tracking-tight">
            DocuMind <span className="text-primary">AI</span>
          </Link>
          <Separator orientation="vertical" className="mx-1 h-6" />
          <WorkspaceSwitcher orgs={orgs} currentId={currentOrg.id} />

          <nav className="ml-4 hidden items-center gap-1 sm:flex">
            <NavLink href={`/w/${currentOrg.id}`} label="Overview" />
            <NavLink href={`/w/${currentOrg.id}/documents`} label="Documents" />
            <NavLink href={`/w/${currentOrg.id}/chat`} label="Chat" />
          </nav>

          <div className="ml-auto">
            <UserMenu email={user.email} initial={initial} />
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>
    </div>
  );
}

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
    >
      {label}
    </Link>
  );
}

function WorkspaceSwitcher({ orgs, currentId }: { orgs: Organization[]; currentId: string }) {
  const current = orgs.find((o) => o.id === currentId)!;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <span className="bg-primary/10 text-primary inline-flex h-5 w-5 items-center justify-center rounded text-[10px] font-semibold">
            {current.name[0]?.toUpperCase() ?? "?"}
          </span>
          <span className="max-w-[180px] truncate text-sm font-medium">{current.name}</span>
          <ChevronIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {orgs.map((o) => (
          <DropdownMenuItem key={o.id} asChild>
            <Link href={`/w/${o.id}`} className="flex items-center justify-between">
              <span className="truncate">{o.name}</span>
              <span className="text-muted-foreground ml-2 text-[10px] uppercase">{o.role}</span>
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserMenu({ email, initial }: { email: string; initial: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full" aria-label="Account menu">
          <Avatar className="h-8 w-8">
            <AvatarFallback>{initial}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="truncate">{email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <form action={logoutAction}>
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full text-left">
              Sign out
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ChevronIcon() {
  return (
    <svg
      className="h-4 w-4 opacity-50"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m4 6 4 4 4-4" />
    </svg>
  );
}
