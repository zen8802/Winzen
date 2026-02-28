// ─── Avatar system ────────────────────────────────────────────────────────────
//
// Rendering order (bottom → top z-index):
//   accessory_back → base → skin → eyes → mouth → hair → top → bottom → shoes → accessory_front → hat
//
// All images share the same 1000×1000 square canvas with transparent background.
// Equipped layers are absolute-positioned over the base body.
//
// HOW TO ADD A NEW ITEM:
//   1. Design at 400×700px in Figma (transparent bg, item aligned to base body)
//   2. Export as 1000×1000 PNG → /public/avatar/items/[category]/[slug].png
//   3. Add a DB row: { category, name, price, icon: "/avatar/items/[category]/[slug].png" }
//      Either via seed.ts or an admin panel entry.
//   Done — no code changes needed.

export const LAYER_ORDER = [
  "accessory_back",
  "base",
  "skin",
  "eyes",
  "mouth",
  "hair",
  "top",
  "bottom",
  "shoes",
  "accessory_front",
  "hat",
] as const;

export type AvatarLayer    = (typeof LAYER_ORDER)[number];
export type AvatarCategory = Exclude<AvatarLayer, "base">;

export const AVATAR_CATEGORIES = LAYER_ORDER.filter(
  (l) => l !== "base"
) as readonly AvatarCategory[];

export const CATEGORY_LABELS: Record<AvatarCategory, string> = {
  skin:             "Skin",
  eyes:             "Eyes",
  mouth:            "Mouth",
  hair:             "Hair",
  top:              "Top",
  bottom:           "Bottom",
  shoes:            "Shoes",
  hat:              "Hat",
  accessory_front:  "Accessory",
  accessory_back:   "Back",
};

export type AvatarEquipped = Partial<Record<AvatarCategory, string | null>>;

export type AvatarSize = "sm" | "md" | "lg" | "xl";

// Width × height in px. Base images are 1:1 square (1000×1000 canvas).
export const SIZE_MAP: Record<AvatarSize, { w: number; h: number }> = {
  sm: { w: 56,  h: 56  },  // comments, leaderboard chips
  md: { w: 80,  h: 80  },  // medium contexts
  lg: { w: 140, h: 140 },  // profile card
  xl: { w: 260, h: 260 },  // agent page
};

export function baseUrl(): string {
  return "/avatar/base/BaseSquare1.png";
}

// Given a UserAgent row + resolved item icons, produce the full equipped map.
// Pass this to <Avatar equipped={...} />.
export function resolveEquipped(
  agent: {
    equippedSkinId?:           string | null;
    equippedEyesId?:           string | null;
    equippedMouthId?:          string | null;
    equippedHairId?:           string | null;
    equippedTopId?:            string | null;
    equippedBottomId?:         string | null;
    equippedShoesId?:          string | null;
    equippedHatId?:            string | null;
    equippedAccessoryFrontId?: string | null;
    equippedAccessoryBackId?:  string | null;
  } | null,
  itemIconMap: Map<string, string>, // itemId → icon path
): AvatarEquipped {
  if (!agent) return {};
  const resolve = (id: string | null | undefined) =>
    id ? (itemIconMap.get(id) ?? null) : null;
  return {
    skin:             resolve(agent.equippedSkinId),
    eyes:             resolve(agent.equippedEyesId),
    mouth:            resolve(agent.equippedMouthId),
    hair:             resolve(agent.equippedHairId),
    top:              resolve(agent.equippedTopId),
    bottom:           resolve(agent.equippedBottomId),
    shoes:            resolve(agent.equippedShoesId),
    hat:              resolve(agent.equippedHatId),
    accessory_front:  resolve(agent.equippedAccessoryFrontId),
    accessory_back:   resolve(agent.equippedAccessoryBackId),
  };
}
