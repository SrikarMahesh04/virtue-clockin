import { importLibrary, setOptions } from "@googlemaps/js-api-loader";

export const mapsConfig = {
  key: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
  mapId: process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "",
};
export const mapsConfigured = Boolean(mapsConfig.key && mapsConfig.mapId);
let initialized = false;

export async function loadOfficeMaps() {
  if (!mapsConfigured) throw new Error("Google Maps is not configured.");
  if (!initialized) {
    setOptions({
      key: mapsConfig.key,
      v: "weekly",
      authReferrerPolicy: "origin",
    });
    initialized = true;
  }
  const [maps, markers] = await Promise.all([
    importLibrary("maps") as Promise<google.maps.MapsLibrary>,
    importLibrary("marker") as Promise<google.maps.MarkerLibrary>,
  ]);
  return { ...maps, ...markers };
}

export async function findOfficeAddress(address: string) {
  const { Geocoder } = (await importLibrary(
    "geocoding",
  )) as google.maps.GeocodingLibrary;
  const response = await new Geocoder().geocode({ address });
  if (!response.results.length)
    throw new Error("No matching place found. Try a more specific address.");
  return response.results[0];
}
