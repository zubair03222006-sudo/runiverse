import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MapView, type Territory } from "@/components/MapView";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import type { LatLng } from "@/lib/geo";

export const Route = createFileRoute("/_authenticated/map")({
  component: MapPage,
});

function MapPage() {
  const { user } = useAuth();
  const [terrs, setTerrs] = useState<Territory[]>([]);
  const [center, setCenter] = useState<LatLng>({ lat: 12.9716, lng: 77.5946 });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {},
        { timeout: 5000 }
      );
    }
  }, []);

  useEffect(() => {
    supabase
      .from("territories")
      .select("id, polygon, area_m2, user_id, profiles(display_name)")
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data }) => {
        const list = (data ?? []).map((t: any) => ({
          id: t.id,
          polygon: (t.polygon ?? []) as LatLng[],
          ownedByMe: t.user_id === user?.id,
          area_m2: Number(t.area_m2),
          ownerName: t.profiles?.display_name ?? "Rival",
        }));
        setTerrs(list);
      });
  }, [user?.id]);

  return (
    <div className="relative h-[calc(100vh-5rem)]">
      {mounted && (
        <MapView className="absolute inset-0" center={center} territories={terrs} zoom={14} />
      )}
      <div className="absolute top-0 inset-x-0 p-4 pt-[max(1rem,env(safe-area-inset-top))] pointer-events-none">
        <div className="card-tactical p-3 pointer-events-auto">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">World Map</div>
          <div className="font-display font-extrabold text-lg">
            {terrs.filter((t) => t.ownedByMe).length} yours · {terrs.length} total
          </div>
          <div className="mt-1 flex gap-3 text-[11px]">
            <Legend color="#138808" label="Yours" />
            <Legend color="#FF3355" label="Enemy" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded" style={{ background: color }} />
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}
