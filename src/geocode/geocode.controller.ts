import { Controller, Get, Query } from "@nestjs/common";

import { GeocodeService } from "./geocode.service";

@Controller("geocode")
export class GeocodeController {
  constructor(private readonly geocode: GeocodeService) {}

  @Get("address-suggestions")
  async addressSuggestions(@Query("q") q: string | undefined) {
    const query = (q ?? "").trim().slice(0, 120);

    if (query.length < 3) {
      return { suggestions: [] };
    }

    return { suggestions: await this.geocode.suggestAddresses(query) };
  }
}
