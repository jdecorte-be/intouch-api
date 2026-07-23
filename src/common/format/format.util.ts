import type { User } from '@prisma/client';

// Self-hosted (see ../../avatars/avatars.controller.ts) rather than
// source.boringavatars.com, which turned out to be a paid/subscription
// service with no documented free tier — not something to depend on for
// every user's default avatar.
export function getDefaultAvatarUrl(seed: string) {
  const baseUrl = (process.env.APP_BASE_URL || 'http://localhost:4000').replace(
    /\/$/,
    '',
  );

  return `${baseUrl}/avatars/beam/${encodeURIComponent(seed)}`;
}

export function formatRelativeTime(date: Date) {
  const diffMinutes = Math.floor((Date.now() - date.getTime()) / 60_000);

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  return `${Math.floor(diffHours / 24)}d ago`;
}

export function getUserInitials(label: string) {
  const parts = label
    .replace(/@.*/, '')
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const initials =
    parts.length > 1
      ? `${parts[0][0]}${parts[parts.length - 1][0]}`
      : parts[0]?.slice(0, 2);

  return initials?.toUpperCase() || 'U';
}

// Mostly monochrome with teal/coral sprinkled in sparingly, matching the
// "restrained use of black, accents reserved for highlights" brand rule.
const avatarAccents = [
  { bg: 'bg-[#292f36]', text: 'text-white' },
  { bg: 'bg-[#292f36]', text: 'text-white' },
  { bg: 'bg-[#292f36]', text: 'text-white' },
  { bg: 'bg-[#4ECDC4]', text: 'text-[#16413c]' },
  { bg: 'bg-[#E3F8F6]', text: 'text-[#206a5b]' },
  { bg: 'bg-[#FF6B6B]', text: 'text-white' },
  { bg: 'bg-[#FFECEC]', text: 'text-[#b23b3b]' },
] as const;

export function getAvatarAccent(label: string) {
  let hash = 0;

  for (let index = 0; index < label.length; index += 1) {
    hash = (hash * 31 + label.charCodeAt(index)) | 0;
  }

  return avatarAccents[Math.abs(hash) % avatarAccents.length];
}

export type SerializedSessionUser = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  photos: string[];
  age: number | null;
  gender: string | null;
  languagesSpoken: string[];
  role: string;
  homeNeighborhood: string | null;
  homeCoordinates: [number, number] | null;
  eventInterests: string[];
  eventGoals: string[];
  memberSince: string;
  createdAt: string;
  onboardingCompletedAt: string | null;
};

export function serializeSessionUser(user: User): SerializedSessionUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email ?? '',
    image: user.image,
    photos: user.photos,
    age: user.age,
    gender: user.gender,
    languagesSpoken: user.languagesSpoken,
    role: user.role,
    homeNeighborhood: user.homeNeighborhood,
    homeCoordinates:
      user.homeLongitude != null && user.homeLatitude != null
        ? [user.homeLongitude, user.homeLatitude]
        : null,
    eventInterests: user.eventInterests,
    eventGoals: user.eventGoals,
    memberSince: user.createdAt.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    }),
    createdAt: user.createdAt.toISOString(),
    onboardingCompletedAt: user.onboardingCompletedAt?.toISOString() ?? null,
  };
}
