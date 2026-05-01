import { AuthForm } from "@/components/auth/AuthForm";
import { signupAction } from "@/app/(auth)/actions";

export const metadata = {
  title: "Create account — DocuMind AI",
};

export default function SignupPage() {
  return <AuthForm mode="signup" action={signupAction} />;
}
