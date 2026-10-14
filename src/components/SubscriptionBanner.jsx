import { Link } from "react-router";
import { TriangleAlert } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { isSubscriptionActive } from "../services/billing.service";
import useSubscription from "../utils/useSubscription";

// Warning shown on every app page while the Company's subscription is not
// active. Hidden while loading and on read errors; it never blocks features.
export default function SubscriptionBanner() {
  const { userProfile } = useAuth();
  const { subscription, loading, error } = useSubscription(userProfile?.companyId);

  if (!userProfile?.companyId || loading || error || isSubscriptionActive(subscription))
    return null;

  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800 sm:px-6 lg:px-8"
    >
      <span className="flex items-center gap-2">
        <TriangleAlert className="size-4 shrink-0" aria-hidden="true" />
        Your subscription is not active.
      </span>
      <Link
        to="/dashboard?section=subscription"
        className="font-medium underline underline-offset-2 hover:text-amber-900"
      >
        Manage subscription
      </Link>
    </div>
  );
}
