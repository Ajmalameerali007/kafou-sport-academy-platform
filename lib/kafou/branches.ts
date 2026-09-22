"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/platform/client";
import type { BranchPreference } from "@/lib/platform/contracts";
export function useBranchPreferences() {
  const [branches, setBranches] = useState<BranchPreference[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    void api<BranchPreference[]>("branches").then((r) => {
      if (!live) return;
      if (r.ok) setBranches(r.data);
      else setError(r.message);
    });
    return () => {
      live = false;
    };
  }, []);
  return { branches, error };
}
