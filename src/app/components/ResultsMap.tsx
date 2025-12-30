"use client";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import type { LatLngExpression } from "leaflet";

// Fix default marker icons in Next.js builds
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

type CoffeeItem = {
  placeId: string;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  mapsUrl: string;
};

export default function ResultsMap({
  userLat,
  userLng,
  items,
}: {
  userLat: number;
  userLng: number;
  items: CoffeeItem[];
}) {
  const center: LatLngExpression = [userLat, userLng];

  const points = items
    .filter((x) => x.lat != null && x.lng != null)
    .map((x) => ({ ...x, lat: x.lat as number, lng: x.lng as number }));

  return (
    <div
      style={{
        height: 380,
        borderRadius: 16,
        overflow: "hidden",
        border: "1px solid #2a2a2a",
      }}
    >
      <MapContainer center={center} zoom={14} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <Marker position={center}>
          <Popup>Your location</Popup>
        </Marker>

        {points.map((p) => {
          const pos: LatLngExpression = [p.lat, p.lng];
          return (
            <Marker key={p.placeId} position={pos}>
              <Popup>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ fontWeight: 650 }}>{p.name}</div>
                  {p.address && <div style={{ fontSize: 12 }}>{p.address}</div>}
                  <a href={p.mapsUrl} style={{ fontSize: 12 }}>
                    Open in Google Maps
                  </a>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
