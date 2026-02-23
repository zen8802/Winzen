"use client";

import { useRef, useState, useCallback } from "react";

type MannequinViewerProps = {
  gender: "male" | "female";
  headwareColor?: string | null;
  shirtColor?: string | null;
  pantsColor?: string | null;
  shoesColor?: string | null;
  accessoryColor?: string | null;
};

export function MannequinViewer({
  gender,
  headwareColor,
  shirtColor,
  pantsColor,
  shoesColor,
  accessoryColor,
}: MannequinViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [rotation, setRotation] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const lastX = useRef(0);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    setIsDragging(true);
    lastX.current = e.clientX;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return;
      const delta = e.clientX - lastX.current;
      lastX.current = e.clientX;
      setRotation((r) => r + delta);
    },
    [isDragging]
  );

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    setIsDragging(false);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  }, []);

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        ref={containerRef}
        className="relative flex h-[320px] w-full max-w-sm items-center justify-center overflow-hidden rounded-2xl border border-[var(--border)] bg-gradient-to-b from-[var(--surface)] to-[var(--bg)]"
        style={{ perspective: "800px" }}
      >
        <div
          className="flex cursor-grab flex-col items-center justify-end transition-transform active:cursor-grabbing"
          style={{
            transform: `rotateY(${rotation}deg)`,
            transformStyle: "preserve-3d",
            height: "280px",
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          {/* Head + Headware (cap/hat band on top) */}
          <div className="relative mb-1">
            {headwareColor && (
              <div
                className="absolute -top-1 left-1/2 h-4 w-14 -translate-x-1/2 rounded-t-full border-2 border-[var(--border)]"
                style={{ backgroundColor: headwareColor, boxShadow: "0 2px 6px rgba(0,0,0,0.3)" }}
              />
            )}
            <div
              className="h-12 w-10 rounded-full border-2 border-[var(--border)] bg-[var(--surface)]"
              style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.3)" }}
            />
          </div>
          {/* Neck */}
          <div className="mb-0 h-3 w-4 rounded-sm bg-[var(--surface)]" />
          {/* Torso - slightly different for gender, colored when shirt equipped */}
          <div
            className={`mb-1 rounded-lg border-2 ${
              gender === "female" ? "h-16 w-14" : "h-14 w-16"
            }`}
            style={{
              backgroundColor: shirtColor ?? "var(--surface)",
              borderColor: "var(--border)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
            }}
          />
          {/* Arms - left arm shows accessory (watch/bracelet) when equipped */}
          <div className="mb-2 flex gap-8">
            <div
              className="h-3 w-8 rounded-full border-2 border-[var(--border)]"
              style={{
                backgroundColor: accessoryColor ?? "var(--surface)",
                transform: "rotate(-15deg)",
              }}
            />
            <div
              className="h-3 w-8 rounded-full border-2 border-[var(--border)] bg-[var(--surface)]"
              style={{ transform: "rotate(15deg)" }}
            />
          </div>
          {/* Legs (pants) + Feet (shoes) */}
          <div className="flex gap-4">
            <div className="flex flex-col items-center">
              <div
                className="h-14 w-6 rounded-t-lg border-2 border-b-0 border-[var(--border)]"
                style={{
                  backgroundColor: pantsColor ?? "var(--surface)",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                }}
              />
              <div
                className="h-6 w-7 rounded-b-lg border-2 border-t-0 border-[var(--border)]"
                style={{
                  backgroundColor: shoesColor ?? "var(--surface)",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
                }}
              />
            </div>
            <div className="flex flex-col items-center">
              <div
                className="h-14 w-6 rounded-t-lg border-2 border-b-0 border-[var(--border)]"
                style={{
                  backgroundColor: pantsColor ?? "var(--surface)",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                }}
              />
              <div
                className="h-6 w-7 rounded-b-lg border-2 border-t-0 border-[var(--border)]"
                style={{
                  backgroundColor: shoesColor ?? "var(--surface)",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
                }}
              />
            </div>
          </div>
        </div>
      </div>
      <p className="text-xs text-[var(--muted)]">Drag to rotate · 360° view</p>
    </div>
  );
}
