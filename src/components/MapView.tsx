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
  accuracy?: number | null;
  heading?: number | null;
  follow?: boolean;
  territories?: Territory[];
  draftPolygon?: LatLng[] | null;
  zoom?: number;
  className?: string;
  interactive?: boolean;
};

// Google-Maps-style live location: white-ringed blue dot + heading cone + pulse
function liveDotIcon(heading: number | null) {
  const h = heading == null ? null : heading;
  const cone =
    h == null
      ? ""
      : `<div style="
          position:absolute;left:50%;top:50%;
          width:0;height:0;
          transform: translate(-50%, -100%) rotate(${h}deg);
          transform-origin: 50% 100%;
        ">
          <div style="
            width:54px;height:54px;
            transform: translate(-50%, -100%);
            background: conic-gradient(from -22deg at 50% 100%, transparent 0deg, rgba(255,107,53,0.55) 22deg, transparent 44deg);
            -webkit-mask: radial-gradient(circle at 50% 100%, black 0 100%, transparent 100%);
            filter: blur(1px);
          "></div>
        </div>`;
  return L.divIcon({
    className: "",
    html: `
      <div style="position:relative;width:28px;height:28px;">
        ${cone}
        <span class="terra-pulse" style="
          position:absolute;inset:-10px;border-radius:50%;
          background: radial-gradient(circle, rgba(255,107,53,0.55), rgba(255,107,53,0) 70%);
        "></span>
        <div style="
          position:absolute;inset:0;border-radius:50%;
          background:#FF6B35;
          border:3px solid #fff;
          box-shadow:0 2px 8px rgba(0,0,0,0.45), 0 0 0 1px rgba(0,0,0,0.25);
        "></div>
      </div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

export function MapView({
  center = { lat: 12.9716, lng: 77.5946 },
  trackPath = [],
  livePoint = null,
  accuracy = null,
  heading = null,
  follow = false,
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
  const accuracyRef = useRef<L.Circle | null>(null);
  const animRef = useRef<number | null>(null);
  const lastLLRef = useRef<L.LatLng | null>(null);

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
      zoomAnimation: true,
      fadeAnimation: true,
      markerZoomAnimation: true,
    });
    // CartoDB dark tiles for tactical look + smooth raster perf
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 20,
      attribution: "© OpenStreetMap © CARTO",
      subdomains: "abcd",
    }).addTo(m);
    layerRef.current = L.layerGroup().addTo(m);
    mapRef.current = m;
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      m.remove();
      mapRef.current = null;
      layerRef.current = null;
      markerRef.current = null;
      accuracyRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // recenter when not following live + no live point
  useEffect(() => {
    if (!mapRef.current) return;
    if (!livePoint && !follow) mapRef.current.setView([center.lat, center.lng], zoom);
  }, [center.lat, center.lng, zoom, livePoint, follow]);

  // redraw layers (territories, track, draft)
  useEffect(() => {
    const layer = layerRef.current;
    const map = mapRef.current;
    if (!layer || !map) return;
    layer.clearLayers();

    territories.forEach((t) => {
      if (t.polygon.length < 3) return;
      const color = t.ownedByMe ? "#138808" : "#FF3355";
      const poly = L.polygon(
        t.polygon.map((p) => [p.lat, p.lng] as L.LatLngTuple),
        { color, weight: 2, fillColor: color, fillOpacity: 0.28, className: "claim-flash" }
      ).addTo(layer);
      // Strip animation class after the claim flash so re-renders don't re-trigger
      setTimeout(() => {
        const el = (poly as unknown as { _path?: SVGPathElement })._path;
        if (el) el.classList.remove("claim-flash");
      }, 950);
    });

    if (trackPath.length > 1) {
      const latlngs = trackPath.map((p) => [p.lat, p.lng] as L.LatLngTuple);
      // Glow underlay
      L.polyline(latlngs, {
        color: "#FF6B35", weight: 11, opacity: 0.18, lineCap: "round", lineJoin: "round",
      }).addTo(layer);
      L.polyline(latlngs, {
        color: "#FFB37A", weight: 5, opacity: 0.95, lineCap: "round", lineJoin: "round",
      }).addTo(layer);
    }

    if (draftPolygon && draftPolygon.length >= 3) {
      L.polygon(
        draftPolygon.map((p) => [p.lat, p.lng] as L.LatLngTuple),
        {
          color: "#FFD166", weight: 2.5,
          fillColor: "#FFD166", fillOpacity: 0.22,
          className: "draft-territory",
        }
      ).addTo(layer);
    }
  }, [territories, trackPath, draftPolygon]);

  // live marker + smooth interpolation between fixes (Google-Maps feel)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!livePoint) {
      if (markerRef.current) { markerRef.current.remove(); markerRef.current = null; }
      if (accuracyRef.current) { accuracyRef.current.remove(); accuracyRef.current = null; }
      lastLLRef.current = null;
      return;
    }

    const target = L.latLng(livePoint.lat, livePoint.lng);

    // Accuracy circle
    if (accuracy != null) {
      if (!accuracyRef.current) {
        accuracyRef.current = L.circle(target, {
          radius: accuracy,
          color: "#FF6B35", weight: 1, opacity: 0.4,
          fillColor: "#FF6B35", fillOpacity: 0.08,
        }).addTo(map);
      } else {
        accuracyRef.current.setLatLng(target);
        accuracyRef.current.setRadius(accuracy);
      }
    }

    if (!markerRef.current) {
      markerRef.current = L.marker(target, { icon: liveDotIcon(heading), keyboard: false }).addTo(map);
      lastLLRef.current = target;
      if (follow) map.setView(target, map.getZoom(), { animate: true });
      return;
    }

    // Update icon (heading) without re-creating constantly
    markerRef.current.setIcon(liveDotIcon(heading));

    // Animate marker from last position to new fix over ~700ms
    const start = lastLLRef.current ?? target;
    const startTs = performance.now();
    const duration = 700;
    if (animRef.current) cancelAnimationFrame(animRef.current);

    const step = (now: number) => {
      const t = Math.min(1, (now - startTs) / duration);
      // ease-out cubic
      const e = 1 - Math.pow(1 - t, 3);
      const lat = start.lat + (target.lat - start.lat) * e;
      const lng = start.lng + (target.lng - start.lng) * e;
      const ll = L.latLng(lat, lng);
      markerRef.current?.setLatLng(ll);
      if (follow) map.panTo(ll, { animate: true, duration: 0.7, easeLinearity: 0.25, noMoveStart: true });
      if (t < 1) {
        animRef.current = requestAnimationFrame(step);
      } else {
        lastLLRef.current = target;
        animRef.current = null;
      }
    };
    animRef.current = requestAnimationFrame(step);
  }, [livePoint?.lat, livePoint?.lng, accuracy, heading, follow]);

  return <div ref={elRef} className={className} />;
}
