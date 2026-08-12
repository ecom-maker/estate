import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatAED(value: number | null | undefined) {
  if (value == null) return "Price on request";
  return new Intl.NumberFormat("en-AE", {
    style: "currency",
    currency: "AED",
    maximumFractionDigits: 0,
  }).format(value);
}

export function maskSecret(value: string | null | undefined) {
  if (!value) return "";
  if (value.length <= 8) return "••••••••";
  return `${value.slice(0, 3)}••••••••••••${value.slice(-4)}`;
}
