// ─── Avatar system ────────────────────────────────────────────────────────────
//
// Rendering order (bottom → top z-index):
//   accessory_back → base → skin → bottom → top → shoes → eyes → mouth → hair → hat → accessory_front
//
// All images share the same 400×700 canvas with transparent background.
// Equipped layers are absolute-positioned over the base body.
//
// HOW TO ADD A NEW ITEM:
//   1. Design at 400×700px in Figma (transparent bg, item aligned to base body)
//   2. Export as PNG → /public/avatar/items/[category]/[slug].png
//   3. Add a DB row: { category, name, price, icon: "/avatar/items/[category]/[slug].png" }
//      Either via seed.ts or an admin panel entry.
//   Done — no code changes needed.

export const LAYER_ORDER = [
  "accessory_back",
  "base",
  "skin",
  "bottom",
  "top",
  "shoes",
  "eyes",
  "mouth",
  "hair",
  "hat",
  "accessory_front",
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

// Width × height in px. Ratio is always 4:7 (400×700 canvas).
export const SIZE_MAP: Record<AvatarSize, { w: number; h: number }> = {
  sm: { w: 40,  h: 70  },  // comments, chips
  md: { w: 64,  h: 112 },  // leaderboard rows
  lg: { w: 140, h: 245 },  // profile card
  xl: { w: 200, h: 350 },  // agent page
};

export function baseUrl(): string {
  return "/avatar/base/BaseSquare.png";
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
