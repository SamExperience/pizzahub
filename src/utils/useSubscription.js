import { useEffect, useState } from "react";
import { subscribeToSubscription } from "../services/billing.service";
import { logError } from "./logger";

// Real-time subscription of a Company: subscription is null when the Company
// never subscribed; loading stays true until the first snapshot or error;
// retry() starts a new listener.
export default function useSubscription(companyId) {
  // Bumped to restart the listener after an error.
  const [retryKey, setRetryKey] = useState(0);
  const [state, setState] = useState({
    key: null,
    subscription: null,
    error: null,
  });
  // One key per Company and attempt: a result belongs to one listener only.
  const key = `${companyId}:${retryKey}`;

  useEffect(() => {
    if (!companyId) return;

    return subscribeToSubscription(
      companyId,
      (subscription) => setState({ key, subscription, error: null }),
      (error) => {
        logError("Error loading the subscription -> ", error);
        setState({ key, subscription: null, error });
      },
    );
  }, [companyId, key]);

  // State from a previous Company or attempt is never shown for the current one.
  const current = state.key === key;

  return {
    subscription: current ? state.subscription : null,
    error: current ? state.error : null,
    loading: Boolean(companyId) && !current,
    retry: () => setRetryKey((value) => value + 1),
  };
}
