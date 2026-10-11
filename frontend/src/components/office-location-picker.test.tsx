import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OfficeLocationPicker } from "./office-location-picker";

const sdk = vi.hoisted(() => ({
  configured: true,
  load: vi.fn(),
  search: vi.fn(),
  click: undefined as undefined | ((event: unknown) => void),
  drag: undefined as undefined | (() => void),
  marker: undefined as undefined | { position: unknown; map: unknown },
  circle: undefined as
    undefined | { center: unknown; radius: number; map: unknown },
  remove: vi.fn(),
  removeDrag: vi.fn(),
}));

vi.mock("@/services/google-maps", () => ({
  get mapsConfigured() {
    return sdk.configured;
  },
  mapsConfig: { mapId: "test-map" },
  loadOfficeMaps: sdk.load,
  findOfficeAddress: sdk.search,
}));

class FakeMap {
  panTo = vi.fn();
  setZoom = vi.fn();
  fitBounds = vi.fn();
  addListener(_name: string, callback: (event: unknown) => void) {
    sdk.click = callback;
    return { remove: sdk.remove };
  }
}
class FakeMarker {
  position: unknown;
  map: unknown;
  constructor(options: { position: unknown; map: unknown }) {
    this.position = options.position;
    this.map = options.map;
    sdk.marker = this;
  }
  addEventListener(_name: string, callback: () => void) {
    sdk.drag = callback;
  }
  removeEventListener = sdk.removeDrag;
}
class FakeCircle {
  center: unknown;
  radius = 0;
  map: unknown;
  constructor(options: { center: unknown; radius: number; map: unknown }) {
    Object.assign(this, options);
    sdk.circle = this;
  }
  setCenter(point: unknown) {
    this.center = point;
  }
  setRadius(value: number) {
    this.radius = value;
  }
  setMap(map: unknown) {
    this.map = map;
  }
  getBounds() {
    return {};
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  sdk.configured = true;
  sdk.marker = undefined;
  sdk.circle = undefined;
  sdk.load.mockResolvedValue({
    Map: FakeMap,
    Circle: FakeCircle,
    AdvancedMarkerElement: FakeMarker,
  });
  vi.stubGlobal("google", { maps: { ColorScheme: { DARK: "DARK" } } });
  vi.stubGlobal("isSecureContext", true);
});

describe("Office location drafts (mocked Google SDK)", () => {
  it("does not invent a selected office and updates submitted coordinates and radius from pin actions", async () => {
    const { container, unmount } = render(
      <form>
        <OfficeLocationPicker />
      </form>,
    );
    await waitFor(() => expect(sdk.marker).toBeDefined());
    expect(new FormData(container.querySelector("form")!).get("lat")).toBe("");
    expect(sdk.marker?.map).toBeNull();
    act(() =>
      sdk.click?.({ latLng: { toJSON: () => ({ lat: 12, lng: 77 }) } }),
    );
    fireEvent.change(screen.getByLabelText("Geofence Radius (Meters)"), {
      target: { value: "250" },
    });
    expect(sdk.circle?.center).toEqual({ lat: 12, lng: 77 });
    expect(sdk.circle?.radius).toBe(250);
    expect(sdk.circle?.map).toBeTruthy();
    act(() => {
      sdk.marker!.position = { lat: 13, lng: 78 };
      sdk.drag?.();
    });
    const fields = new FormData(container.querySelector("form")!);
    expect(fields.get("lat")).toBe("13");
    expect(fields.get("lon")).toBe("78");
    expect(fields.get("radius")).toBe("250");
    unmount();
    expect(sdk.remove).toHaveBeenCalled();
    expect(sdk.removeDrag).toHaveBeenCalled();
  });
  it("preserves an existing zero-coordinate office when Maps is unconfigured", () => {
    sdk.configured = false;
    const { container } = render(
      <form>
        <OfficeLocationPicker latitude={0} longitude={0} radius={200} />
      </form>,
    );
    expect(screen.getByText("Google Maps Is Not Configured")).toBeVisible();
    expect(sdk.load).not.toHaveBeenCalled();
    const fields = new FormData(container.querySelector("form")!);
    expect(fields.get("lat")).toBe("0");
    expect(fields.get("lon")).toBe("0");
    expect(fields.get("radius")).toBe("200");
  });
  it("announces load failure without claiming the map is ready", async () => {
    sdk.load.mockRejectedValue(new Error("network"));
    render(<OfficeLocationPicker />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Google Maps could not load",
    );
    expect(screen.getByRole("button", { name: "Find on Map" })).toBeDisabled();
  });
  it("searches only on request and keeps the selected pin on a search failure", async () => {
    sdk.search.mockResolvedValue({
      geometry: { location: { toJSON: () => ({ lat: 10, lng: 20 }) } },
      formatted_address: "Test office",
    });
    const { container } = render(
      <form>
        <OfficeLocationPicker />
      </form>,
    );
    await waitFor(() => expect(sdk.marker).toBeDefined());
    fireEvent.change(screen.getByLabelText("Find Office Address"), {
      target: { value: "Test office" },
    });
    expect(sdk.search).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Find on Map" }));
    await screen.findByText(/Found Test office/);
    sdk.search.mockRejectedValue(new Error("provider"));
    fireEvent.click(screen.getByRole("button", { name: "Find on Map" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Address search failed",
    );
    expect(new FormData(container.querySelector("form")!).get("lat")).toBe(
      "10",
    );
  });
  it("reports location permission denial without choosing a pin", async () => {
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition: (_ok: unknown, fail: () => void) => fail() },
    });
    render(<OfficeLocationPicker />);
    await waitFor(() => expect(sdk.marker).toBeDefined());
    fireEvent.click(
      screen.getByRole("button", { name: "Use My Current Location" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "permission was denied",
    );
    expect(screen.getByText("No office location selected")).toBeVisible();
  });
});
