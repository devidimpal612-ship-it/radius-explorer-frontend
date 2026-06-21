"use client";
import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";

export type Place = {
  id: number;
  lat: number;
  lon: number;
  name: string;
  type: string;
  phone?: string;
  website?: string;
  opening_hours?: string;
};

type Props = {
  center: [number, number];
  radius: number;
  places: Place[];
  routeGeometry?: GeoJSON.Geometry | null;
  onMapClick?: (lat: number, lon: number) => void;
};

const TYPE_COLOR: Record<string, string> = {
  restaurant: "#FF6B6B",
  fast_food: "#FF6B6B",
  cafe: "#FFB830",
  hospital: "#1AFF8A",
  clinic: "#1AFF8A",
  pharmacy: "#00D4FF",
  school: "#C084FC",
  college: "#C084FC",
  university: "#C084FC",
  bank: "#FFD700",
  atm: "#FFD700",
  supermarket: "#FF8C42",
  hotel: "#7B2FFF",
  default: "#ffffff",
};

function getColor(type: string) {
  return TYPE_COLOR[type] || TYPE_COLOR.default;
}

function circleGeoJSON(lat: number, lon: number, radiusMeters: number) {
  const points = 64;
  const coords = [];
  const earthRadius = 6371000;
  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * 2 * Math.PI;
    const dx = radiusMeters * Math.cos(angle);
    const dy = radiusMeters * Math.sin(angle);
    const dLon = (dx / (earthRadius * Math.cos((lat * Math.PI) / 180))) * (180 / Math.PI);
    const dLat = (dy / earthRadius) * (180 / Math.PI);
    coords.push([lon + dLon, lat + dLat]);
  }
  return { type: "Feature", geometry: { type: "Polygon", coordinates: [coords] }, properties: {} };
}

export default function Map({ center, radius, places, routeGeometry, onMapClick }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const onMapClickRef = useRef(onMapClick);
  onMapClickRef.current = onMapClick;

  // Init map
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    const map = new maplibregl.Map({
      container: mapRef.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution: "© OpenStreetMap contributors",
          },
        },
        layers: [{ id: "osm-tiles", type: "raster", source: "osm" }],
      },
      center: [center[1], center[0]],
      zoom: 13,
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");
    map.addControl(new maplibregl.FullscreenControl(), "top-right");

    // Click anywhere on map to set new center + search from there
    map.on("click", (e) => {
      const { lng, lat } = e.lngLat;
      if (onMapClickRef.current) onMapClickRef.current(lat, lng);
    });

    map.getCanvas().style.cursor = "crosshair";

    mapInstance.current = map;

    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, []);

  // Update center + radius circle
  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;

    const update = () => {
      map.flyTo({ center: [center[1], center[0]], zoom: radiusToZoom(radius) });

      const circleId = "radius-circle";
      const fillId = "radius-fill";

      if (map.getLayer(fillId)) map.removeLayer(fillId);
      if (map.getLayer(circleId)) map.removeLayer(circleId);
      if (map.getSource(circleId)) map.removeSource(circleId);

      const circle = circleGeoJSON(center[0], center[1], radius) as any;
      map.addSource(circleId, { type: "geojson", data: circle });
      map.addLayer({ id: fillId, type: "fill", source: circleId, paint: { "fill-color": "#00D4FF", "fill-opacity": 0.08 } });
      map.addLayer({ id: circleId, type: "line", source: circleId, paint: { "line-color": "#00D4FF", "line-width": 2, "line-dasharray": [4, 2] } });

      // Center pin
      document.getElementById("center-marker")?.remove();
      const el = document.createElement("div");
      el.id = "center-marker";
      el.style.cssText = `width:16px;height:16px;border-radius:50%;background:#00D4FF;border:3px solid white;box-shadow:0 0 16px #00D4FF;z-index:10;`;
      new maplibregl.Marker({ element: el }).setLngLat([center[1], center[0]]).addTo(map);
    };

    if (map.loaded()) update();
    else map.on("load", update);
  }, [center, radius]);

  // Update place markers
  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    places.forEach((place) => {
      const color = getColor(place.type);
      const el = document.createElement("div");
      el.style.cssText = `width:10px;height:10px;border-radius:50%;background:${color};border:2px solid rgba(255,255,255,0.6);cursor:pointer;transition:transform 0.15s;`;
      el.onmouseenter = () => (el.style.transform = "scale(1.8)");
      el.onmouseleave = () => (el.style.transform = "scale(1)");

      // Clicking a place marker sets it as new center
      el.onclick = (e) => {
        e.stopPropagation();
        if (onMapClickRef.current) onMapClickRef.current(place.lat, place.lon);
      };

      const popup = new maplibregl.Popup({ offset: 12, closeButton: false })
        .setHTML(`
          <div style="font-weight:600;margin-bottom:4px">${place.name}</div>
          <div style="color:#00D4FF;font-size:11px;text-transform:capitalize;margin-bottom:6px">${place.type}</div>
          ${place.phone ? `<div style="color:#7A8BA0;font-size:11px">📞 ${place.phone}</div>` : ""}
          ${place.opening_hours ? `<div style="color:#7A8BA0;font-size:11px">🕐 ${place.opening_hours}</div>` : ""}
          ${place.website ? `<a href="${place.website}" target="_blank" style="color:#00D4FF;font-size:11px">🌐 Website</a>` : ""}
          <div style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.08);color:#1AFF8A;font-size:11px;font-weight:600;cursor:pointer">
            📍 Set as new center
          </div>
        `);

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([place.lon, place.lat])
        .setPopup(popup)
        .addTo(map);

      markersRef.current.push(marker);
    });
  }, [places]);

  // Draw route
  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;

    const routeLayerId = "route-line";
    const routeSourceId = "route";

    if (map.getLayer(routeLayerId)) map.removeLayer(routeLayerId);
    if (map.getSource(routeSourceId)) map.removeSource(routeSourceId);

    if (!routeGeometry) return;

    const addRoute = () => {
      map.addSource(routeSourceId, { type: "geojson", data: { type: "Feature", geometry: routeGeometry, properties: {} } as any });
      map.addLayer({ id: routeLayerId, type: "line", source: routeSourceId, paint: { "line-color": "#7B2FFF", "line-width": 4, "line-opacity": 0.9 } });
    };

    if (map.loaded()) addRoute();
    else map.on("load", addRoute);
  }, [routeGeometry]);

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <div ref={mapRef} style={{ width: "100%", height: "100%" }} />
      {/* Hint tooltip */}
      <div style={{
        position: "absolute", bottom: 16, right: 16,
        background: "rgba(10,15,30,0.85)", backdropFilter: "blur(10px)",
        border: "1px solid rgba(0,212,255,0.15)", borderRadius: 8,
        padding: "7px 12px", fontSize: 12, color: "#7A8BA0",
        pointerEvents: "none",
      }}>
        🖱️ Click anywhere to set new center
      </div>
    </div>
  );
}

function radiusToZoom(meters: number) {
  if (meters <= 250) return 16;
  if (meters <= 500) return 15;
  if (meters <= 1000) return 14;
  if (meters <= 2000) return 13;
  if (meters <= 5000) return 12;
  if (meters <= 10000) return 11;
  if (meters <= 25000) return 10;
  return 9;
}
