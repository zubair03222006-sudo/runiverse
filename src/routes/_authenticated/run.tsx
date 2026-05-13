import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { MapView } from "@/components/MapView";
import { useGeoTracker } from "@/hooks/use-geo-tracker";
import {
  formatDuration,
  formatPace,
  isClosedLoop,
  polygonAreaM2,
  centerOf,
  type LatLng,
} from "@/lib/geo";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { Pause, Play, Square, X, Crosshair, Satellite } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/run")({
  component: RunPage,
});

function RunPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const tracker = useGeoTracker();
  const [mounted, setMounted] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => setMounted(true), []);

  const path: LatLng[] = useMemo(
    () => tracker.points.map((p) => ({ lat: p.lat, lng: p.lng })),
    [tracker.points]
  );

  const closed = isClosedLoop(path);
  const draftPoly = closed ? path : null;
  const draftArea = draftPoly ? polygonAreaM2(draftPoly) : 0;
  const distanceKm = tracker.distanceM / 1000;

  async function finishRun(saveAsTerritory: boolean) {
    if (!user) return;
    setSaving(true);
    const { points, distanceM, seconds } = tracker.stop();
    try {
      const distance_km = distanceM / 1000;
      const pace = distance_km > 0 ? seconds / 60 / distance_km : null;
      const calories = Math.round(distance_km * 65); // rough
      const polyForCheck = points.map((p) => ({ lat: p.lat, lng: p.lng }));
      const isClosed = isClosedLoop(polyForCheck);
      const area_m2 = isClosed && saveAsTerritory ? polygonAreaM2(polyForCheck) : 0;

      const { data: run, error: runErr } = await supabase
        .from("runs")
        .insert({
          user_id: user.id,
          distance_km,
          duration_seconds: seconds,
          avg_pace_min_per_km: pace,
          calories,
          area_captured_m2: area_m2,
          path: points as unknown as never,
          is_closed_loop: isClosed,
          ended_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (runErr) throw runErr;

      if (isClosed && saveAsTerritory && polyForCheck.length >= 3) {
        const c = centerOf(polyForCheck);
        await supabase.from("territories").insert({
          user_id: user.id,
          run_id: run.id,
          polygon: polyForCheck as unknown as never,
          area_m2,
          center_lat: c.lat,
          center_lng: c.lng,
        });
      }

      // update profile aggregates
      const { data: prof } = await supabase
        .from("profiles")
        .select("total_area_km2, total_distance_km, total_runs")
        .eq("id", user.id)
        .single();
      await supabase
        .from("profiles")
        .update({
          total_area_km2: (Number(prof?.total_area_km2) || 0) + area_m2 / 1e6,
          total_distance_km: (Number(prof?.total_distance_km) || 0) + distance_km,
          total_runs: (prof?.total_runs ?? 0) + 1,
        })
        .eq("id", user.id);

      toast.success(
        area_m2 > 0
          ? `Captured ${(area_m2 / 1e6).toFixed(3)} km² 🐅`
          : "Run saved! No loop closed this time."
      );
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 grad-warrior">
      {/* Map fills screen */}
      <div className="absolute inset-0">
        {mounted && (
          <MapView
            className="h-full w-full"
            center={tracker.current ?? { lat: 12.9716, lng: 77.5946 }}
            livePoint={tracker.current}
            trackPath={path}
            draftPolygon={draftPoly}
            zoom={17}
            interactive={false}
          />
        )}
      </div>

      {/* Top stats overlay */}
      <div className="absolute top-0 inset-x-0 p-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="card-tactical p-4 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Distance</div>
            <div className="font-display text-2xl font-black text-saffron">
              {distanceKm.toFixed(2)}<span className="text-xs text-muted-foreground"> km</span>
            </div>
          </div>
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Time</div>
            <div className="font-display text-2xl font-black">{formatDuration(tracker.seconds)}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Pace</div>
            <div className="font-display text-base font-black text-india-green">
              {formatPace(distanceKm, tracker.seconds)}
            </div>
          </div>
        </div>

        {tracker.error && (
          <div className="mt-2 text-xs text-danger bg-danger/15 border border-danger/30 rounded-lg px-3 py-2">
            GPS error: {tracker.error}. Allow location access.
          </div>
        )}

        {closed && tracker.state === "running" && (
          <div className="mt-2 card-tactical p-3 glow-green border-india-green/40 flex items-center gap-3">
            <div className="text-2xl">🎯</div>
            <div className="flex-1">
              <div className="font-bold text-sm text-india-green">Loop closed!</div>
              <div className="text-xs text-muted-foreground">
                {(draftArea / 1e6).toFixed(3)} km² ready to capture
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom controls */}
      <div className="absolute bottom-0 inset-x-0 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="card-tactical p-4">
          {tracker.state === "idle" ? (
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate({ to: "/dashboard" })}
                className="h-14 w-14 rounded-full bg-surface-2 flex items-center justify-center"
              >
                <X className="h-5 w-5" />
              </button>
              <button
                onClick={tracker.start}
                className="flex-1 grad-saffron text-primary-foreground font-extrabold uppercase tracking-wide rounded-full py-4 glow-saffron flex items-center justify-center gap-2"
              >
                <Play className="h-5 w-5" />
                Start Run
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <button
                onClick={tracker.state === "running" ? tracker.pause : tracker.resume}
                className="h-14 w-14 rounded-full bg-surface-2 flex items-center justify-center"
              >
                {tracker.state === "running" ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
              </button>
              <button
                onClick={() => finishRun(true)}
                disabled={saving}
                className="flex-1 grad-saffron text-primary-foreground font-extrabold uppercase tracking-wide rounded-full py-4 glow-saffron flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <Square className="h-5 w-5" />
                {saving ? "Saving…" : closed ? "Capture & Finish" : "Finish Run"}
              </button>
            </div>
          )}
          <div className="mt-3 text-center text-[11px] text-muted-foreground">
            {tracker.state === "idle"
              ? "Allow location, then start. Run a closed loop to claim land."
              : closed
                ? "Loop detected — finish to claim your territory."
                : "Keep running. Return near your start point to close the loop."}
          </div>
        </div>
      </div>
    </div>
  );
}
