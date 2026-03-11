"use client";
import { useState, useEffect, Suspense } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

function AuthFormContent() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase environment variables.");
  }

  const supabase = createBrowserClient(supabaseUrl, supabaseKey);
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();

  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showVerifyPopup, setShowVerifyPopup] = useState(false);

  // Check for error params from callback
  useEffect(() => {
    const callbackError = searchParams.get("error");
    if (callbackError === "callback") {
      setError("Failed to verify your email. Please try again.");
    } else if (callbackError === "config") {
      setError("Configuration error. Please contact support.");
    }
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const name = formData.get("name") as string;

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) {
          throw error;
        } else {
          // Clear and invalidate all queries to ensure fresh data for new user
          queryClient.clear();
          toast.success("Login successful! Welcome back.");
          // Get the redirect URL from search params or default to home
          const redirectTo = searchParams.get("redirectedFrom") || "/";
          router.push(redirectTo);
          router.prefetch(redirectTo);
          router.refresh();
        }
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { name },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) {
          throw error;
        } else {
          toast.success(
            "Account created successfully! Please check your email to verify your account."
          );
          setShowVerifyPopup(true);
        }
      }
    } catch (err: unknown) {
      // Show user-friendly error messages
      const errorMessage =
        err instanceof Error ?
          err.message
        : "An error occurred. Please try again.";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex justify-center items-center min-h-screen ">
      <div className="mx-auto w-full max-w-sm space-y-6 justify-center items-center">
        <h1 className="text-2xl font-semibold text-center  ">
          {isLogin ? "Sign In" : "Create Account"}
        </h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input
                type="text"
                name="name"
                placeholder="Your full name"
                required
              />
            </div>
          )}
          <div>
            <label className="text-sm font-medium">Email</label>
            <Input
              type="email"
              name="email"
              placeholder="you@example.com"
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium">Password</label>
            <Input
              type="password"
              name="password"
              placeholder="••••••••"
              required
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ?
              "Loading..."
            : isLogin ?
              "Sign In"
            : "Sign Up"}
          </Button>
        </form>
        <p className="text-sm text-center text-muted-foreground">
          {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
          <button
            type="button"
            onClick={() => setIsLogin(!isLogin)}
            className="text-primary underline underline-offset-2"
          >
            {isLogin ? "Sign up" : "Sign in"}
          </button>
        </p>
        {showVerifyPopup && (
          <div className="fixed inset-0 flex items-center justify-center bg-black/60 z-[9999]">
            <div className="bg-white text-black rounded-lg shadow-lg p-6 max-w-sm w-full text-center">
              <h2 className="text-xl font-semibold mb-2">Verify your email</h2>
              <p className="mb-4">
                A confirmation email has been sent to your address. Please check
                your inbox and follow the link to activate your account.
              </p>
              <Button
                onClick={() => setShowVerifyPopup(false)}
                className="w-full"
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AuthForm() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center items-center min-h-screen">
          <Loader2 className="animate-spin w-6 h-6 text-muted-foreground" />
        </div>
      }
    >
      <AuthFormContent />
    </Suspense>
  );
}
