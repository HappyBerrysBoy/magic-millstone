"use client";

import { useEffect, useState } from "react";

function padTwoDigits(value: number): string {
  return String(value).padStart(2, "0");
}

function getNextCutoff(now: Date): { target: Date; label: "12:00" | "00:00" } {
  const year = now.getFullYear();
  const month = now.getMonth();
  const date = now.getDate();

  const todayNoon = new Date(year, month, date, 12, 0, 0, 0);

  if (now < todayNoon) {
    return { target: todayNoon, label: "12:00" };
  }

  const midnight = new Date(year, month, date + 1, 0, 0, 0, 0);
  return { target: midnight, label: "00:00" };
}

export function useCountdownToNoonMidnight(): {
  timeLeft: string;
  targetLabel: "12:00" | "00:00";
} {
  const [timeLeft, setTimeLeft] = useState<string>("00:00:00");
  const [targetLabel, setTargetLabel] = useState<"12:00" | "00:00">("12:00");

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const { target, label } = getNextCutoff(now);
      const diffMs = target.getTime() - now.getTime();

      const totalSeconds = Math.max(0, Math.floor(diffMs / 1000));
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      setTargetLabel(label);
      setTimeLeft(
        `${padTwoDigits(hours)}:${padTwoDigits(minutes)}:${padTwoDigits(seconds)}`,
      );
    };

    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  return { timeLeft, targetLabel };
}



