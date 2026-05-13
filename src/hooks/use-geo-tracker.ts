import { useEffect, useRef, useState, useCallback } from "react";
import type { LatLng, TrackPoint } from "@/lib/geo";
import { haversine, totalDistanceMeters } from "@/lib/geo";

export type TrackerState = "idle" | "running" | "paused";

export function useGeoTracker() {
  const [state, setState] = useState<TrackerState>("idle");
  const [points, setPoints] = useState<TrackPoint[]>([]);
  const [current, setCurrent] = useState<LatLng | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [speed, setSpeed] = useState<number | null>(null);
  const [distanceM, setDistanceM] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const watchId = useRef<number | null>(null);
  const tickRef = useRef<number | null>(null);
  const stateRef = useRef<TrackerState>("idle");
  stateRef.current = state;

  // Always-on high-accuracy watch for live marker (even when idle)
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("Geolocation not supported on this device.");
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCurrent(p);
        setAccuracy(pos.coords.accuracy ?? null);
        if (pos.coords.heading != null && !Number.isNaN(pos.coords.heading)) {
          setHeading(pos.coords.heading);
        }
        if (pos.coords.speed != null && !Number.isNaN(pos.coords.speed)) {
          setSpeed(pos.coords.speed);
        }
        if (stateRef.current === "running") {
          setPoints((prev) => {
            const tp: TrackPoint = { ...p, t: Date.now() };
            if (prev.length === 0) return [tp];
            const last = prev[prev.length - 1];
            const d = haversine(last, p);
            const dt = (tp.t - last.t) / 1000;
            // Filter jitter: ignore <2m moves and unrealistic >50m/sec jumps
            if (d < 2) return prev;
            if (dt > 0 && d / dt > 50) return prev;
            // Derive heading from movement when device doesn't provide one
            if (pos.coords.heading == null || Number.isNaN(pos.coords.heading)) {
              const dLng = (p.lng - last.lng) * Math.cos((last.lat * Math.PI) / 180);
              const dLat = p.lat - last.lat;
              const bearing = (Math.atan2(dLng, dLat) * 180) / Math.PI;
              setHeading((bearing + 360) % 360);
            }
            const next = [...prev, tp];
            setDistanceM(totalDistanceMeters(next));
            return next;
          });
        }
      },
      (err) => setError(err.message),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 }
    );
    watchId.current = id;
    return () => {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    };
  }, []);

  // Timer
  useEffect(() => {
    if (state !== "running") {
      if (tickRef.current) window.clearInterval(tickRef.current);
      return;
    }
    tickRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
  }, [state]);

  const start = useCallback(() => {
    setPoints([]);
    setDistanceM(0);
    setSeconds(0);
    setState("running");
  }, []);
  const pause = useCallback(() => setState("paused"), []);
  const resume = useCallback(() => setState("running"), []);
  const stop = useCallback(() => {
    setState("idle");
    return { points, distanceM, seconds };
  }, [points, distanceM, seconds]);

  return {
    state, points, current, accuracy, heading, speed,
    distanceM, seconds, error, start, pause, resume, stop,
  };
}
