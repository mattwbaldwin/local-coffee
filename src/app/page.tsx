"use client";

import { useEffect, useMemo, useState } from "react";

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

function metersToReadable(m: number | null): string {
  if (m == null) return "";
  if (m < 1000) return `${m} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

export default function Home() {
  const [status, setStatus] = useState<"idle" | "locating" | "loading" | "error" | "ready">("idle");
  const [error, setError] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [items, setItems] = useState<CoffeeItem[]>([]);
  const [sortBy, setSortBy] = useState<"distance" | "rating">("distance");

  const headline = useMemo(() => {
    if (status === "locating") return "Getting your location…";
    if (status === "loading") return "Finding independent coffee…";
    return "Independent coffee nearby";
  }, [status]);

  async function fetchCoffee(lat: number, lng: number) {
    setStatus("loading");
    setError(null);
    setItems([]);

    try {
      const res = await fetch(`/api/coffee?lat=${lat}&lng=${lng}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Request failed");
      setItems(data.items ?? []);
      setStatus("ready");
    } catch (e: any) {
      setStatus("error");
      setError(e?.message ?? "Something went wrong");
    }
  }

  function useMyLocation() {
    setStatus("locating");
    setError(null);

    if (!navigator.geolocation) {
      setStatus("error");
      setError("Geolocation is not supported by this browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setCoords({ lat, lng });
        fetchCoffee(lat, lng);
      },
      (err) => {
        setStatus("error");
        setError(err.message || "Location permission denied.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  }

  const sortedItems = useMemo(() => {
    const arr = [...items];

    if (sortBy === "distance") {
      arr.sort((a, b) => (a.distanceMeters ?? 9e15) - (b.distanceMeters ?? 9e15));
      return arr;
    }

    // Rating: higher rating first, then more reviews, then closer
    arr.sort((a, b) => {
      const ar = a.rating ?? 0;
      const br = b.rating ?? 0;
      if (br !== ar) return br - ar;

      const av = a.ratingsTotal ?? 0;
      const bv = b.ratingsTotal ?? 0;
      if (bv !== av) return bv - av;

      return (a.distanceMeters ?? 9e15) - (b.distanceMeters ?? 9e15);
    });

    return arr;
  }, [items, sortBy]);

  useEffect(() => {
    // optional auto-run:
    // useMyLocation();
  }, []);

  return (
    <main
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "24px 16px",
        minHeight: "100vh",
        fontFamily:
          "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Arial, sans-serif",
        background: "#141414",
        color: "#f5f5f5",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <h1 style={{ fontSize: 28, margin: 0 }}>{headline}</h1>

        <p style={{ margin: 0, lineHeight: 1.4, color: "#cfcfcf" }}>
          Shows <strong>independent coffee shops only</strong>. Chains are intentionally excluded.
          Tap to navigate in Google Maps.
        </p>

        <button
          onClick={useMyLocation}
          disabled={status === "locating" || status === "loading"}
          style={{
            marginTop: 8,
            padding: "14px 16px",
            borderRadius: 14,
            border: "1px solid #2a2a2a",
            background: status === "locating" || status === "loading" ? "#2a2a2a" : "#1a1a1a",
            color: "#ffffff",
            fontSize: 16,
            textAlign: "left",
            cursor: status === "locating" || status === "loading" ? "not-allowed" : "pointer",
          }}
        >
          Use my location
        </button>

        {coords && (
          <div style={{ fontSize: 12, color: "#aaaaaa" }}>
            Using location: {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
          </div>
        )}

        {error && (
          <div
            style={{
              marginTop: 8,
              padding: 12,
              borderRadius: 12,
              background: "#2b1b1b",
              border: "1px solid #4a2a2a",
              color: "#ffb4b4",
            }}
          >
            {error}
          </div>
        )}

        {status === "ready" && items.length > 0 && (
          <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
            <label
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                fontSize: 12,
                color: "#bdbdbd",
              }}
            >
              Sort by
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as "distance" | "rating")}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid #2a2a2a",
                  background: "#1a1a1a",
                  color: "#fff",
                  fontSize: 14,
                }}
              >
                <option value="distance">Distance (closest)</option>
                <option value="rating">Rating (best)</option>
              </select>
            </label>

            <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
              <div style={{ fontSize: 12, color: "#9a9a9a" }}>
                Showing {sortedItems.length} local results • Sorted by{" "}
                {sortBy === "distance" ? "distance" : "rating"}
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 12 }}>
        {status === "ready" && items.length === 0 && (
          <div
            style={{
              padding: 14,
              borderRadius: 14,
              background: "#1c1c1c",
              border: "1px solid #2a2a2a",
              color: "#cccccc",
            }}
          >
            No independent coffee shops found nearby.
          </div>
        )}

        {sortedItems.map((it) => (
          <div
            key={it.placeId}
            style={{
              padding: 16,
              borderRadius: 16,
              background: "#f7f7f7",
              color: "#111",
              border: "1px solid #e5e5e5",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div style={{ fontSize: 16, fontWeight: 650 }}>{it.name}</div>
              <div style={{ fontSize: 12, color: "#555" }}>{metersToReadable(it.distanceMeters)}</div>
            </div>

            <div
              style={{
                marginTop: 6,
                display: "flex",
                gap: 12,
                fontSize: 13,
                color: "#333",
                flexWrap: "wrap",
              }}
            >
              {it.rating != null && (
                <span>
                  {it.rating.toFixed(1)} ★{it.ratingsTotal != null ? ` (${it.ratingsTotal})` : ""}
                </span>
              )}
              {it.openNow != null && <span>{it.openNow ? "Open now" : "Closed"}</span>}
            </div>

            {it.address && (
              <div style={{ marginTop: 6, fontSize: 13, color: "#444", lineHeight: 1.3 }}>
                {it.address}
              </div>
            )}

            <div style={{ marginTop: 10 }}>
              <a
                href={it.mapsUrl}
                style={{
                  display: "inline-block",
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid #ccc",
                  textDecoration: "none",
                  color: "#111",
                  fontSize: 14,
                }}
              >
                Open in Google Maps
              </a>
            </div>
          </div>
        ))}
      </div>

      <footer style={{ marginTop: 26, fontSize: 12, color: "#888", lineHeight: 1.35 }}>
        Data powered by Google Places. Chains are excluded by name heuristics; some false negatives may still occur.
      </footer>
    </main>
  );
}

