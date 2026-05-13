import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/use-auth";
import { Flame, MapPin, Trophy, Zap, Shield, Globe } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen grad-warrior text-foreground">
      <div className="mx-auto max-w-screen-sm px-6 pt-16 pb-24">
        <div className="flex items-center gap-3">
          <div className="text-3xl">🏃</div>
          <div className="font-display text-xl font-extrabold tracking-tight">TERRA RUN</div>
          <span className="pill ml-auto bg-india-green/20 text-india-green border border-india-green/30 inline-flex items-center gap-1">
            <Globe className="h-3 w-3" /> Worldwide
          </span>
        </div>

        <h1 className="mt-12 font-display text-5xl font-black leading-[1.05] tracking-tight">
          Run the streets.<br />
          <span className="text-saffron">Claim the city.</span>
        </h1>
        <p className="mt-4 text-base text-muted-foreground max-w-xs">
          Every run is a battle. Close a loop on the map, and that land is yours — until someone runs through it.
        </p>

        <div className="mt-10 flex flex-col gap-3">
          <Link
            to="/auth"
            className="rounded-full grad-saffron text-primary-foreground font-extrabold uppercase tracking-wide text-center py-4 glow-saffron"
          >
            Start Conquering
          </Link>
          <Link
            to="/auth"
            search={{ mode: "signin" } as never}
            className="text-center py-3 text-sm text-muted-foreground"
          >
            I already have an account →
          </Link>
        </div>

        <div className="mt-14 grid grid-cols-2 gap-3">
          <Feature icon={<MapPin className="h-5 w-5" />} title="Capture Loops" desc="Bigger loop = bigger land." />
          <Feature icon={<Shield className="h-5 w-5" />} title="Defend Turf" desc="Rivals can invade — patrol it." />
          <Feature icon={<Trophy className="h-5 w-5" />} title="City Wars" desc="Neighborhoods battle live." />
          <Feature icon={<Flame className="h-5 w-5" />} title="Event Boosts" desc="Weekly XP multipliers." />
        </div>

        <div className="mt-10 card-tactical p-5">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-gold" />
            <span className="text-xs font-bold uppercase tracking-wider text-gold">Weekend Boost</span>
          </div>
          <p className="mt-2 text-sm">
            <span className="font-bold">2× XP</span> on every run. Lace up. 🔥
          </p>
        </div>

        <p className="mt-12 text-center text-[11px] text-muted-foreground">
          The streets are your map. Run. Capture. Defend.
        </p>
      </div>
    </div>
  );
}

function Feature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="card-tactical p-4">
      <div className="text-saffron">{icon}</div>
      <div className="mt-2 font-bold text-sm">{title}</div>
      <div className="text-xs text-muted-foreground mt-1">{desc}</div>
    </div>
  );
}
