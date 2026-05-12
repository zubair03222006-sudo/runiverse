import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { calcLevel, titleFor } from "@/lib/geo";
import { Crown, Trophy } from "lucide-react";

export const Route = createFileRoute("/_authenticated/leaderboard")({
  component: LeaderboardPage,
});

type Row = {
  id: string;
  display_name: string | null;
  city: string | null;
  total_area_km2: number;
  total_distance_km: number;
};

function LeaderboardPage() {
  const [tab, setTab] = useState<"global" | "city">("global");
  const [city, setCity] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (data.user) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("city")
          .eq("id", data.user.id)
          .maybeSingle();
        setCity(prof?.city ?? null);
      }
    });
  }, []);

  useEffect(() => {
    let q = supabase
      .from("profiles")
      .select("id, display_name, city, total_area_km2, total_distance_km")
      .order("total_area_km2", { ascending: false })
      .limit(50);
    if (tab === "city" && city) q = q.eq("city", city);
    q.then(({ data }) => setRows((data ?? []) as Row[]));
  }, [tab, city]);

  return (
    <div className="mx-auto max-w-screen-sm px-5 pt-10">
      <div className="flex items-center gap-2">
        <Trophy className="h-6 w-6 text-gold" />
        <h1 className="font-display text-3xl font-black">Leaderboard</h1>
      </div>
      <p className="text-sm text-muted-foreground mt-1">Ranked by total territory captured.</p>

      <div className="mt-5 inline-flex bg-surface-2 rounded-full p-1 text-xs font-bold uppercase tracking-wider">
        <button
          onClick={() => setTab("global")}
          className={`px-4 py-2 rounded-full ${tab === "global" ? "grad-saffron text-primary-foreground" : "text-muted-foreground"}`}
        >
          🌏 India
        </button>
        <button
          onClick={() => setTab("city")}
          disabled={!city}
          className={`px-4 py-2 rounded-full ${tab === "city" ? "grad-saffron text-primary-foreground" : "text-muted-foreground"} disabled:opacity-40`}
        >
          📍 {city ?? "City"}
        </button>
      </div>

      <div className="mt-5 space-y-2">
        {rows.length === 0 && (
          <div className="card-tactical p-6 text-center text-sm text-muted-foreground">
            Be the first to claim land here. Glory awaits.
          </div>
        )}
        {rows.map((r, i) => {
          const lvl = calcLevel(Number(r.total_area_km2));
          return (
            <div
              key={r.id}
              className={`card-tactical p-4 flex items-center gap-4 ${i === 0 ? "glow-saffron border-saffron/50" : ""}`}
            >
              <div className="w-8 text-center font-display font-black text-lg">
                {i === 0 ? <Crown className="h-5 w-5 text-gold mx-auto" /> : `#${i + 1}`}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold truncate">{r.display_name ?? "Anon Sher"}</div>
                <div className="text-[11px] text-muted-foreground truncate">
                  LVL {lvl} · {titleFor(lvl)} · {r.city ?? "India"}
                </div>
              </div>
              <div className="text-right">
                <div className="font-display font-black text-saffron">
                  {Number(r.total_area_km2).toFixed(2)}<span className="text-xs text-muted-foreground"> km²</span>
                </div>
                <div className="text-[10px] text-muted-foreground uppercase">
                  {Number(r.total_distance_km).toFixed(1)} km run
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
