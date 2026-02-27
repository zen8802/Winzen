"use client";

import { useState } from "react";
import { getCategoryVisual } from "@/lib/category-images";

interface MarketImageProps {
  imageUrl?: string | null;
  category: string;
  alt?: string;
  /**
   * "compact" – full-width strip, 3:1 aspect ratio (homepage cards)
   * "thumb"   – small fixed square, inline next to title (list / detail pages)
   */
  variant?: "compact" | "thumb";
}

export function MarketImage({ imageUrl, category, alt, variant = "compact" }: MarketImageProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const visual = getCategoryVisual(category);
  const showFallback = !imageUrl || imgFailed;

  // ─── Thumb variant ────────────────────────────────────────────────────────
  if (variant === "thumb") {
    return (
      <div
        className="relative shrink-0 overflow-hidden rounded-lg"
        style={{ width: 56, height: 56 }}
      >
        {imageUrl && !imgFailed && (
          <img
            src={imageUrl}
            alt={alt ?? ""}
            loading="lazy"
            onError={() => setImgFailed(true)}
            className="h-full w-full object-cover"
          />
        )}
        {showFallback && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: visual.gradient }}
          >
            <span style={{ fontSize: 22, opacity: 0.5, userSelect: "none", lineHeight: 1 }}>
              {visual.icon}
            </span>
          </div>
        )}
      </div>
    );
  }

  // ─── Compact banner variant (default) ────────────────────────────────────
  return (
    <div className="relative w-full overflow-hidden" style={{ aspectRatio: "3/1" }}>
      {imageUrl && !imgFailed && (
        <img
          src={imageUrl}
          alt={alt ?? ""}
          loading="lazy"
          onError={() => setImgFailed(true)}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      )}
      {showFallback && (
        <div
          className="absolute inset-0 flex items-center justify-center transition-transform duration-500 group-hover:scale-105"
          style={{ background: visual.gradient }}
        >
          <span style={{ fontSize: 40, opacity: 0.28, userSelect: "none", lineHeight: 1 }}>
            {visual.icon}
          </span>
        </div>
      )}
      {/* Bottom fade overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "linear-gradient(to bottom, transparent 20%, rgba(0,0,0,0.50) 100%)" }}
      />
    </div>
  );
}
