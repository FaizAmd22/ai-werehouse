import clsx from "clsx";
import { twMerge } from "tailwind-merge";
import type { ClassValue } from "clsx";

export const cx = (...inputs: ClassValue[]) => {
  return twMerge(clsx(inputs));
};

/**
 * convert hex color to rgba color#ff0000 -> rgba(255, 0, 0, 1)
 */
export const hexToRgba = (hex: string, alpha: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/**
 * Match a path against a pattern and extract parameters.
 *
 * ex: /users/[id] -> /users/123
 */
export const matchPathPattern = (path: string, pattern: string) => {
  const pSegs = path.split("/").filter(Boolean);
  const tSegs = pattern.split("/").filter(Boolean);
  if (pSegs.length !== tSegs.length)
    return { ok: false as const, params: {} as Record<string, string> };

  const params: Record<string, string> = {};
  for (let i = 0; i < pSegs.length; i++) {
    const t = tSegs[i];
    const p = pSegs[i];
    if (t.startsWith("[") && t.endsWith("]")) {
      params[t.slice(1, -1)] = decodeURIComponent(p);
    } else if (t !== p) {
      return { ok: false as const, params: {} };
    }
  }

  return { ok: true as const, params };
};
