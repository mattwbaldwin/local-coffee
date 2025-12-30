import { NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

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
  "dunn brothers",
  "dunn brothers coffee",
  "holiday stationstores",
  "holiday station store",
  "holiday",
];

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isChainName(name: string): boolean {
  const n = normalize(name);

  if (KNOWN_CHAINS.some((c) => n.includes(normalize(c)))) {
    // Special-case: "Holiday" alone might be a local business name, but Holiday gas/store is a chain.
    if (
      n.includes("holiday") &&
      !(n.includes("station") || n.includes("store") || n.includes("gas") || n.includes("stationstores"))
    ) {
      return false;
    }
    return true;
  }

  // Heuristic patterns that often indicate chains
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

async function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

async function fetchTextSearchPages(baseUrl: URL, maxPages = 3): Promise<PlaceResult[]> {
  const all: PlaceResult[] = [];
  let page = 0;
  const workUrl = new URL(baseUrl.toString());

  while (page < maxPages) {
    const r = await fetch(workUrl.toString(), { method: "GET" });
    if (!r.ok) break;

    const data = (await r.json()) as {
      status?: string;
      results?: PlaceResult[];
      next_page_token?: string;
      error_message?: string;
    };

    if (data.status && data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      break;
    }

    all.push(...(data.results ?? []));

    const token = data.next_page_token;
    if (!token) break;

    // Google says next_page_token may take a moment to become valid
    await sleep(2000);
    workUrl.searchParams.set("pagetoken", token);
    page += 1;
  }

  return all;
}

// ----- Rate limiting (Upstash) -----
const redis = Redis.fromEnv();
const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, "1 m"), // 30 req/min per IP
});

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  // Rate limit early
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  const { success } = await ratelimit.limit(`coffee:${ip}`);
  if (!success) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again in a minute." },
      { status: 429 }
    );
  }

  const latStr = searchParams.get("lat");
  const lngStr = searchParams.get("lng");
  const radiusStr = searchParams.get("radiusMeters");

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

  // Default 5km; clamp up to 100km (~62 miles)
  const requested = radiusStr ? Number(radiusStr) : 5000;
  const radiusMeters = Number.isFinite(requested)
    ? Math.max(500, Math.min(100000, Math.round(requested)))
    : 5000;

  const url = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
  url.searchParams.set("query", "coffee shop");
  url.searchParams.set("location", `${lat},${lng}`);
  url.searchParams.set("radius", String(radiusMeters));
  url.searchParams.set("key", process.env.GOOGLE_PLACES_API_KEY);

  const rawPages = await fetchTextSearchPages(url, 3);

  const uniqueById = new Map<string, PlaceResult>();
  for (const p of rawPages) {
    if (p?.place_id && !uniqueById.has(p.place_id)) uniqueById.set(p.place_id, p);
  }

  const raw = Array.from(uniqueById.values());
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

  // Stable default order: distance
  items.sort((a, b) => (a.distanceMeters ?? 9e15) - (b.distanceMeters ?? 9e15));

  return NextResponse.json({
    radiusMeters,
    returned: items.length,
    items: items.slice(0, 60),
  });
}

