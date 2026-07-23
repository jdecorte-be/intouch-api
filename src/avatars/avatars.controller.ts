import { Controller, Get, Header, Param } from "@nestjs/common";

import { renderBeamAvatarSvg } from "../common/format/boring-avatar.util";

// A seed this long can't come from a real email/name and is only useful for
// abusing response size, so it's clamped rather than validated away.
const MAX_SEED_LENGTH = 256;

@Controller("avatars")
export class AvatarsController {
  @Get("beam/:seed")
  @Header("Content-Type", "image/svg+xml")
  // Deterministic per seed, so this is safe to cache indefinitely.
  @Header("Cache-Control", "public, max-age=31536000, immutable")
  getBeamAvatar(@Param("seed") seed: string) {
    return renderBeamAvatarSvg(seed.slice(0, MAX_SEED_LENGTH));
  }
}
