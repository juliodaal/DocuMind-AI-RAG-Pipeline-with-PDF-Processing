import { AuthForm } from "@/components/auth/AuthForm";
import { loginAction } from "@/app/(auth)/actions";

export const metadata = {
  title: "Sign in — DocuMind AI",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return <AuthForm mode="login" action={loginAction} next={next} />;
}
