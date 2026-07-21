export type EventCategory =
  | "featured"
  | "art"
  | "sport"
  | "games"
  | "social"
  | "educational"
  | "books"
  | "workshops"
  | "party"
  | "comedy";

export type HostableCategory = Exclude<EventCategory, "featured">;

export type EventAttendee = {
  name: string;
  role: string;
  image?: string | null;
  isHost?: boolean;
  userId?: string;
};

export type EventItem = {
  id: string;
  kind: "event" | "group";
  title: string;
  description: string;
  venue: string;
  neighborhood: string;
  category: HostableCategory;
  icon: string;
  startsAt: string;
  startsAtKey?: string;
  price: string;
  going: number;
  capacity: number;
  hosts: string[];
  attendees: EventAttendee[];
  tags: string[];
  coordinates: [number, number];
  accent: string;
  bannerUrl?: string | null;
  imageRevision?: string | null;
  signUpUrl?: string | null;
};

export const categories: Array<{ id: EventCategory; label: string; emoji: string }> = [
  { id: "featured", label: "Featured", emoji: "✨" },
  { id: "art", label: "Art", emoji: "🎨" },
  { id: "sport", label: "Sport", emoji: "🏃" },
  { id: "games", label: "Games", emoji: "🎮" },
  { id: "social", label: "Social", emoji: "🫶" },
  { id: "educational", label: "Educational", emoji: "🧠" },
  { id: "books", label: "Books", emoji: "📚" },
  { id: "workshops", label: "Workshops", emoji: "🛠️" },
  { id: "party", label: "Party", emoji: "🪩" },
  { id: "comedy", label: "Comedy", emoji: "🎭" },
];

export const hostableCategories = categories.filter(
  (category): category is { id: HostableCategory; label: string; emoji: string } => category.id !== "featured",
);

export const categoryEmojis = Object.fromEntries(hostableCategories.map((category) => [category.id, category.emoji])) as Record<
  HostableCategory,
  string
>;

export const categoryAccents: Record<HostableCategory, string> = {
  art: "#ff6b6b",
  sport: "#4ecdc4",
  games: "#6f7280",
  social: "#292f36",
  educational: "#5b6b82",
  books: "#7d6f62",
  workshops: "#4d7d6d",
  party: "#6f5f7f",
  comedy: "#d56f5f",
};

const categoryAliases: Record<string, HostableCategory> = {
  art: "art",
  arts: "art",
  "art and culture": "art",
  culture: "art",
  sport: "sport",
  sports: "sport",
  "active and creative": "sport",
  active: "sport",
  games: "games",
  gaming: "games",
  social: "social",
  dating: "social",
  "dating and social": "social",
  food: "social",
  "food and drinks": "social",
  drinks: "social",
  music: "social",
  concerts: "social",
  "concerts and music": "social",
  outdoor: "social",
  educational: "educational",
  education: "educational",
  learning: "educational",
  books: "books",
  book: "books",
  workshops: "workshops",
  workshop: "workshops",
  markets: "workshops",
  market: "workshops",
  party: "party",
  parties: "party",
  nightlife: "party",
  festival: "party",
  festivals: "party",
  comedy: "comedy",
  "theater and stage": "comedy",
  theater: "comedy",
  stage: "comedy",
};

export function isHostableCategory(value: string): value is HostableCategory {
  return value in categoryAccents;
}

export function normalizeHostableCategoryInput(value: string): HostableCategory | null {
  const trimmed = value.trim();

  if (isHostableCategory(trimmed)) {
    return trimmed;
  }

  const normalized = trimmed
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  return categoryAliases[normalized] ?? null;
}

const validCategoryIds = new Set(categories.filter((category) => category.id !== "featured").map((category) => category.id));

export function isPublicEventCategory(value: string | null): value is HostableCategory {
  return Boolean(value && validCategoryIds.has(value as EventCategory));
}

export const eventBannerTagPrefix = "__banner_url:";
export const eventImageRevisionTagPrefix = "__image_rev:";
export const eventSignUpUrlTagPrefix = "__signup_url:";

export function getEventBannerUrlFromTags(tags: string[]) {
  const bannerTag = tags.find((tag) => tag.startsWith(eventBannerTagPrefix));
  return bannerTag?.slice(eventBannerTagPrefix.length).trim() || null;
}

export function getEventImageRevisionFromTags(tags: string[]) {
  const revisionTag = tags.find((tag) => tag.startsWith(eventImageRevisionTagPrefix));
  return revisionTag?.slice(eventImageRevisionTagPrefix.length).trim() || null;
}

export function getEventSignUpUrlFromTags(tags: string[]) {
  const signUpTag = tags.find((tag) => tag.startsWith(eventSignUpUrlTagPrefix));
  return signUpTag?.slice(eventSignUpUrlTagPrefix.length).trim() || null;
}

export function getPublicEventTags(tags: string[]) {
  return tags.filter(
    (tag) => !tag.startsWith(eventBannerTagPrefix) && !tag.startsWith(eventImageRevisionTagPrefix) && !tag.startsWith(eventSignUpUrlTagPrefix),
  );
}

export function formatCanadianPrice(price: string) {
  const value = price.trim();

  if (!value) {
    return "Free";
  }

  if (/^free(?:\s+admission)?$/i.test(value) || /(?:CA\$|CAD)/i.test(value)) {
    return value;
  }

  const currencyPrefixed = value.replace(/\$\s*(?=\d)/g, () => "CA$");

  if (currencyPrefixed !== value) {
    return currencyPrefixed;
  }

  if (!/\d/.test(value)) {
    return value;
  }

  return value.replace(/\d+(?:\.\d{1,2})?/g, (amount) => `CA$${amount}`);
}

// The static, hand-authored events dataset from the original app is empty
// today; kept as a real (empty) array so the dual-source merge logic in
// EventsService stays correct if entries are ever added here later.
export const staticEvents: EventItem[] = [];
