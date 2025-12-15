import { NextResponse } from "next/server";

type PlaceResult = {
  place_id: string;
  name: string;
  rating?: number;
  user_ratings_total?: number;
  vicinity?: string;
  formatted_address?: string;
  geometry?: { location?: { lat: number; lng: number } };
  opening_hours?: { open_now?: boolean };
};

type CoffeeItem = {
  placeId: string;
  name: string;
  rating: number | null;
  ratingsTotal: number | null;
  address: string | null;
  openNow: boolean | null;
  lat: number | null;
  lng: number | null;
  distanceMeters: number | null;
  mapsUrl: string;
};

const KNOWN_CHAINS = [
  "starbucks",
  "dunkin",
  "peet",
  "tim hortons",
  "caribou",
  "dutch bros",
  "scooter",
  "the human bean",
  "biggby",
  "gloria jean",
  "coffee bean & tea leaf",
  "the coffee bean",
  "7-eleven",
  "mcdonald",
  "panera",
  "einstein bros",
  "costa",
  "pret a manger",
  "greggs",
];

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function isChainName(name: string): boolean {
  const n = normalize(name);
  if (KNOWN_CHAINS.some((c) => n.includes(normalize(c)))) return true;

  if (/\b#\s?\d{2,}\b/.test(n)) return true;
  if (/\b(store|location)\b/.test(n) && /\b\d{2,}\b/.test(n)) return true;

  return false;
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function mapsDeepLinkFromPlaceId(placeId: string): string {
  const url = new URL("https://www.google.com/maps/search/");
  url.searchParams.set("api", "1");
  url.searchParams.set("query", "coffee");
  url.searchParams.set("query_place_id", placeId);
  return url.toString();
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const latStr = searchParams.get("lat");
  const lngStr = searchParams.get("lng");

  if (!process.env.GOOGLE_PLACES_API_KEY) {
    return NextResponse.json({ error: "Missing GOOGLE_PLACES_API_KEY" }, { status: 500 });
  }
  if (!latStr || !lngStr) {
    return NextResponse.json({ error: "lat and lng are required" }, { status: 400 });
  }

  const lat = Number(latStr);
  const lng = Number(lngStr);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "lat/lng must be valid numbers" }, { status: 400 });
  }

  const url = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
  url.searchParams.set("query", "coffee shop");
  url.searchParams.set("location", `${lat},${lng}`);
  url.searchParams.set("radius", "3000");
  url.searchParams.set("key", process.env.GOOGLE_PLACES_API_KEY);

  const r = await fetch(url.toString(), { method: "GET" });
  if (!r.ok) {
    return NextResponse.json({ error: "Places request failed" }, { status: 502 });
  }

  const data = (await r.json()) as {
    status?: string;
    results?: PlaceResult[];
    error_message?: string;
  };

  if (data.status && data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    return NextResponse.json(
      { error: "Places API error", status: data.status, message: data.error_message ?? null },
      { status: 502 }
    );
  }

  const raw = data.results ?? [];
  const filtered = raw.filter((p) => p.name && !isChainName(p.name));

  const items: CoffeeItem[] = filtered.map((p) => {
    const pLat = p.geometry?.location?.lat ?? null;
    const pLng = p.geometry?.location?.lng ?? null;
    const dist =
      pLat != null && pLng != null ? Math.round(haversineMeters(lat, lng, pLat, pLng)) : null;

    const address = p.formatted_address ?? p.vicinity ?? null;

    return {
      placeId: p.place_id,
      name: p.name,
      rating: typeof p.rating === "number" ? p.rating : null,
      ratingsTotal: typeof p.user_ratings_total === "number" ? p.user_ratings_total : null,
      address,
      openNow: p.opening_hours?.open_now ?? null,
      lat: pLat,
      lng: pLng,
      distanceMeters: dist,
      mapsUrl: mapsDeepLinkFromPlaceId(p.place_id),
    };
  });

  items.sort((a, b) => {
    const ad = a.distanceMeters ?? Number.MAX_SAFE_INTEGER;
    const bd = b.distanceMeters ?? Number.MAX_SAFE_INTEGER;

    const bucket = (m: number) => (m < 500 ? 0 : m < 1200 ? 1 : m < 2500 ? 2 : 3);
    const ab = bucket(ad);
    const bb = bucket(bd);
    if (ab !== bb) return ab - bb;

    const ar = a.rating ?? 0;
    const br = b.rating ?? 0;
    const av = Math.log10((a.ratingsTotal ?? 0) + 1);
    const bv = Math.log10((b.ratingsTotal ?? 0) + 1);

    const aScore = ar * 2 + av;
    const bScore = br * 2 + bv;

    if (bScore !== aScore) return bScore - aScore;
    return ad - bd;
  });

  return NextResponse.json({ items: items.slice(0, 20) });
}
