"use client";

import { useEffect, useRef, useState } from "react";
import { Alert, Empty, Field } from "./ui";
import {
  findOfficeAddress,
  loadOfficeMaps,
  mapsConfig,
  mapsConfigured,
} from "@/services/google-maps";

type Point = google.maps.LatLngLiteral;
type MapObjects = {
  map: google.maps.Map;
  marker: google.maps.marker.AdvancedMarkerElement;
  circle: google.maps.Circle;
};

export function OfficeLocationPicker({
  latitude,
  longitude,
  radius,
}: {
  latitude?: number;
  longitude?: number;
  radius?: number;
}) {
  const [point, setPoint] = useState<Point | null>(() =>
    Number.isFinite(latitude) && Number.isFinite(longitude)
      ? { lat: latitude!, lng: longitude! }
      : null,
  );
  const [meters, setMeters] = useState(radius ? String(radius) : "");
  const [status, setStatus] = useState(
    mapsConfigured ? "loading" : "unavailable",
  );
  const [error, setError] = useState("");
  const [address, setAddress] = useState("");
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [notice, setNotice] = useState("");
  const container = useRef<HTMLDivElement>(null);
  const objects = useRef<MapObjects | null>(null);
  const current = useRef({ point, meters });

  useEffect(() => {
    current.current = { point, meters };
  }, [point, meters]);

  useEffect(() => {
    if (!mapsConfigured) return;
    let cancelled = false;
    let click: google.maps.MapsEventListener | undefined;
    let drag: (() => void) | undefined;
    let failed = false;
    let owned: MapObjects | undefined;
    const host = window as typeof window & { gm_authFailure?: () => void };
    const previousFailure = host.gm_authFailure;
    const fail = () => {
      if (cancelled) return;
      failed = true;
      window.clearTimeout(timeout);
      setStatus("error");
      setError(
        "Google Maps could not load. Check the API key, billing, enabled APIs and allowed website addresses, then reload this page.",
      );
    };
    host.gm_authFailure = fail;
    const timeout = window.setTimeout(fail, 20000);
    void loadOfficeMaps()
      .then(({ Map, Circle, AdvancedMarkerElement }) => {
        if (cancelled || failed || !container.current) return;
        window.clearTimeout(timeout);
        const selected = current.current.point;
        const map = new Map(container.current, {
          mapId: mapsConfig.mapId,
          center: selected || { lat: 0, lng: 0 },
          zoom: selected ? 17 : 2,
          colorScheme: google.maps.ColorScheme.DARK,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: true,
          gestureHandling: "cooperative",
          clickableIcons: false,
        });
        const marker = new AdvancedMarkerElement({
          map: selected ? map : null,
          position: selected,
          gmpDraggable: true,
          title: "Office location. Drag to adjust the attendance center.",
        });
        const circle = new Circle({
          map: selected && Number(current.current.meters) > 0 ? map : null,
          center: selected,
          radius: Number(current.current.meters) || 0,
          strokeColor: "#00a6a6",
          strokeOpacity: 1,
          strokeWeight: 2,
          fillColor: "#00cccc",
          fillOpacity: 0.18,
          clickable: false,
        });
        owned = { map, marker, circle };
        objects.current = owned;
        click = map.addListener("click", (event: google.maps.MapMouseEvent) => {
          if (event.latLng) {
            setPoint(event.latLng.toJSON());
            setNotice(
              "Office pin updated. Save office configuration to apply it.",
            );
          }
        });
        drag = () => {
          const position = marker.position;
          if (!position) return;
          setPoint(
            "toJSON" in position
              ? position.toJSON()
              : { lat: position.lat, lng: position.lng },
          );
          setNotice("Office pin moved. Save office configuration to apply it.");
        };
        marker.addEventListener("gmp-dragend", drag);
        if (selected && Number(current.current.meters) > 0) {
          const bounds = circle.getBounds();
          if (bounds) map.fitBounds(bounds, 48);
        }
        setStatus("ready");
      })
      .catch(fail);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      click?.remove();
      if (owned) {
        if (drag) owned.marker.removeEventListener("gmp-dragend", drag);
        owned.marker.map = null;
        owned.circle.setMap(null);
        if (objects.current === owned) objects.current = null;
      }
      host.gm_authFailure = previousFailure;
    };
  }, []);

  useEffect(() => {
    const value = objects.current;
    if (!value || status !== "ready") return;
    value.marker.position = point;
    value.marker.map = point ? value.map : null;
    value.circle.setCenter(point);
    const size = Number(meters);
    value.circle.setRadius(Number.isFinite(size) && size > 0 ? size : 0);
    value.circle.setMap(point && size > 0 && size <= 10000 ? value.map : null);
  }, [point, meters, status]);

  function selectPoint(selected: Point) {
    setPoint(selected);
    objects.current?.map.panTo(selected);
    objects.current?.map.setZoom(17);
    setNotice(
      "Office pin updated. Check the circle, then save office configuration.",
    );
  }

  async function search() {
    if (!address.trim()) return;
    setSearching(true);
    setError("");
    try {
      const match = await findOfficeAddress(address.trim());
      selectPoint(match.geometry.location.toJSON());
      if (match.geometry.viewport)
        objects.current?.map.fitBounds(match.geometry.viewport);
      setNotice(
        `Found ${match.formatted_address}. Adjust the pin if needed, then save office configuration.`,
      );
    } catch {
      setError(
        "Address search failed or found no match. Check the address and Geocoding API configuration, or select a point on the map.",
      );
    } finally {
      setSearching(false);
    }
  }

  function locate() {
    if (!window.isSecureContext) {
      setError(
        "Device location requires HTTPS trusted by this device. You can still select the office on the map.",
      );
      return;
    }
    if (!navigator.geolocation) {
      setError(
        "This browser cannot provide your location. Select the office on the map.",
      );
      return;
    }
    setLocating(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        selectPoint({ lat: coords.latitude, lng: coords.longitude });
        setLocating(false);
      },
      () => {
        setError(
          "Your location is unavailable or permission was denied. Select the office on the map.",
        );
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  return (
    <section
      className="office-location stack"
      aria-labelledby="office-map-title"
    >
      <div>
        <h3 id="office-map-title">Office Location & Attendance Area</h3>
        <p className="muted">
          Search for your office, click the map or drag the pin. The circle
          shows the permitted attendance radius.
        </p>
      </div>
      {status === "unavailable" && (
        <Empty title="Google Maps Is Not Configured">
          Configure the Google Maps browser API key and map ID to select an
          office location. Existing saved location settings are preserved.
        </Empty>
      )}
      {error && <Alert text={error} />}
      {mapsConfigured && (
        <>
          <div className="row office-search">
            <Field label="Find Office Address">
              <input
                value={address}
                maxLength={300}
                onChange={(event) => setAddress(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    if (status === "ready" && !searching) void search();
                  }
                }}
                placeholder="Building, Street, City"
              />
            </Field>
            <button
              type="button"
              disabled={status !== "ready" || searching || !address.trim()}
              onClick={() => void search()}
            >
              {searching ? "Searching…" : "Find on Map"}
            </button>
            <button
              type="button"
              disabled={status !== "ready" || locating}
              onClick={locate}
            >
              {locating ? "Locating…" : "Use My Current Location"}
            </button>
          </div>
          {status === "loading" && <p role="status">Loading Google Maps…</p>}
          <div
            ref={container}
            className="office-map"
            role="region"
            aria-label="Office Location Map"
            style={{ display: status === "error" ? "none" : "block" }}
          />
          <small>
            Keyboard: focus the pin, press Alt+Enter, move with arrow keys, then
            press Enter to drop it. Changes take effect only after saving.
          </small>
        </>
      )}
      <div className="form-grid">
        <Field label="Geofence Radius (Meters)">
          <input
            name="radius"
            type="number"
            min={1}
            max={10000}
            step="any"
            required
            value={meters}
            onChange={(event) => setMeters(event.target.value)}
          />
        </Field>
        <div>
          <h3>Office Pin</h3>
          <p>
            {point ? "Office location selected" : "No office location selected"}
          </p>
          {point && (
            <button
              type="button"
              disabled={status !== "ready"}
              onClick={() => {
                const value = objects.current;
                const bounds = value?.circle.getBounds();
                if (bounds && Number(meters) > 0)
                  value?.map.fitBounds(bounds, 48);
                else if (value) {
                  value.map.panTo(point);
                  value.map.setZoom(17);
                }
              }}
            >
              Show Attendance Area
            </button>
          )}
        </div>
      </div>
      <input type="hidden" name="lat" value={point?.lat ?? ""} />
      <input type="hidden" name="lon" value={point?.lng ?? ""} />
      <p role="status" aria-live="polite">
        {notice}
      </p>
      <small>
        Punch In and Punch Out require a location inside the saved circle,
        acceptable location accuracy, and an approved office network.
      </small>
    </section>
  );
}
