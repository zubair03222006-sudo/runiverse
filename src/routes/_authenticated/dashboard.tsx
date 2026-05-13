import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { calcLevel, titleFor } from "@/lib/geo";
import { Flame, Trophy, MapPin, Play, Calendar } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

type Profile = {
  display_name: string | null;
  city: string | null;
  total_area_km2: number;
  total_distance_km: number;
  total_runs: number;
  streak_days: number;
};

type Run = {
  id: string;
  distance_km: number;
  duration_seconds: number;
  area_captured_m2: number;
  started_at: string;
};

function Dashboard() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("display_name, city, total_area_km2, total_distance_km, total_runs, streak_days")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setProfile(data as Profile | null));
    supabase
      .from("runs")
      .select("id, distance_km, duration_seconds, area_captured_m2, started_at")
      .eq("user_id", user.id)
      .order("started_at", { ascending: false })
      .limit(5)
      .then(({ data }) => setRuns((data ?? []) as Run[]));
  }, [user]);

  const level = calcLevel(profile?.total_area_km2 ?? 0);
  const title = titleFor(level);
  const greet = greeting();

  return (
    <div className="mx-auto max-w-screen-sm px-5 pt-10">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{greet}</div>
          <div className="font-display text-2xl font-extrabold mt-0.5">
            {profile?.display_name ?? "Runner"}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
            <MapPin className="h-3 w-3" /> {profile?.city ?? "Worldwide"}
          </div>
        </div>
        <div className="text-right">
          <div className="pill bg-saffron/15 text-saffron border border-saffron/30">
            LVL {level}
          </div>
          <div className="text-[10px] mt-1 font-bold text-gold">{title}</div>
        </div>
      </div>

      {/* Streak + Today */}
      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="card-tactical p-4">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Flame className="h-3.5 w-3.5 text-saffron" /> STREAK
          </div>
          <div className="mt-1 text-3xl font-black">{profile?.streak_days ?? 0}<span className="text-sm font-normal text-muted-foreground"> days</span></div>
        </div>
        <div className="card-tactical p-4">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="h-3.5 w-3.5 text-india-green" /> EVENT
          </div>
          <div className="mt-1 text-base font-extrabold text-india-green">2× XP active</div>
          <div className="text-[10px] text-muted-foreground">Weekend boost on 🔥</div>
        </div>
      </div>

      {/* Lifetime stats */}
      <div className="mt-3 card-tactical p-5 grad-tiranga !bg-clip-padding overflow-hidden relative">
        <div className="absolute inset-0 bg-card/85" />
        <div className="relative">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Lifetime Conquest</div>
          <div className="grid grid-cols-3 gap-3 mt-3">
            <Stat label="Area" value={(profile?.total_area_km2 ?? 0).toFixed(2)} unit="km²" />
            <Stat label="Distance" value={(profile?.total_distance_km ?? 0).toFixed(1)} unit="km" />
            <Stat label="Runs" value={String(profile?.total_runs ?? 0)} unit="" />
          </div>
        </div>
      </div>

      <Link
        to="/run"
        className="mt-5 grad-saffron text-primary-foreground font-extrabold uppercase tracking-wide rounded-2xl py-5 flex items-center justify-center gap-3 glow-saffron"
      >
        <Play className="h-6 w-6" />
        Start Run
      </Link>

      <div className="mt-7 flex items-center justify-between">
        <h3 className="font-display font-bold">Recent Conquests</h3>
        <Link to="/profile" className="text-xs text-saffron font-semibold">See all</Link>
      </div>
      <div className="mt-2 space-y-2">
        {runs.length === 0 && (
          <div className="card-tactical p-5 text-center text-sm text-muted-foreground">
            No runs yet. Time to claim your first street.
          </div>
        )}
        {runs.map((r) => (
          <div key={r.id} className="card-tactical p-4 flex items-center justify-between">
            <div>
              <div className="font-bold">{r.distance_km.toFixed(2)} km</div>
              <div className="text-xs text-muted-foreground">{new Date(r.started_at).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</div>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-india-green">{(r.area_captured_m2 / 1e6).toFixed(3)} km²</div>
              <div className="text-[10px] text-muted-foreground uppercase">captured</div>
            </div>
          </div>
        ))}
      </div>

      <Link to="/leaderboard" className="mt-6 card-tactical p-4 flex items-center gap-3">
        <Trophy className="h-5 w-5 text-gold" />
        <div className="flex-1">
          <div className="font-bold text-sm">Leaderboard</div>
          <div className="text-xs text-muted-foreground">See who rules your city</div>
        </div>
        <span className="text-saffron">→</span>
      </Link>
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-display font-black text-2xl text-saffron">
        {value}<span className="text-xs text-muted-foreground font-normal ml-0.5">{unit}</span>
      </div>
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Late night runner";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 20) return "Good evening";
  return "Night owl";
}
