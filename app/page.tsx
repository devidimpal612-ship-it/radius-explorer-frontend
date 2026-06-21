"use client";
import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import type { Place } from "../components/Map";
import LocationInput, { Suggestion } from "../components/LocationInput";

const Map = dynamic(() => import("../components/Map"), { ssr: false });

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const RADIUS_OPTIONS = [
  { label: "100m", value: 100 },
  { label: "250m", value: 250 },
  { label: "500m", value: 500 },
  { label: "1km", value: 1000 },
  { label: "2km", value: 2000 },
  { label: "5km", value: 5000 },
  { label: "10km", value: 10000 },
  { label: "25km", value: 25000 },
  { label: "50km", value: 50000 },
];

type Stats = {
  total: number;
  restaurants: number;
  cafes: number;
  hospitals: number;
  pharmacies: number;
  schools: number;
  banks: number;
  shops: number;
  hotels: number;
};

type DistanceResult = {
  distance_km: string;
  duration_min: number;
  steps: string[];
};

export default function Home() {
  const [query, setQuery] = useState("");
  const [radius, setRadius] = useState(1000);
  const [center, setCenter] = useState<[number, number]>([28.6139, 77.209]); // Delhi default
  const [locationName, setLocationName] = useState("New Delhi, India");
  const [places, setPlaces] = useState<Place[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"explore" | "distance">("explore");
  const [filterType, setFilterType] = useState("all");
  const [routeGeometry, setRouteGeometry] = useState(null);

  // Distance tab state
  const [distFrom, setDistFrom] = useState("");
  const [distTo, setDistTo] = useState("");
  const [distFromCoords, setDistFromCoords] = useState<Suggestion | null>(null);
  const [distToCoords, setDistToCoords] = useState<Suggestion | null>(null);
  const [distMode, setDistMode] = useState("driving");
  const [distResult, setDistResult] = useState<DistanceResult | null>(null);
  const [distLoading, setDistLoading] = useState(false);
  const [distError, setDistError] = useState("");

  const searchPlaces = useCallback(async (lat: number, lon: number, r: number) => {
    const [placesRes, statsRes] = await Promise.all([
      fetch(`${API}/api/places?lat=${lat}&lon=${lon}&radius=${r}`),
      fetch(`${API}/api/stats?lat=${lat}&lon=${lon}&radius=${r}`),
    ]);
    const placesData = await placesRes.json();
    const statsData = await statsRes.json();
    setPlaces(placesData.places || []);
    setStats(statsData);
  }, []);

  const handleMapClick = useCallback(async (lat: number, lon: number) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
        { headers: { "User-Agent": "RadiusExplorer/1.0" } }
      );
      const data = await res.json();
      setLocationName(data.display_name || `${lat.toFixed(4)}, ${lon.toFixed(4)}`);
    } catch {}
    setCenter([lat, lon]);
    await searchPlaces(lat, lon, radius);
    setLoading(false);
  }, [radius, searchPlaces]);

  // When user picks a suggestion from the main search autocomplete
  const handleMainSelect = async (s: Suggestion) => {
    setQuery(s.display_name);
    setLocationName(s.display_name);
    setCenter([s.lat, s.lon]);
    setLoading(true);
    setError("");
    try {
      await searchPlaces(s.lat, s.lon, radius);
    } catch (err: any) {
      setError("Failed to load places");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/api/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data.error) throw new Error("Location not found — try selecting a suggestion instead");
      const { lat, lon, display_name } = data.results[0];
      setCenter([lat, lon]);
      setLocationName(display_name);
      await searchPlaces(lat, lon, radius);
    } catch (err: any) {
      setError(err.message || "Search failed");
    } finally {
      setLoading(false);
    }
  };

  const handleRadiusChange = async (r: number) => {
    setRadius(r);
    if (center) {
      setLoading(true);
      await searchPlaces(center[0], center[1], r);
      setLoading(false);
    }
  };

  const handleDistance = async (e: React.FormEvent) => {
    e.preventDefault();
    setDistError("");

    if (!distFromCoords || !distToCoords) {
      setDistError("Please select both locations from the suggestion list");
      return;
    }

    setDistLoading(true);
    setDistResult(null);
    setRouteGeometry(null);
    try {
      const distRes = await fetch(
        `${API}/api/distance?lat1=${distFromCoords.lat}&lon1=${distFromCoords.lon}&lat2=${distToCoords.lat}&lon2=${distToCoords.lon}&mode=${distMode}`
      );
      const dist = await distRes.json();
      if (dist.error) throw new Error(dist.error);

      setDistResult(dist);
      setRouteGeometry(dist.geometry);
      setCenter([distFromCoords.lat, distFromCoords.lon]);
    } catch (err: any) {
      setDistError(err.message || "Could not calculate distance between these points");
    } finally {
      setDistLoading(false);
    }
  };

  const filteredPlaces = filterType === "all" ? places : places.filter((p) => p.type === filterType);
  const uniqueTypes = [...new Set(places.map((p) => p.type))].sort();

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#0A0F1E" }}>
      {/* ── HEADER ── */}
      <header style={{ padding: "14px 24px", borderBottom: "1px solid rgba(0,212,255,0.12)", display: "flex", alignItems: "center", gap: "16px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#00D4FF", boxShadow: "0 0 12px #00D4FF" }} />
          <span style={{ fontWeight: 700, fontSize: 17, letterSpacing: "-0.5px" }}>Radius Explorer</span>
        </div>

        <div style={{ display: "flex", gap: 4, marginLeft: 16 }}>
          {(["explore", "distance"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: "6px 16px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600,
                background: activeTab === tab ? "#00D4FF" : "transparent",
                color: activeTab === tab ? "#0A0F1E" : "#7A8BA0",
                transition: "all 0.15s",
              }}
            >
              {tab === "explore" ? "🔍 Explore" : "📏 Distance"}
            </button>
          ))}
        </div>

        {locationName && (
          <div style={{ marginLeft: "auto", fontSize: 12, color: "#7A8BA0", maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            📍 {locationName}
          </div>
        )}
      </header>

      {/* ── BODY ── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* ── SIDEBAR ── */}
        <div style={{ width: 360, borderRight: "1px solid rgba(0,212,255,0.12)", display: "flex", flexDirection: "column", overflow: "hidden", flexShrink: 0 }}>

          {activeTab === "explore" ? (
            <>
              {/* Search form */}
              <div style={{ padding: 16, borderBottom: "1px solid rgba(0,212,255,0.08)", position: "relative", zIndex: 20 }}>
                <form onSubmit={handleSearch}>
                  <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                    <LocationInput
                      value={query}
                      onChange={setQuery}
                      onSelect={handleMainSelect}
                      placeholder="Search any location..."
                    />
                    <button
                      type="submit"
                      disabled={loading}
                      style={{
                        padding: "10px 16px", borderRadius: 8, border: "none",
                        background: "#00D4FF", color: "#0A0F1E", fontWeight: 700,
                        cursor: loading ? "not-allowed" : "pointer", fontSize: 14,
                        opacity: loading ? 0.7 : 1, flexShrink: 0,
                      }}
                    >
                      {loading ? "..." : "Go"}
                    </button>
                  </div>

                  {/* Radius selector */}
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {RADIUS_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => handleRadiusChange(opt.value)}
                        style={{
                          padding: "4px 10px", borderRadius: 6, border: "1px solid",
                          borderColor: radius === opt.value ? "#00D4FF" : "rgba(255,255,255,0.1)",
                          background: radius === opt.value ? "rgba(0,212,255,0.12)" : "transparent",
                          color: radius === opt.value ? "#00D4FF" : "#7A8BA0",
                          fontSize: 12, fontWeight: 600, cursor: "pointer",
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </form>

                {error && <div style={{ marginTop: 10, color: "#FF6B6B", fontSize: 13 }}>{error}</div>}
              </div>

              {/* Stats */}
              {stats && (
                <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(0,212,255,0.08)" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: "#7A8BA0", textTransform: "uppercase", marginBottom: 10 }}>
                    Area Summary
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                    {[
                      { label: "Total", value: stats.total, color: "#00D4FF" },
                      { label: "Restaurants", value: stats.restaurants, color: "#FF6B6B" },
                      { label: "Cafes", value: stats.cafes, color: "#FFB830" },
                      { label: "Hospitals", value: stats.hospitals, color: "#1AFF8A" },
                      { label: "Pharmacies", value: stats.pharmacies, color: "#00D4FF" },
                      { label: "Schools", value: stats.schools, color: "#C084FC" },
                      { label: "Banks", value: stats.banks, color: "#FFD700" },
                      { label: "Shops", value: stats.shops, color: "#FF8C42" },
                      { label: "Hotels", value: stats.hotels, color: "#7B2FFF" },
                    ].map(({ label, value, color }) => (
                      <div key={label} style={{ background: "#0D1B2A", borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
                        <div style={{ fontSize: 18, fontWeight: 700, color }}>{value}</div>
                        <div style={{ fontSize: 10, color: "#7A8BA0", marginTop: 2 }}>{label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Filter */}
              {places.length > 0 && (
                <div style={{ padding: "10px 16px", borderBottom: "1px solid rgba(0,212,255,0.08)" }}>
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    style={{
                      width: "100%", padding: "8px 12px", borderRadius: 8,
                      background: "#0D1B2A", border: "1px solid rgba(0,212,255,0.2)",
                      color: "#F0F4FF", fontSize: 13, outline: "none",
                    }}
                  >
                    <option value="all">All types ({places.length})</option>
                    {uniqueTypes.map((t) => (
                      <option key={t} value={t}>
                        {t} ({places.filter((p) => p.type === t).length})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Places list */}
              <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
                {filteredPlaces.length === 0 && !loading && (
                  <div style={{ padding: 24, textAlign: "center", color: "#7A8BA0", fontSize: 14 }}>
                    {places.length === 0 ? "Search a location to explore nearby places" : "No places match this filter"}
                  </div>
                )}
                {filteredPlaces.map((place) => (
                  <div
                    key={place.id}
                    style={{
                      padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.03)",
                      cursor: "pointer", transition: "background 0.15s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#0D1B2A")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 3 }}>{place.name}</div>
                    <div style={{ fontSize: 12, color: "#00D4FF", textTransform: "capitalize" }}>{place.type}</div>
                    {place.opening_hours && (
                      <div style={{ fontSize: 11, color: "#7A8BA0", marginTop: 2 }}>🕐 {place.opening_hours}</div>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : (
            /* ── DISTANCE TAB ── */
            <div style={{ padding: 16, flex: 1, overflowY: "auto" }}>
              <form onSubmit={handleDistance}>
                <div style={{ marginBottom: 12, position: "relative", zIndex: 30 }}>
                  <label style={{ fontSize: 12, color: "#7A8BA0", marginBottom: 6, display: "block" }}>From</label>
                  <LocationInput
                    value={distFrom}
                    onChange={(v) => { setDistFrom(v); setDistFromCoords(null); }}
                    onSelect={(s) => { setDistFrom(s.display_name); setDistFromCoords(s); }}
                    placeholder="Starting location..."
                    accentColor="#7B2FFF"
                  />
                </div>
                <div style={{ marginBottom: 12, position: "relative", zIndex: 20 }}>
                  <label style={{ fontSize: 12, color: "#7A8BA0", marginBottom: 6, display: "block" }}>To</label>
                  <LocationInput
                    value={distTo}
                    onChange={(v) => { setDistTo(v); setDistToCoords(null); }}
                    onSelect={(s) => { setDistTo(s.display_name); setDistToCoords(s); }}
                    placeholder="Destination..."
                    accentColor="#7B2FFF"
                  />
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 12, color: "#7A8BA0", marginBottom: 6, display: "block" }}>Travel Mode</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {[
                      { label: "🚗 Drive", value: "driving" },
                      { label: "🚶 Walk", value: "walking" },
                      { label: "🚴 Cycle", value: "cycling" },
                    ].map((m) => (
                      <button
                        key={m.value}
                        type="button"
                        onClick={() => setDistMode(m.value)}
                        style={{
                          flex: 1, padding: "8px", borderRadius: 8, border: "1px solid",
                          borderColor: distMode === m.value ? "#7B2FFF" : "rgba(255,255,255,0.1)",
                          background: distMode === m.value ? "rgba(123,47,255,0.15)" : "transparent",
                          color: distMode === m.value ? "#C084FC" : "#7A8BA0",
                          fontSize: 12, fontWeight: 600, cursor: "pointer",
                        }}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={distLoading}
                  style={{
                    width: "100%", padding: "12px", borderRadius: 8, border: "none",
                    background: "#7B2FFF", color: "#fff", fontWeight: 700, fontSize: 14,
                    cursor: distLoading ? "not-allowed" : "pointer",
                    opacity: distLoading ? 0.7 : 1,
                  }}
                >
                  {distLoading ? "Calculating..." : "Calculate Distance"}
                </button>
              </form>

              {distError && <div style={{ marginTop: 12, color: "#FF6B6B", fontSize: 13 }}>{distError}</div>}

              {distResult && (
                <div style={{ marginTop: 20 }}>
                  <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                    <div style={{ flex: 1, background: "#0D1B2A", borderRadius: 10, padding: 16, textAlign: "center" }}>
                      <div style={{ fontSize: 28, fontWeight: 700, color: "#7B2FFF" }}>{distResult.distance_km}</div>
                      <div style={{ fontSize: 11, color: "#7A8BA0", marginTop: 4 }}>km</div>
                    </div>
                    <div style={{ flex: 1, background: "#0D1B2A", borderRadius: 10, padding: 16, textAlign: "center" }}>
                      <div style={{ fontSize: 28, fontWeight: 700, color: "#1AFF8A" }}>{distResult.duration_min}</div>
                      <div style={{ fontSize: 11, color: "#7A8BA0", marginTop: 4 }}>minutes</div>
                    </div>
                  </div>

                  {distResult.steps.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: "#7A8BA0", textTransform: "uppercase", marginBottom: 10 }}>
                        Directions
                      </div>
                      {distResult.steps.slice(0, 10).map((step, i) => (
                        <div key={i} style={{ padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", fontSize: 13, color: "#B0BCC8", display: "flex", gap: 10 }}>
                          <span style={{ color: "#7B2FFF", fontWeight: 700, minWidth: 20 }}>{i + 1}.</span>
                          {step}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── MAP ── */}
        <div style={{ flex: 1, position: "relative" }}>
          <Map
            center={center}
            radius={radius}
            places={activeTab === "explore" ? filteredPlaces : []}
            routeGeometry={activeTab === "distance" ? routeGeometry : null}
            onMapClick={activeTab === "explore" ? handleMapClick : undefined}
          />

          {/* Floating place count badge */}
          {activeTab === "explore" && places.length > 0 && (
            <div style={{
              position: "absolute", top: 16, left: 16,
              background: "rgba(10,15,30,0.9)", backdropFilter: "blur(12px)",
              border: "1px solid rgba(0,212,255,0.2)", borderRadius: 10,
              padding: "10px 16px", display: "flex", gap: 16,
            }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: "#00D4FF" }}>{places.length}</div>
                <div style={{ fontSize: 10, color: "#7A8BA0" }}>Places found</div>
              </div>
              <div style={{ width: 1, background: "rgba(0,212,255,0.15)" }} />
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: "#F0F4FF" }}>{radius >= 1000 ? `${radius / 1000}km` : `${radius}m`}</div>
                <div style={{ fontSize: 10, color: "#7A8BA0" }}>Radius</div>
              </div>
            </div>
          )}

          {loading && (
            <div style={{
              position: "absolute", inset: 0, background: "rgba(10,15,30,0.6)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <div style={{ background: "#0D1B2A", border: "1px solid rgba(0,212,255,0.2)", borderRadius: 12, padding: "20px 32px", fontSize: 15, color: "#00D4FF", fontWeight: 600 }}>
                🔍 Searching...
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
