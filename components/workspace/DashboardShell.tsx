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
      <header className="border-border bg-background/85 sticky top-0 z-30 border-b backdrop-blur-md">
        <div className="flex h-14 items-center gap-2 px-3 sm:gap-4 sm:px-5">
          <Link
            href={`/w/${currentOrg.id}`}
            className="flex items-center gap-2 font-mono text-[15px] tracking-tight"
          >
            <span className="text-foreground font-medium">d</span>
            <span className="text-foreground/40 -ml-1">ocumind</span>
            <span className="text-primary -ml-0.5">.</span>
          </Link>
          <Separator orientation="vertical" className="mx-1 hidden h-5 sm:block" />
          <WorkspaceSwitcher orgs={orgs} currentId={currentOrg.id} />

          <nav className="ml-3 hidden items-center gap-0.5 md:flex">
            <NavLink href={`/w/${currentOrg.id}`} label="Overview" />
            <NavLink href={`/w/${currentOrg.id}/documents`} label="Documents" matchPrefix />
            <NavLink href={`/w/${currentOrg.id}/chat`} label="Chat" matchPrefix />
          </nav>

          <div className="ml-auto flex items-center gap-1.5">
            <ThemeToggle />
            <UserMenu email={user.email} initial={initial} />
          </div>
        </div>

        {/* Mobile nav row */}
        <nav className="border-border flex items-center gap-0.5 border-t px-2 py-1 md:hidden">
          <NavLink href={`/w/${currentOrg.id}`} label="Overview" />
          <NavLink href={`/w/${currentOrg.id}/documents`} label="Documents" matchPrefix />
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
        "relative rounded-md px-3 py-1.5 font-mono text-[12px] transition-colors",
        active ? "text-foreground" : "text-foreground/45 hover:text-foreground/80",
      )}
    >
      {label}
      {active && <span className="bg-primary absolute right-3 bottom-0 left-3 h-px rounded-full" />}
    </Link>
  );
}

function WorkspaceSwitcher({ orgs, currentId }: { orgs: Organization[]; currentId: string }) {
  const current = orgs.find((o) => o.id === currentId)!;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 font-mono text-[12px]">
          <span className="bg-primary/10 text-primary border-primary/25 inline-flex h-5 w-5 items-center justify-center rounded-sm border text-[10px] font-semibold">
            {current.name[0]?.toUpperCase() ?? "?"}
          </span>
          <span className="max-w-[140px] truncate sm:max-w-[200px]">{current.name}</span>
          <ChevronIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="font-mono text-[10px] tracking-[0.15em] uppercase opacity-50">
          Workspaces
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {orgs.map((o) => (
          <DropdownMenuItem key={o.id} asChild>
            <Link
              href={`/w/${o.id}`}
              className="flex items-center justify-between font-mono text-[12px]"
            >
              <span className="truncate">{o.name}</span>
              <span className="text-muted-foreground ml-2 text-[9px] tracking-[0.1em] uppercase">
                {o.role}
              </span>
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
            <AvatarFallback className="bg-secondary text-foreground/80 text-[10px]">
              {initial}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <div className="font-mono text-[9px] tracking-[0.1em] uppercase opacity-50">
            Signed in as
          </div>
          <div className="text-foreground mt-1 truncate text-[13px]">{email}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <form action={logoutAction}>
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full text-left font-mono text-[12px]">
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
      className="h-3 w-3 opacity-40"
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
