// Geo math helpers — polygon area, closed-loop detection, distance.
export type LatLng = { lat: number; lng: number };
export type TrackPoint = LatLng & { t: number };

const R = 6371000; // meters

export function haversine(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function totalDistanceMeters(points: LatLng[]): number {
  let d = 0;
  for (let i = 1; i < points.length; i++) d += haversine(points[i - 1], points[i]);
  return d;
}

// Spherical polygon area via shoelace on equirectangular projection — good enough for run-sized loops.
export function polygonAreaM2(points: LatLng[]): number {
  if (points.length < 3) return 0;
  const lat0 = points.reduce((s, p) => s + p.lat, 0) / points.length;
  const cosLat = Math.cos((lat0 * Math.PI) / 180);
  const mPerDegLat = 111320;
  const mPerDegLng = 111320 * cosLat;
  const xy = points.map((p) => ({ x: p.lng * mPerDegLng, y: p.lat * mPerDegLat }));
  let area = 0;
  for (let i = 0; i < xy.length; i++) {
    const j = (i + 1) % xy.length;
    area += xy[i].x * xy[j].y - xy[j].x * xy[i].y;
  }
  return Math.abs(area / 2);
}

export function isClosedLoop(points: LatLng[], thresholdM = 30): boolean {
  if (points.length < 10) return false;
  const dist = haversine(points[0], points[points.length - 1]);
  return dist <= thresholdM;
}

export function centerOf(points: LatLng[]): LatLng {
  const lat = points.reduce((s, p) => s + p.lat, 0) / points.length;
  const lng = points.reduce((s, p) => s + p.lng, 0) / points.length;
  return { lat, lng };
}

export function formatDuration(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h) return `${h}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export function formatPace(distanceKm: number, seconds: number): string {
  if (distanceKm <= 0.01) return "—";
  const paceMin = seconds / 60 / distanceKm;
  const m = Math.floor(paceMin);
  const s = Math.floor((paceMin - m) * 60);
  return `${m}:${s.toString().padStart(2, "0")}/km`;
}

export function calcLevel(totalAreaKm2: number): number {
  // 100 levels — quadratic curve, ~10 km² to hit 100
  return Math.min(100, 1 + Math.floor(Math.sqrt(totalAreaKm2 * 100)));
}

export const TITLES = [
  { min: 1, label: "Naya Daudaku" },
  { min: 11, label: "Gully Ka Gunda" },
  { min: 26, label: "Sheher Ka Sher" },
  { min: 51, label: "Rajya Ka Rakhwala" },
  { min: 76, label: "Desh Ka Daudaku" },
  { min: 100, label: "Maharaja of the Map" },
];

export function titleFor(level: number): string {
  return [...TITLES].reverse().find((t) => level >= t.min)!.label;
}
