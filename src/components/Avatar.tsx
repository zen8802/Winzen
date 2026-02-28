"use client";

import { memo, useMemo } from "react";
import {
  LAYER_ORDER,
  SIZE_MAP,
  baseUrl,
  type AvatarCategory,
  type AvatarEquipped,
  type AvatarSize,
} from "@/lib/avatar";

type AvatarProps = {
  equipped?:     AvatarEquipped;
  size?:         AvatarSize;
  animate?:      boolean;
  /** Override the base image URL. Defaults to baseUrl() from avatar lib. */
  baseImageUrl?: string;
};

// Render order derived from LAYER_ORDER (everything except "base" sentinel)
const ITEM_LAYERS = LAYER_ORDER.filter((l): l is AvatarCategory => l !== "base");

export const Avatar = memo(function Avatar({
  equipped    = {},
  size        = "lg",
  animate     = true,
  baseImageUrl,
}: AvatarProps) {
  const { w, h } = SIZE_MAP[size];
  const base     = baseImageUrl ?? baseUrl();

  // Compute ordered list of [layer, url] pairs — only recalc when equipped changes
  const visibleLayers = useMemo(
    () =>
      ITEM_LAYERS
        .map((layer) => ({ layer, url: equipped[layer] }))
        .filter((e): e is { layer: AvatarCategory; url: string } => !!e.url),
    [equipped],
  );

  return (
    <div
      className={animate ? "avatar-idle" : undefined}
      style={{ position: "relative", width: w, height: h, flexShrink: 0 }}
      aria-hidden="true"
    >
      {/* Base body — always rendered */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={base}
        alt=""
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }}
        draggable={false}
      />

      {/* Equipped item layers stacked in z-order */}
      {visibleLayers.map(({ layer, url }) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={layer}
          src={url}
          alt=""
          className={layer === "eyes" ? "avatar-blink" : undefined}
          style={{
            position:      "absolute",
            inset:         0,
            width:         "100%",
            height:        "100%",
            objectFit:     "contain",
            pointerEvents: "none",
          }}
          draggable={false}
        />
      ))}
    </div>
  );
});
