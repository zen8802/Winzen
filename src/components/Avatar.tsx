"use client";

import {
  LAYER_ORDER,
  SIZE_MAP,
  baseUrl,
  type AvatarCategory,
  type AvatarEquipped,
  type AvatarSize,
} from "@/lib/avatar";

type AvatarProps = {
  equipped?: AvatarEquipped;
  size?:     AvatarSize;
  animate?:  boolean;
};

export function Avatar({ equipped = {}, size = "lg", animate = true }: AvatarProps) {
  const { w, h } = SIZE_MAP[size];

  return (
    <div
      className={animate ? "avatar-idle" : undefined}
      style={{ position: "relative", width: w, height: h, flexShrink: 0 }}
      aria-hidden="true"
    >
      {/* Base body */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={baseUrl()}
        alt=""
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }}
        draggable={false}
      />

      {/* Equipped item layers rendered in z-order (accessory_back first, accessory_front last) */}
      {LAYER_ORDER.filter((l): l is AvatarCategory => l !== "base").map((layer) => {
        const url = equipped[layer];
        if (!url) return null;
        return (
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
        );
      })}
    </div>
  );
}
