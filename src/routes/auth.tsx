import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [city, setCity] = useState("Bengaluru");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!authLoading && user) navigate({ to: "/dashboard" });
  }, [user, authLoading, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: name || email.split("@")[0] },
          },
        });
        if (error) throw error;
        // Set city on profile if user is logged in (auto-confirm may or may not be on)
        if (data.session && data.user) {
          await supabase.from("profiles").update({ city, display_name: name || email.split("@")[0] }).eq("id", data.user.id);
        }
        toast.success("Welcome, runner!");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back!");
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin + "/dashboard" },
      });
      if (error) throw error;
    } catch (err) {
      toast.error((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen grad-warrior flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-4xl">🏃</div>
          <h1 className="font-display text-3xl font-black mt-2">
            {mode === "signup" ? "Join the Hunt" : "Welcome Back, Runner"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === "signup" ? "Conquer your first street today." : "Your territory is waiting."}
          </p>
        </div>

        <form onSubmit={submit} className="card-tactical p-6 space-y-3">
          {mode === "signup" && (
            <>
              <Input label="Display Name" value={name} onChange={setName} placeholder="Your name" />
              <Input label="City" value={city} onChange={setCity} placeholder="Your city" />
            </>
          )}
          <Input label="Email" type="email" value={email} onChange={setEmail} required />
          <Input label="Password" type="password" value={password} onChange={setPassword} required minLength={6} />
          <button
            type="submit"
            disabled={busy}
            className="w-full grad-saffron text-primary-foreground font-extrabold uppercase tracking-wide py-3.5 rounded-xl glow-saffron disabled:opacity-60"
          >
            {busy ? "..." : mode === "signup" ? "Start Capturing" : "Sign In"}
          </button>
          <div className="relative py-2">
            <div className="absolute inset-x-0 top-1/2 h-px bg-border" />
            <div className="relative text-center text-xs text-muted-foreground bg-card w-fit mx-auto px-2">or</div>
          </div>
          <button
            type="button"
            onClick={google}
            disabled={busy}
            className="w-full bg-surface-2 hover:bg-surface border border-border font-semibold py-3 rounded-xl"
          >
            Continue with Google
          </button>
        </form>

        <button
          type="button"
          onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
          className="mt-4 w-full text-sm text-muted-foreground"
        >
          {mode === "signup" ? "Already have an account? Sign in" : "New here? Create account"}
        </button>
      </div>
    </div>
  );
}

function Input({
  label, value, onChange, type = "text", placeholder, required, minLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
}) {
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        minLength={minLength}
        className="mt-1.5 w-full bg-input border border-border rounded-lg px-3.5 py-3 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-saffron"
      />
    </label>
  );
}
