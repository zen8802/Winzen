"use client";

import { useEffect, useRef, useState } from "react";

interface RewardRevealProps {
  amount: number;
  label?: string;
  delay?: number; // ms before animation starts
  onDone?: () => void;
}

export function RewardReveal({ amount, label, delay = 600, onDone }: RewardRevealProps) {
  const [count, setCount] = useState(0);
  const [visible, setVisible] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const startTimeout = setTimeout(() => {
      setVisible(true);
      const duration = 800;
      const steps = 30;
      const increment = amount / steps;
      let current = 0;
      let step = 0;

      intervalRef.current = setInterval(() => {
        step++;
        current = Math.min(Math.round(increment * step), amount);
        setCount(current);
        if (current >= amount) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          onDone?.();
        }
      }, duration / steps);
    }, delay);

    return () => {
      clearTimeout(startTimeout);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [amount, delay, onDone]);

  if (!visible) return null;

  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border border-yellow-400/40 bg-yellow-400/10 px-3 py-1 text-sm font-semibold text-yellow-300 animate-pulse">
      <span className="text-yellow-400">+</span>
      <span className="font-mono">{count.toLocaleString()}</span>
      <span>{label ?? "coins"}</span>
    </div>
  );
}
