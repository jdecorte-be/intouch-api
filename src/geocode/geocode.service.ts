import { Injectable, Logger } from "@nestjs/common";

const MAPBOX_TIMEOUT_MS = 3500;

export type AddressSuggestion = {
  id: string;
  address: string;
  details: string;
  coordinates: [number, number];
};

@Injectable()
export class GeocodeService {
  private readonly logger = new Logger(GeocodeService.name);

  private get mapboxToken() {
    return process.env.MAPBOX_ACCESS_TOKEN;
  }

  private async fetchMapbox(url: URL) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), MAPBOX_TIMEOUT_MS);

    try {
      return await fetch(url, { signal: controller.signal });
    } catch (error) {
      this.logger.warn(`Mapbox request failed: ${error instanceof Error ? error.message : error}`);
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  async geocodeAddress(address: string): Promise<[number, number] | null> {
    if (!this.mapboxToken || !address) {
      return null;
    }

    const url = new URL("https://api.mapbox.com/search/geocode/v6/forward");
    url.searchParams.set("q", address);
    url.searchParams.set("limit", "1");
    url.searchParams.set("access_token", this.mapboxToken);

    const response = await this.fetchMapbox(url);

    if (!response?.ok) {
      return null;
    }

    const data = await response.json();
    const coordinates = data?.features?.[0]?.geometry?.coordinates;

    if (!Array.isArray(coordinates) || typeof coordinates[0] !== "number" || typeof coordinates[1] !== "number") {
      return null;
    }

    return [coordinates[0], coordinates[1]];
  }

  async suggestAddresses(query: string): Promise<AddressSuggestion[]> {
    const search = query.trim();

    if (!this.mapboxToken || search.length < 3) {
      return [];
    }

    const url = new URL("https://api.mapbox.com/search/geocode/v6/forward");
    url.searchParams.set("q", search);
    url.searchParams.set("autocomplete", "true");
    url.searchParams.set("limit", "5");
    url.searchParams.set("proximity", "-79.3832,43.6532");
    url.searchParams.set("language", "en");
    url.searchParams.set("access_token", this.mapboxToken);

    const response = await this.fetchMapbox(url);

    if (!response?.ok) {
      return [];
    }

    const data = await response.json();

    if (!Array.isArray(data?.features)) {
      return [];
    }

    return data.features.flatMap((feature: unknown) => {
      if (!feature || typeof feature !== "object") {
        return [];
      }

      const candidate = feature as {
        id?: unknown;
        geometry?: { coordinates?: unknown };
        properties?: {
          mapbox_id?: unknown;
          name?: unknown;
          name_preferred?: unknown;
          full_address?: unknown;
          place_formatted?: unknown;
        };
      };
      const coordinates = candidate.geometry?.coordinates;

      if (!Array.isArray(coordinates) || typeof coordinates[0] !== "number" || typeof coordinates[1] !== "number") {
        return [];
      }

      const name =
        typeof candidate.properties?.name_preferred === "string"
          ? candidate.properties.name_preferred
          : typeof candidate.properties?.name === "string"
            ? candidate.properties.name
            : "";
      const place = typeof candidate.properties?.place_formatted === "string" ? candidate.properties.place_formatted : "";
      const fullAddress =
        typeof candidate.properties?.full_address === "string"
          ? candidate.properties.full_address
          : [name, place].filter(Boolean).join(", ");

      if (!fullAddress) {
        return [];
      }

      return [
        {
          id:
            (typeof candidate.properties?.mapbox_id === "string"
              ? candidate.properties.mapbox_id
              : typeof candidate.id === "string"
                ? candidate.id
                : fullAddress) ?? fullAddress,
          address: fullAddress,
          details: place,
          coordinates: [coordinates[0], coordinates[1]] as [number, number],
        },
      ];
    });
  }

  async reverseGeocodeLocation(coordinates: [number, number]): Promise<{ venue: string | null; neighborhood: string | null }> {
    if (!this.mapboxToken) {
      return { venue: null, neighborhood: null };
    }

    const url = new URL("https://api.mapbox.com/search/geocode/v6/reverse");
    url.searchParams.set("longitude", String(coordinates[0]));
    url.searchParams.set("latitude", String(coordinates[1]));
    url.searchParams.set("limit", "1");
    url.searchParams.set("access_token", this.mapboxToken);

    const response = await this.fetchMapbox(url);

    if (!response?.ok) {
      return { venue: null, neighborhood: null };
    }

    const data = await response.json();
    const properties = data?.features?.[0]?.properties;
    const context = properties?.context;

    return {
      venue: typeof properties?.name === "string" ? properties.name : null,
      neighborhood: context?.neighborhood?.name ?? context?.locality?.name ?? context?.place?.name ?? null,
    };
  }
}
