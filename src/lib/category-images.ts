// Category visual config — used as fallback when a market has no custom imageUrl.
// Each entry defines a CSS gradient + a large Unicode icon for the backdrop.

export interface CategoryVisual {
  gradient: string;
  icon: string;
}

export const CATEGORY_VISUALS: Record<string, CategoryVisual> = {
  sports: {
    gradient: "linear-gradient(135deg, #0c2a47 0%, #1e40af 55%, #0f766e 100%)",
    icon: "⚽",
  },
  politics: {
    gradient: "linear-gradient(135deg, #1e1b4b 0%, #3730a3 55%, #1e3a5f 100%)",
    icon: "🏛",
  },
  culture: {
    gradient: "linear-gradient(135deg, #500724 0%, #9d174d 55%, #7e22ce 100%)",
    icon: "🎭",
  },
  crypto: {
    gradient: "linear-gradient(135deg, #1c0a00 0%, #c2410c 55%, #7c3aed 100%)",
    icon: "₿",
  },
  tech: {
    gradient: "linear-gradient(135deg, #0c1a2e 0%, #0e7490 55%, #1e3a5f 100%)",
    icon: "⚡",
  },
};

export function getCategoryVisual(category: string): CategoryVisual {
  return CATEGORY_VISUALS[category.toLowerCase()] ?? {
    gradient: "linear-gradient(135deg, #0c0f14 0%, #1e293b 55%, #0f172a 100%)",
    icon: "◈",
  };
}
