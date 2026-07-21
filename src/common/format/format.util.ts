import type { User } from "@prisma/client";

export function getDefaultAvatarUrl(seed: string) {
  return `https://source.boringavatars.com/beam/120/${encodeURIComponent(seed)}`;
}

export function getUserInitials(label: string) {
  const parts = label
    .replace(/@.*/, "")
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const initials = parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : parts[0]?.slice(0, 2);

  return initials?.toUpperCase() || "U";
}

// Mostly monochrome with teal/coral sprinkled in sparingly, matching the
// "restrained use of black, accents reserved for highlights" brand rule.
const avatarAccents = [
  { bg: "bg-[#292f36]", text: "text-white" },
  { bg: "bg-[#292f36]", text: "text-white" },
  { bg: "bg-[#292f36]", text: "text-white" },
  { bg: "bg-[#4ECDC4]", text: "text-[#16413c]" },
  { bg: "bg-[#E3F8F6]", text: "text-[#206a5b]" },
  { bg: "bg-[#FF6B6B]", text: "text-white" },
  { bg: "bg-[#FFECEC]", text: "text-[#b23b3b]" },
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
  role: string;
  homeNeighborhood: string | null;
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
    email: user.email ?? "",
    image: user.image,
    role: user.role,
    homeNeighborhood: user.homeNeighborhood,
    eventInterests: user.eventInterests,
    eventGoals: user.eventGoals,
    memberSince: user.createdAt.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    }),
    createdAt: user.createdAt.toISOString(),
    onboardingCompletedAt: user.onboardingCompletedAt?.toISOString() ?? null,
  };
}
