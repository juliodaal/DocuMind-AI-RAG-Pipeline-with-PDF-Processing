"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">{isSignup ? "Create account" : "Welcome back"}</CardTitle>
        <CardDescription>
          {isSignup
            ? "Start querying your documents in seconds."
            : "Sign in to access your workspaces."}
        </CardDescription>
      </CardHeader>
      <CardContent>
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
            error={state?.fieldErrors?.email?.[0]}
            required
          />

          <FormField
            label="Password"
            name="password"
            type="password"
            autoComplete={isSignup ? "new-password" : "current-password"}
            error={state?.fieldErrors?.password?.[0]}
            required
            minLength={8}
          />

          {state?.error ? (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          ) : null}

          <SubmitButton mode={mode} />

          <p className="text-muted-foreground text-center text-sm">
            {isSignup ? (
              <>
                Already have an account?{" "}
                <Link href="/login" className="text-primary underline-offset-4 hover:underline">
                  Sign in
                </Link>
              </>
            ) : (
              <>
                New to DocuMind?{" "}
                <Link href="/signup" className="text-primary underline-offset-4 hover:underline">
                  Create an account
                </Link>
              </>
            )}
          </p>
        </form>
      </CardContent>
    </Card>
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
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} aria-invalid={!!error} {...rest} />
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </div>
  );
}

function SubmitButton({ mode }: { mode: Mode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending
        ? mode === "signup"
          ? "Creating account..."
          : "Signing in..."
        : mode === "signup"
          ? "Create account"
          : "Sign in"}
    </Button>
  );
}
