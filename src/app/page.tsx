"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";

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

const ResultsMap = dynamic(() => import("./components/ResultsMap"), { ssr: false });

function metersToReadable(m: number | null): string {
  if (m == null) return "";
  if (m < 1000) return `${m} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

function milesToMeters(mi: number) {
  return Math.round(mi * 1609.344);
}

export default function Home() {
  const [status, setStatus] = useState<"idle" | "locating" | "loading" | "error" | "ready">("idle");
  const [error, setError] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [items, setItems] = useState<CoffeeItem[]>([]);

  const [sortBy, setSortBy] = useState<"distance" | "rating">("distance");
  const [view, setView] = useState<"list" | "map">("list");

  // Radius slider in miles (now up to 60)
  const [radiusMiles, setRadiusMiles] = useState<number>(3);
  const radiusMeters = useMemo(() => milesToMeters(radiusMiles), [radiusMiles]);

  // Debounce refetch when slider changes
  const debounceRef = useRef<number | null>(null);

  const headline = useMemo(() => {
    if (status === "locating") return "Getting your location…";
    if (status === "loading") return "Finding independent coffee…";
    return "Independent coffee nearby";
  }, [status]);

  async function fetchCoffee(lat: number, lng: number, radiusM: number) {
    setStatus("loading");
    setError(null);
    setView("list"); // FIX: ensure list shows by default after each fetch

    try {
      const res = await fetch(`/api/coffee?lat=${lat}&lng=${lng}&radiusMeters=${radiusM}`);
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
        fetchCoffee(lat, lng, radiusMeters);
      },
      (err) => {
        setStatus("error");
        setError(err.message || "Location permission denied.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  }

  // When radius changes and we already have coords, refetch (debounced)
  useEffect(() => {
    if (!coords) return;
    if (status === "locating") return;

    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      fetchCoffee(coords.lat, coords.lng, radiusMeters);
    }, 500);

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [radiusMeters]);

  const sortedItems = useMemo(() => {
    const arr = [...items];

    if (sortBy === "distance") {
      arr.sort((a, b) => (a.distanceMeters ?? 9e15) - (b.distanceMeters ?? 9e15));
      return arr;
    }

    // rating sort (tie-break by ratingsTotal, then distance)
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

{/* Controls */}
{coords && (
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

    <label
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        fontSize: 12,
        color: "#bdbdbd",
      }}
    >
      View
      <select
        value={view}
        onChange={(e) => setView(e.target.value as "list" | "map")}
        style={{
          padding: "10px 12px",
          borderRadius: 12,
          border: "1px solid #2a2a2a",
          background: "#1a1a1a",
          color: "#fff",
          fontSize: 14,
        }}
      >
        <option value="list">List</option>
        <option value="map">Map</option>
      </select>
    </label>

    <label
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        fontSize: 12,
        color: "#bdbdbd",
        minWidth: 240,
      }}
    >
      Radius: {radiusMiles.toFixed(0)} mi
      <input
        type="range"
        min={1}
        max={60}
        step={1}
        value={radiusMiles}
        onChange={(e) => setRadiusMiles(Number(e.target.value))}
        style={{ width: 240 }}
      />
      <div style={{ fontSize: 11, color: "#8f8f8f" }}>
        Expanding radius increases coverage and API usage.
      </div>
    </label>

    {/* Report link (more visible here than at the bottom) */}
    <div
      style={{
        alignSelf: "flex-end",
        fontSize: 12,
        color: "#9a9a9a",
        marginLeft: "auto",
        paddingBottom: 2,
      }}
    >
      Something missing or wrong?{" "}
      <a
        href="PASTE_YOUR_GOOGLE_FORM_URL_HERE"
        target="_blank"
        rel="noreferrer"
        style={{ color: "#f5f5f5", textDecoration: "underline" }}
      >
        Report it
      </a>
    </div>
  </div>
)}
      </div>

      {/* Results */}
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

        {view === "map" && coords && sortedItems.length > 0 ? (
          <ResultsMap userLat={coords.lat} userLng={coords.lng} items={sortedItems} />
        ) : (
          sortedItems.map((it) => (
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
                <div style={{ fontSize: 12, color: "#555" }}>
                  {metersToReadable(it.distanceMeters)}
                </div>
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
          ))
        )}
      </div>

      <footer style={{ marginTop: 26, fontSize: 12, color: "#888", lineHeight: 1.35 }}>
        Data powered by Google Places. Results are “local-only” via chain-name heuristics.
       
      </footer>
    </main>
  );
}
