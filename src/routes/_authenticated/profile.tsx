import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { calcLevel, titleFor } from "@/lib/geo";
import { LogOut, Share2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
});

type P = {
  display_name: string | null;
  username: string | null;
  city: string | null;
  total_area_km2: number;
  total_distance_km: number;
  total_runs: number;
  streak_days: number;
};

function ProfilePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [p, setP] = useState<P | null>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("display_name, username, city, total_area_km2, total_distance_km, total_runs, streak_days")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setP(data as P | null);
        setName(data?.display_name ?? "");
        setCity(data?.city ?? "");
      });
  }, [user]);

  async function save() {
    if (!user) return;
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: name, city })
      .eq("id", user.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Updated");
      setP((x) => (x ? { ...x, display_name: name, city } : x));
      setEditing(false);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  async function share() {
    const text = `I've captured ${(p?.total_area_km2 ?? 0).toFixed(2)} km² in ${p?.city ?? "India"} on Terra Run! 🐅 #TerraRun`;
    if (navigator.share) {
      try { await navigator.share({ text, title: "Terra Run" }); } catch {}
    } else {
      await navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard!");
    }
  }

  const lvl = calcLevel(p?.total_area_km2 ?? 0);

  return (
    <div className="mx-auto max-w-screen-sm px-5 pt-10">
      <div className="card-tactical p-6 grad-tiranga !bg-clip-padding relative overflow-hidden">
        <div className="absolute inset-0 bg-card/85" />
        <div className="relative">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full grad-saffron flex items-center justify-center text-3xl glow-saffron">
              🐅
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-display font-black text-xl truncate">{p?.display_name ?? "Warrior"}</div>
              <div className="text-xs text-muted-foreground">@{p?.username ?? "—"} · {p?.city ?? "India"}</div>
              <div className="mt-1 inline-flex items-center gap-2">
                <span className="pill bg-saffron/15 text-saffron border border-saffron/30">LVL {lvl}</span>
                <span className="text-[11px] font-bold text-gold">{titleFor(lvl)}</span>
              </div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3 text-center">
            <Stat n={(p?.total_area_km2 ?? 0).toFixed(2)} u="km²" l="Captured" />
            <Stat n={(p?.total_distance_km ?? 0).toFixed(1)} u="km" l="Run" />
            <Stat n={String(p?.total_runs ?? 0)} u="" l="Runs" />
          </div>
        </div>
      </div>

      <button
        onClick={share}
        className="mt-4 w-full card-tactical p-4 flex items-center justify-center gap-2 font-bold"
      >
        <Share2 className="h-4 w-4 text-saffron" />
        Share my conquest
      </button>

      <div className="mt-4 card-tactical p-5">
        <div className="flex items-center justify-between">
          <div className="font-bold">Profile</div>
          <button onClick={() => setEditing((v) => !v)} className="text-xs text-saffron font-semibold">
            {editing ? "Cancel" : "Edit"}
          </button>
        </div>
        {editing ? (
          <div className="mt-3 space-y-3">
            <Field label="Display name" value={name} onChange={setName} />
            <Field label="City" value={city} onChange={setCity} />
            <button onClick={save} className="w-full grad-saffron text-primary-foreground font-bold rounded-lg py-2.5">Save</button>
          </div>
        ) : (
          <div className="mt-3 text-sm text-muted-foreground space-y-1">
            <div>Email: <span className="text-foreground">{user?.email}</span></div>
            <div>City: <span className="text-foreground">{p?.city ?? "—"}</span></div>
          </div>
        )}
      </div>

      <button
        onClick={logout}
        className="mt-4 w-full text-sm text-muted-foreground py-3 flex items-center justify-center gap-2 hover:text-danger"
      >
        <LogOut className="h-4 w-4" /> Sign out
      </button>
    </div>
  );
}

function Stat({ n, u, l }: { n: string; u: string; l: string }) {
  return (
    <div>
      <div className="font-display font-black text-xl text-saffron">
        {n}<span className="text-xs text-muted-foreground font-normal">{u}</span>
      </div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{l}</div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full bg-input border border-border rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-saffron"
      />
    </label>
  );
}
