import { ArrowRight, MapPin, Store } from "lucide-react";
import { muted, primaryButton, sectionTitle } from "../utils/styles";

export default function StoreCard({ store, onSelect }) {
  const { name, address, imageUrl } = store;

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
      <div className="aspect-[16/9] w-full bg-brand-50">
        {imageUrl ? (
          <img src={imageUrl} alt={name} className="h-full w-full object-cover" />
        ) : (
          <div
            data-testid="store-card-placeholder"
            className="flex h-full w-full items-center justify-center text-brand-600"
          >
            <Store className="size-16" aria-hidden="true" />
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="flex flex-col gap-2">
          <h2 className={sectionTitle}>{name}</h2>
          {address && (
            <p className={`${muted} flex items-start gap-2`}>
              <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span className="flex flex-col">
                <span>
                  {address.street} {address.streetNumber}
                </span>
                <span>
                  {address.postalCode} {address.city}, {address.country}
                </span>
              </span>
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() => onSelect?.(store)}
          className={`${primaryButton} mt-auto min-h-11 w-full gap-2`}
        >
          Go to store
          <ArrowRight className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
