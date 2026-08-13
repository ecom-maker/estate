"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatAED } from "@/lib/utils";

type FavoriteRow = {
  id: string;
  property: {
    id: string;
    slug: string;
    title: string;
    priceAed: number | null;
    bedrooms: number | null;
    community?: { name: string } | null;
  };
};

export function FavoritesList() {
  const [items, setItems] = useState<FavoriteRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/favorites");
      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message ?? "Sign in to view favorites");
        return;
      }
      setItems(json.data.items ?? []);
    })();
  }, []);

  if (error) {
    return (
      <p className="text-sm text-muted">
        {error}.{" "}
        <Link href="/login" className="text-accent hover:underline">
          Sign in
        </Link>
      </p>
    );
  }

  if (!items.length) {
    return <p className="text-sm text-muted">No favorites yet.</p>;
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li
          key={item.id}
          className="rounded-sm border border-border bg-card px-4 py-3"
        >
          <Link
            href={`/properties/${item.property.slug}`}
            className="font-serif text-lg text-primary hover:text-accent"
          >
            {item.property.title}
          </Link>
          <p className="mt-1 text-sm text-muted">
            {item.property.community?.name ?? "Dubai"} ·{" "}
            {formatAED(item.property.priceAed)}
          </p>
        </li>
      ))}
    </ul>
  );
}
