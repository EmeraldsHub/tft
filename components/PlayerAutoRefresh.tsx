"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

type Props = {
  shouldRefresh: boolean;
  delayMs?: number;
};

export function PlayerAutoRefresh({ shouldRefresh, delayMs = 8000 }: Props) {
  const router = useRouter();

  useEffect(() => {
    if (!shouldRefresh) {
      return;
    }
    const timer = window.setTimeout(() => {
      router.refresh();
    }, delayMs);
    return () => window.clearTimeout(timer);
  }, [shouldRefresh, delayMs, router]);

  return null;
}
