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

const COFFEE_HINTS = [
  "coffee",
  "cafe",
  "espresso",
  "roaster",
  "roasters",
  "roastery",
  "roasting",
  "latte",
  "pour over",
  "pour-over",
  "cold brew",
  "cold-brew",
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
    // Special-case: "Holiday" alone is ambiguous (could be "Holiday Cafe")
    if (
      n.includes("holiday") &&
      !(n.includes("station") || n.includes("store") || n.includes("gas") || n.includes("stationstores"))
    ) {
      return false;
    }
    return true;
  }

  // Heuristics for multi-location naming patterns
  if (/\b#\s?\d{2,}\b/.test(n)) return true;
  if (/\b(store|location)\b/.test(n) && /\b\d{2,}\b/.test(n)) return true;

  return false;
}

function looksLikeCoffeePlace(name: string): boolean {
  const n = normalize(name);
  return COFFEE_HINTS.some((w) => n.includes(normalize(w)));
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

/**
 * Google Places Nearby Search can return up to ~60 results via pagination tokens.
 * next_page_token becomes valid after a short delay.
 */
async function fetchNearbySearchPages(baseUrl: URL, maxPages = 3): Promise<PlaceResult[]> {
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

    // Token needs time to activate
    await sleep(2000);
    workUrl.searchParams.set("pagetoken", token);
    page += 1;
  }

  return all;
}

/**
 * OPTIONAL rate limiting:
 * - Works on Vercel if you set UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
 * - Does nothing locally if those vars are missing
 */
const hasUpstash =
  !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;

const ratelimit = hasUpstash
  ? new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(30, "1 m"),
    })
  : null;

export async function GET(req: Request) {
  // Rate limit early (only if Upstash env vars exist)
  if (ratelimit) {
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
  }

  const { searchParams } = new URL(req.url);
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

  // Places Nearby Search radius max is 50,000 meters.
  // Default: 5km. Clamp: 500m to 50,000m to keep results valid + costs sane.
  const requested = radiusStr ? Number(radiusStr) : 5000;
  const radiusMeters = Number.isFinite(requested)
    ? Math.max(500, Math.min(50000, Math.round(requested)))
    : 5000;

  // Nearby Search (better relevance than textsearch for this use-case)
  const url = new URL("https://maps.googleapis.com/maps/api/place/nearbysearch/json");
  url.searchParams.set("location", `${lat},${lng}`);
  url.searchParams.set("radius", String(radiusMeters));
  url.searchParams.set("type", "cafe");
  url.searchParams.set("keyword", "coffee");
  url.searchParams.set("key", process.env.GOOGLE_PLACES_API_KEY);

  const rawPages = await fetchNearbySearchPages(url, 3);

  // De-dupe by place_id
  const uniqueById = new Map<string, PlaceResult>();
  for (const p of rawPages) {
    if (p?.place_id && !uniqueById.has(p.place_id)) uniqueById.set(p.place_id, p);
  }

  const raw = Array.from(uniqueById.values());

  // Filter: remove obvious chains AND reduce non-coffee bleed
  const filtered = raw.filter((p) => {
    if (!p.name) return false;
    if (isChainName(p.name)) return false;
    if (!looksLikeCoffeePlace(p.name)) return false;
    return true;
  });

  const items: CoffeeItem[] = filtered.map((p) => {
    const pLat = p.geometry?.location?.lat ?? null;
    const pLng = p.geometry?.location?.lng ?? null;
    const dist =
      pLat != null && pLng != null ? Math.round(haversineMeters(lat, lng, pLat, pLng)) : null;

    const address = p.vicinity ?? p.formatted_address ?? null;

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

  // Default order: distance
  items.sort((a, b) => (a.distanceMeters ?? 9e15) - (b.distanceMeters ?? 9e15));

  return NextResponse.json({
    radiusMeters,
    returned: items.length,
    items: items.slice(0, 60),
  });
}
