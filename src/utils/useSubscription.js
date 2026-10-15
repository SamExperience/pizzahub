import { useEffect, useState } from "react";
import { subscribeToSubscription } from "../services/billing.service";
import { logError } from "./logger";

// Real-time subscription of a Company: subscription is null when the Company
// never subscribed; loading stays true until the first snapshot or error.
export default function useSubscription(companyId) {
  const [state, setState] = useState({
    companyId: null,
    subscription: null,
    error: null,
  });

  useEffect(() => {
    if (!companyId) return;

    return subscribeToSubscription(
      companyId,
      (subscription) => setState({ companyId, subscription, error: null }),
      (error) => {
        logError("Error loading the subscription -> ", error);
        setState({ companyId, subscription: null, error });
      },
    );
  }, [companyId]);

  // State from a previous Company is never shown for the current one.
  const current = state.companyId === companyId;

  return {
    subscription: current ? state.subscription : null,
    error: current ? state.error : null,
    loading: Boolean(companyId) && !current,
  };
}
