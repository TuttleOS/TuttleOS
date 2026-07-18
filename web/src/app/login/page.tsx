import { Suspense } from "react";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-page p-6">
      <Suspense fallback={<div className="text-muted">Loading…</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
