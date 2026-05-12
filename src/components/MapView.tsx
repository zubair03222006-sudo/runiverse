import { useEffect, useRef } from "react";
import L from "leaflet";
import type { LatLng } from "@/lib/geo";

export type Territory = {
  id: string;
  polygon: LatLng[];
  ownedByMe?: boolean;
  area_m2?: number;
  ownerName?: string;
};

type Props = {
  center?: LatLng;
  trackPath?: LatLng[];
  livePoint?: LatLng | null;
  territories?: Territory[];
  draftPolygon?: LatLng[] | null;
  zoom?: number;
  className?: string;
  interactive?: boolean;
};

// Patch default marker icons (leaflet's default expects asset paths via webpack)
const tigerIcon = L.divIcon({
  className: "",
  html: `<div style="
    width:22px;height:22px;border-radius:50%;
    background:radial-gradient(circle at 30% 30%, #FFB37A, #FF6B35 70%);
    box-shadow:0 0 0 3px rgba(255,107,53,0.35), 0 0 0 1px #0F0F1A;
  "></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

export function MapView({
  center = { lat: 12.9716, lng: 77.5946 }, // Bangalore default
  trackPath = [],
  livePoint = null,
  territories = [],
  draftPolygon = null,
  zoom = 16,
  className = "",
  interactive = true,
}: Props) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  // init
  useEffect(() => {
    if (!elRef.current || mapRef.current) return;
    const m = L.map(elRef.current, {
      center: [center.lat, center.lng],
      zoom,
      zoomControl: interactive,
      dragging: interactive,
      scrollWheelZoom: interactive,
      doubleClickZoom: interactive,
      touchZoom: interactive,
      boxZoom: interactive,
      keyboard: interactive,
      attributionControl: true,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap",
    }).addTo(m);
    layerRef.current = L.layerGroup().addTo(m);
    mapRef.current = m;
    return () => {
      m.remove();
      mapRef.current = null;
      layerRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // recenter on center prop change (only if no live point)
  useEffect(() => {
    if (!mapRef.current) return;
    if (!livePoint) mapRef.current.setView([center.lat, center.lng], zoom);
  }, [center.lat, center.lng, zoom, livePoint]);

  // redraw layers
  useEffect(() => {
    const layer = layerRef.current;
    const map = mapRef.current;
    if (!layer || !map) return;
    layer.clearLayers();

    // territories
    territories.forEach((t) => {
      if (t.polygon.length < 3) return;
      const color = t.ownedByMe ? "#138808" : "#FF3355";
      L.polygon(
        t.polygon.map((p) => [p.lat, p.lng]),
        {
          color,
          weight: 2,
          fillColor: color,
          fillOpacity: 0.28,
        }
      ).addTo(layer);
    });

    // track path
    if (trackPath.length > 1) {
      L.polyline(
        trackPath.map((p) => [p.lat, p.lng]),
        { color: "#FF6B35", weight: 5, opacity: 0.95 }
      ).addTo(layer);
    }

    // draft polygon (about-to-capture)
    if (draftPolygon && draftPolygon.length >= 3) {
      L.polygon(
        draftPolygon.map((p) => [p.lat, p.lng]),
        {
          color: "#FFD166",
          weight: 2,
          dashArray: "6,6",
          fillColor: "#FFD166",
          fillOpacity: 0.18,
        }
      ).addTo(layer);
    }
  }, [territories, trackPath, draftPolygon]);

  // live marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!livePoint) {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
      return;
    }
    const ll: L.LatLngExpression = [livePoint.lat, livePoint.lng];
    if (!markerRef.current) {
      markerRef.current = L.marker(ll, { icon: tigerIcon }).addTo(map);
      map.setView(ll, map.getZoom());
    } else {
      markerRef.current.setLatLng(ll);
    }
  }, [livePoint?.lat, livePoint?.lng]);

  return <div ref={elRef} className={className} />;
}
