import { FavoritesList } from "@/components/property/favorites-list";

export const metadata = { title: "Favorites" };

export default function FavoritesPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-28 md:px-10">
      <p className="text-xs font-medium uppercase tracking-[0.25em] text-accent">
        Saved
      </p>
      <h1 className="mt-3 font-serif text-4xl text-primary">Favorites</h1>
      <div className="mt-8">
        <FavoritesList />
      </div>
    </div>
  );
}
