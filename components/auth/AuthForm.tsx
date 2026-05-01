"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { AuthActionState } from "@/app/(auth)/actions";

type Mode = "login" | "signup";

type AuthFormProps = {
  mode: Mode;
  action: (state: AuthActionState, formData: FormData) => Promise<AuthActionState>;
  next?: string;
};

export function AuthForm({ mode, action, next }: AuthFormProps) {
  const [state, formAction] = useActionState<AuthActionState, FormData>(action, null);
  const isSignup = mode === "signup";

  return (
    <div className="border-border bg-card/50 rounded-[12px] border p-7">
      <div className="mb-6">
        <span className="ds-eyebrow">{isSignup ? "register" : "sign in"}</span>
        <h1 className="mt-2 text-[22px] font-bold tracking-tight">
          {isSignup ? "Create account" : "Welcome back"}
        </h1>
        <p className="text-muted-foreground mt-1 text-[13px]">
          {isSignup
            ? "Start querying your documents in seconds."
            : "Sign in to access your workspaces."}
        </p>
      </div>

      <form action={formAction} className="space-y-4">
        {next ? <input type="hidden" name="next" value={next} /> : null}

        {isSignup ? (
          <FormField
            label="Full name"
            name="fullName"
            type="text"
            autoComplete="name"
            error={state?.fieldErrors?.fullName?.[0]}
            required
          />
        ) : null}

        <FormField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          error={state?.fieldErrors?.email?.[0]}
          required
        />

        <FormField
          label="Password"
          name="password"
          type="password"
          autoComplete={isSignup ? "new-password" : "current-password"}
          placeholder="••••••••"
          error={state?.fieldErrors?.password?.[0]}
          required
          minLength={8}
        />

        {state?.error ? (
          <Alert variant="destructive" className="font-mono text-[12px]">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        ) : null}

        <SubmitButton mode={mode} />

        <p className="text-muted-foreground pt-2 text-center font-mono text-[11px]">
          {isSignup ? (
            <>
              already registered?{" "}
              <Link href="/login" className="text-primary underline-offset-4 hover:underline">
                sign in
              </Link>
            </>
          ) : (
            <>
              new here?{" "}
              <Link href="/signup" className="text-primary underline-offset-4 hover:underline">
                create an account
              </Link>
            </>
          )}
        </p>
      </form>
    </div>
  );
}

function FormField({
  label,
  name,
  error,
  ...rest
}: {
  label: string;
  name: string;
  error?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="ds-label block">
        {label}
      </label>
      <Input
        id={name}
        name={name}
        aria-invalid={!!error}
        className="font-mono text-[13px]"
        {...rest}
      />
      {error ? <p className="text-destructive font-mono text-[10px]">{error}</p> : null}
    </div>
  );
}

function SubmitButton({ mode }: { mode: Mode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full font-mono text-[12px]" disabled={pending}>
      {pending
        ? mode === "signup"
          ? "creating account…"
          : "signing in…"
        : mode === "signup"
          ? "Create account"
          : "Sign in"}
    </Button>
  );
}
