"use client";

import { useEffect, useMemo, useState } from "react";

type TypewriterTextProps = {
  text: string;
  className?: string;
  loop?: boolean;
};

const TYPE_SPEED_MS = 85;
const HOLD_MS = 1400;
const RESET_MS = 500;

export function TypewriterText({
  text,
  className,
  loop = true,
}: TypewriterTextProps) {
  const [value, setValue] = useState("");
  const [phase, setPhase] = useState<"typing" | "hold" | "reset">("typing");

  const nextValue = useMemo(
    () => text.slice(0, value.length + 1),
    [text, value.length],
  );

  useEffect(() => {
    if (phase === "typing") {
      if (value === text) {
        if (!loop) return;
        const holdTimer = window.setTimeout(() => setPhase("hold"), HOLD_MS);
        return () => window.clearTimeout(holdTimer);
      }

      const typeTimer = window.setTimeout(
        () => setValue(nextValue),
        TYPE_SPEED_MS,
      );
      return () => window.clearTimeout(typeTimer);
    }

    if (phase === "hold") {
      const resetTimer = window.setTimeout(() => setPhase("reset"), HOLD_MS);
      return () => window.clearTimeout(resetTimer);
    }

    const restartTimer = window.setTimeout(() => {
      setValue("");
      setPhase("typing");
    }, RESET_MS);

    return () => window.clearTimeout(restartTimer);
  }, [nextValue, phase, text, value]);

  const showCursor = loop || value !== text;

  return (
    <span className={className}>
      {value}
      {showCursor ? (
        <span className="ml-1 inline-block h-[0.9em] w-[1px] animate-pulse bg-current align-middle" />
      ) : null}
    </span>
  );
}
