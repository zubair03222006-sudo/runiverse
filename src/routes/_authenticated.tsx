import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/use-auth";
import { BottomNav } from "@/components/BottomNav";

export const Route = createFileRoute("/_authenticated")({
  component: AuthLayout,
});

function AuthLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  if (loading || !user) {
    return (
      <div className="min-h-screen grad-warrior flex items-center justify-center">
        <div className="text-saffron animate-pulse text-sm font-semibold">Loading…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen grad-warrior pb-24">
      <Outlet />
      <BottomNav />
    </div>
  );
}
