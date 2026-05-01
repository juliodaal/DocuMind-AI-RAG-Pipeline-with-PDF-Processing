"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
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
import { ThemeToggle } from "@/components/ThemeToggle";
import { logoutAction } from "@/app/(auth)/actions";
import { cn } from "@/lib/utils";
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
      <header className="border-border bg-background/80 sticky top-0 z-30 border-b backdrop-blur-md">
        <div className="flex h-14 items-center gap-2 px-3 sm:gap-3 sm:px-4">
          <Link
            href={`/w/${currentOrg.id}`}
            className="flex items-center gap-1.5 font-semibold tracking-tight"
          >
            <LogoMark />
            <span className="hidden sm:inline">
              DocuMind <span className="text-primary">AI</span>
            </span>
          </Link>
          <Separator orientation="vertical" className="mx-1 hidden h-6 sm:block" />
          <WorkspaceSwitcher orgs={orgs} currentId={currentOrg.id} />

          <nav className="ml-2 hidden items-center gap-0.5 md:flex">
            <NavLink href={`/w/${currentOrg.id}`} label="Overview" />
            <NavLink href={`/w/${currentOrg.id}/documents`} label="Documents" />
            <NavLink href={`/w/${currentOrg.id}/chat`} label="Chat" matchPrefix />
          </nav>

          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <UserMenu email={user.email} initial={initial} />
          </div>
        </div>

        {/* Mobile nav */}
        <nav className="border-border flex items-center gap-0.5 border-t px-2 py-1 md:hidden">
          <NavLink href={`/w/${currentOrg.id}`} label="Overview" />
          <NavLink href={`/w/${currentOrg.id}/documents`} label="Documents" />
          <NavLink href={`/w/${currentOrg.id}/chat`} label="Chat" matchPrefix />
        </nav>
      </header>

      <main className="flex-1">{children}</main>
    </div>
  );
}

function NavLink({
  href,
  label,
  matchPrefix,
}: {
  href: string;
  label: string;
  matchPrefix?: boolean;
}) {
  const pathname = usePathname();
  const active = matchPrefix ? pathname.startsWith(href) : pathname === href;
  return (
    <Link
      href={href}
      className={cn(
        "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-accent/60 hover:text-accent-foreground",
      )}
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
          <span className="max-w-[140px] truncate text-sm font-medium sm:max-w-[200px]">
            {current.name}
          </span>
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
        <Button variant="ghost" size="icon-sm" className="rounded-full" aria-label="Account menu">
          <Avatar className="size-7">
            <AvatarFallback className="text-xs">{initial}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="truncate text-xs font-normal">
          <div className="text-muted-foreground">Signed in as</div>
          <div className="text-foreground mt-0.5 truncate font-medium">{email}</div>
        </DropdownMenuLabel>
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

function LogoMark() {
  return (
    <span className="from-primary to-primary/60 inline-flex size-7 items-center justify-center rounded-md bg-gradient-to-br text-[11px] font-bold text-white shadow-sm">
      D
    </span>
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
