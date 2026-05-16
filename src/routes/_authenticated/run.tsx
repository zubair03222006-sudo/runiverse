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
import { Pause, Play, Square, X, Crosshair, Satellite, Maximize2, Minimize2, Trophy, ShieldCheck, ShieldAlert, Loader2 } from "lucide-react";
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
  const [follow, setFollow] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [captureBurst, setCaptureBurst] = useState<{ km2: number } | null>(null);
  useEffect(() => setMounted(true), []);

  // GPS signal quality from accuracy (m). Lower is better.
  // Thresholds: <=8m excellent, <=15m good (capture-ready), <=25m fair, >25m poor.
  const acc = tracker.accuracy ?? null;
  const fixCount = tracker.points.length + (tracker.current ? 1 : 0);
  const warmingUp = acc == null || fixCount < 3;
  const captureReady = acc != null && acc <= 15;
  const confidencePct = acc == null ? 0 : Math.max(0, Math.min(100, Math.round(100 - (acc - 5) * 2.5)));
  const signal: { label: string; tone: string; bar: string } =
    acc == null
      ? { label: "Searching…", tone: "text-muted-foreground", bar: "bg-muted-foreground" }
      : acc <= 8
      ? { label: "Excellent", tone: "text-india-green", bar: "bg-india-green" }
      : acc <= 15
      ? { label: "Good", tone: "text-india-green", bar: "bg-india-green" }
      : acc <= 25
      ? { label: "Fair", tone: "text-gold", bar: "bg-gold" }
      : { label: "Poor", tone: "text-danger", bar: "bg-danger" };
  const speedKmh = tracker.speed != null ? Math.max(0, tracker.speed * 3.6) : null;

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

      if (area_m2 > 0) {
        const km2 = area_m2 / 1e6;
        setCaptureBurst({ km2 });
        toast.success(`Territory captured: ${km2.toFixed(3)} km²`, {
          description: "Added to your conquests.",
          duration: 2200,
        });
        setTimeout(() => navigate({ to: "/dashboard" }), 1900);
      } else {
        toast.message("Run saved", { description: "No loop closed this time." });
        navigate({ to: "/dashboard" });
      }
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
            accuracy={tracker.accuracy}
            heading={tracker.heading}
            follow={follow}
            trackPath={path}
            draftPolygon={draftPoly}
            zoom={17}
            interactive={true}
          />
        )}
        {/* Vignette for depth */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,transparent_55%,rgba(0,0,0,0.55)_100%)]" />
      </div>

      {/* Fullscreen toggle — always visible */}
      <button
        onClick={() => setFullscreen((f) => !f)}
        className="absolute z-20 top-[max(1rem,env(safe-area-inset-top))] right-4 h-10 w-10 rounded-full bg-card/80 backdrop-blur-md border border-border flex items-center justify-center hover-scale shadow-lg"
        aria-label={fullscreen ? "Exit fullscreen map" : "Fullscreen map"}
      >
        {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
      </button>

      {/* Top stats overlay — hidden in fullscreen */}
      {!fullscreen && (
        <div className="absolute top-0 inset-x-0 p-4 pt-[max(1rem,env(safe-area-inset-top))] pr-16 animate-fade-in">
          <div className="card-tactical p-4 flex items-center justify-between backdrop-blur-md bg-card/70">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Distance</div>
              <div className="font-display text-2xl font-black text-saffron tabular-nums">
                {distanceKm.toFixed(2)}<span className="text-xs text-muted-foreground"> km</span>
              </div>
            </div>
            <div className="text-center">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Time</div>
              <div className="font-display text-2xl font-black tabular-nums">{formatDuration(tracker.seconds)}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {speedKmh != null && tracker.state === "running" ? "Speed" : "Pace"}
              </div>
              <div className="font-display text-base font-black text-india-green tabular-nums">
                {speedKmh != null && tracker.state === "running"
                  ? `${speedKmh.toFixed(1)} km/h`
                  : formatPace(distanceKm, tracker.seconds)}
              </div>
            </div>
          </div>

          {/* GPS signal pill + recenter */}
          <div className="mt-2 flex items-center justify-between gap-2">
            <div className={`pill bg-card/70 backdrop-blur-md border border-border ${signal.tone}`}>
              <Satellite className="h-3 w-3" />
              <span className="font-semibold">{signal.label}</span>
              {acc != null && (
                <span className="text-muted-foreground font-normal">±{Math.round(acc)}m</span>
              )}
              {tracker.state === "running" && (
                <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-india-green animate-pulse" />
              )}
            </div>
            <button
              onClick={() => setFollow((f) => !f)}
              className={`pill border transition-all hover-scale ${follow ? "bg-saffron/20 border-saffron/50 text-saffron" : "bg-card/70 backdrop-blur-md border-border"}`}
            >
              <Crosshair className={`h-3 w-3 ${follow ? "animate-pulse" : ""}`} />
              {follow ? "Following" : "Recenter"}
            </button>
          </div>

          {/* GPS Confidence meter */}
          <div className="mt-2 card-tactical p-2.5 backdrop-blur-md bg-card/70">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                {warmingUp ? (
                  <Loader2 className="h-3.5 w-3.5 text-muted-foreground animate-spin" />
                ) : captureReady ? (
                  <ShieldCheck className="h-3.5 w-3.5 text-india-green" />
                ) : (
                  <ShieldAlert className="h-3.5 w-3.5 text-danger" />
                )}
                <span className="text-[11px] font-semibold uppercase tracking-wider">
                  {warmingUp ? "Locking GPS…" : captureReady ? "Capture-ready" : "Not reliable for capture"}
                </span>
              </div>
              <span className={`text-[11px] font-bold tabular-nums ${signal.tone}`}>{confidencePct}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
              <div
                className={`h-full ${signal.bar} transition-all duration-500 ease-out`}
                style={{ width: `${confidencePct}%` }}
              />
            </div>
            {!warmingUp && !captureReady && (
              <div className="mt-1.5 text-[10px] text-muted-foreground">
                Move to open sky. Territory capture needs ±15m or better.
              </div>
            )}
          </div>

          {tracker.error && (
            <div className="mt-2 text-xs text-danger bg-danger/15 border border-danger/30 rounded-lg px-3 py-2">
              GPS error: {tracker.error}. Allow location access.
            </div>
          )}
        </div>
      )}

      {/* Minimal fullscreen HUD */}
      {fullscreen && (
        <div className="absolute top-0 inset-x-0 z-20 p-4 pt-[max(1rem,env(safe-area-inset-top))] pr-16 animate-fade-in">
          <div className="flex items-center gap-2">
            {/* GPS pill */}
            <div className={`pill bg-card/60 backdrop-blur-md border border-border ${signal.tone}`}>
              <Satellite className="h-3 w-3" />
              <span className="font-semibold text-xs">{signal.label}</span>
              {acc != null && (
                <span className="text-muted-foreground font-normal text-[10px]">±{Math.round(acc)}m</span>
              )}
              {tracker.state === "running" && (
                <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-india-green animate-pulse" />
              )}
            </div>
            {/* Speed / Pace */}
            <div className="pill bg-card/60 backdrop-blur-md border border-border">
              <span className="font-semibold text-xs text-saffron">
                {speedKmh != null && tracker.state === "running"
                  ? `${speedKmh.toFixed(1)} km/h`
                  : formatPace(distanceKm, tracker.seconds)}
              </span>
            </div>
            {/* Distance */}
            <div className="pill bg-card/60 backdrop-blur-md border border-border">
              <span className="font-semibold text-xs tabular-nums">{distanceKm.toFixed(2)} km</span>
            </div>
            {/* Time */}
            <div className="pill bg-card/60 backdrop-blur-md border border-border">
              <span className="font-semibold text-xs tabular-nums">{formatDuration(tracker.seconds)}</span>
            </div>
            {/* Confidence chip */}
            <div className={`pill bg-card/60 backdrop-blur-md border ${captureReady ? "border-india-green/50" : "border-danger/40"}`}>
              {warmingUp ? (
                <Loader2 className="h-3 w-3 text-muted-foreground animate-spin" />
              ) : captureReady ? (
                <ShieldCheck className="h-3 w-3 text-india-green" />
              ) : (
                <ShieldAlert className="h-3 w-3 text-danger" />
              )}
              <span className={`font-semibold text-xs tabular-nums ${signal.tone}`}>{confidencePct}%</span>
            </div>
            {/* Follow toggle */}
            <button
              onClick={() => setFollow((f) => !f)}
              className={`h-8 w-8 rounded-full flex items-center justify-center border transition-all hover-scale ${follow ? "bg-saffron/20 border-saffron/50 text-saffron" : "bg-card/60 backdrop-blur-md border-border"}`}
              aria-label={follow ? "Following" : "Recenter"}
            >
              <Crosshair className={`h-3.5 w-3.5 ${follow ? "animate-pulse" : ""}`} />
            </button>
          </div>
        </div>
      )}

      {/* Loop-closed alert — visible in both modes */}
      {closed && tracker.state === "running" && (
        <div
          className={`absolute z-20 inset-x-4 ${fullscreen ? "top-[calc(max(1rem,env(safe-area-inset-top))+48px)]" : "top-[210px]"} pr-16`}
        >
          <div className="capture-pop card-tactical p-3 glow-green border-india-green/60 flex items-center gap-3 backdrop-blur-md bg-card/80 relative overflow-hidden sweep-shine">
            <div className="text-2xl">🎯</div>
            <div className="flex-1">
              <div className="font-bold text-sm text-india-green">Loop closed — territory ready!</div>
              <div className="text-xs text-muted-foreground">
                Tap <span className="text-saffron font-bold">Capture &amp; Finish</span> to claim {(draftArea / 1e6).toFixed(3)} km²
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Capture success burst */}
      {captureBurst && (
        <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
          <div className="absolute inset-0 bg-background/40 backdrop-blur-sm animate-fade-in" />
          <div className="capture-pop relative card-tactical p-6 glow-green border-india-green/60 text-center max-w-xs mx-4 overflow-hidden sweep-shine">
            <div className="mx-auto mb-2 h-14 w-14 rounded-full grad-saffron flex items-center justify-center glow-saffron">
              <Trophy className="h-7 w-7 text-primary-foreground" />
            </div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Territory Captured</div>
            <div className="font-display text-4xl font-black text-india-green tabular-nums mt-1">
              {captureBurst.km2.toFixed(3)}<span className="text-base text-muted-foreground"> km²</span>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">Saved to your conquests.</div>
          </div>
        </div>
      )}

      {/* Bottom controls */}
      <div className="absolute bottom-0 inset-x-0 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className={`card-tactical p-4 transition-all ${fullscreen ? "bg-card/70 backdrop-blur-md" : ""}`}>
          {tracker.state === "idle" ? (
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate({ to: "/dashboard" })}
                className="h-14 w-14 rounded-full bg-surface-2 flex items-center justify-center"
              >
                <X className="h-5 w-5" />
              </button>
              <button
                onClick={() => {
                  if (warmingUp) {
                    toast.message("Waiting for GPS lock", { description: "Hang on a moment for a reliable fix." });
                    return;
                  }
                  if (!captureReady) {
                    toast.warning("Weak GPS signal", {
                      description: `Accuracy ±${Math.round(acc!)}m. Run will track, but territory may be imprecise.`,
                    });
                  }
                  tracker.start();
                }}
                className={`flex-1 font-extrabold uppercase tracking-wide rounded-full py-4 flex items-center justify-center gap-2 transition-all ${warmingUp ? "bg-surface-2 text-muted-foreground" : "grad-saffron text-primary-foreground glow-saffron"}`}
              >
                {warmingUp ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5" />}
                {warmingUp ? "Locking GPS…" : "Start Run"}
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

      {/* Floating Finish button in fullscreen (overrides bottom bar) */}
      {fullscreen && tracker.state !== "idle" && (
        <div className="absolute z-30 bottom-[max(1.25rem,env(safe-area-inset-bottom))] left-0 right-0 px-5 pointer-events-none">
          <div className="flex justify-center pointer-events-auto">
            <button
              onClick={() => finishRun(true)}
              disabled={saving}
              className="grad-saffron text-primary-foreground font-extrabold uppercase tracking-wide rounded-full py-3 px-8 glow-saffron flex items-center justify-center gap-2 disabled:opacity-60 text-sm shadow-2xl"
            >
              <Square className="h-4 w-4" />
              {saving ? "Saving…" : closed ? "Capture & Finish" : "Finish Run"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
