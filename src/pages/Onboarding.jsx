import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { createOnboardingWorkspace } from "../services/onboarding.service";
import { FIELD_LIMITS } from "../utils/fieldLimits";
import {
  alert,
  card,
  input,
  label,
  muted,
  pageTitle,
  primaryButton,
  sectionTitle,
} from "../utils/styles";
import { logError } from "../utils/logger";

const initialFormData = {
  companyName: "",
  storeName: "",
  street: "",
  streetNumber: "",
  postalCode: "",
  city: "",
  country: "Switzerland",
};

const fieldStack = "flex flex-col gap-1.5";

// Validation errors of the service are readable messages (they are plain
// Errors); Firebase errors carry a code and keep the generic text.
const validationMessage = (err) =>
  err instanceof Error && !err.code ? err.message : null;

export default function Onboarding() {
  const [formData, setFormData] = useState(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const { authUser, refreshProfile } = useAuth();

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((currentData) => ({
      ...currentData,
      [name]: value,
    }));
  }

  const handleSubmit = async (event) => {
    event.preventDefault();

    setIsSubmitting(true);
    setError(null);

    try {
      await createOnboardingWorkspace({
        uid: authUser.uid,
        userName: authUser.displayName,
        ...formData,
      });
      await refreshProfile();
    } catch (err) {
      setError(err);
      logError("Onboarding error -> ", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className={pageTitle}>Onboarding</h1>
        <p className={muted}>Set up your company and first store.</p>
      </header>

      <form className={`${card} flex flex-col gap-6 sm:p-6`} onSubmit={handleSubmit}>
        <fieldset className="flex min-w-0 flex-col gap-4">
          <legend className={`${sectionTitle} mb-1`}>Company data</legend>
          <p className={muted}>The business that owns your stores.</p>

          <div className={fieldStack}>
            <label htmlFor="companyName" className={label}>
              Company name
            </label>
            <input
              id="companyName"
              name="companyName"
              type="text"
              className={input}
              maxLength={FIELD_LIMITS.NAME}
              placeholder="Write name here..."
              value={formData.companyName}
              onChange={handleChange}
              required
            />
          </div>
        </fieldset>

        <hr className="border-neutral-200" />

        <fieldset className="flex min-w-0 flex-col gap-4">
          <legend className={`${sectionTitle} mb-1`}>Store data</legend>
          <p className={muted}>Name and address of your first store.</p>

          <div className={fieldStack}>
            <label htmlFor="storeName" className={label}>
              Store name
            </label>
            <input
              id="storeName"
              name="storeName"
              type="text"
              className={input}
              maxLength={FIELD_LIMITS.NAME}
              placeholder="Write name here..."
              value={formData.storeName}
              onChange={handleChange}
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-6">
            <div className={`${fieldStack} sm:col-span-4`}>
              <label htmlFor="street" className={label}>
                Street
              </label>
              <input
                id="street"
                name="street"
                type="text"
                className={input}
                maxLength={FIELD_LIMITS.ADDRESS_LINE}
                placeholder="Rue du Lyon"
                value={formData.street}
                onChange={handleChange}
                required
              />
            </div>

            <div className={`${fieldStack} sm:col-span-2`}>
              <label htmlFor="streetNumber" className={label}>
                Number
              </label>
              <input
                id="streetNumber"
                name="streetNumber"
                type="text"
                className={input}
                maxLength={FIELD_LIMITS.STREET_NUMBER}
                placeholder="3"
                value={formData.streetNumber}
                onChange={handleChange}
                required
              />
            </div>

            <div className={`${fieldStack} sm:col-span-2`}>
              <label htmlFor="postalCode" className={label}>
                NPA
              </label>
              <input
                id="postalCode"
                name="postalCode"
                type="text"
                className={input}
                maxLength={FIELD_LIMITS.POSTAL_CODE}
                placeholder="1201"
                value={formData.postalCode}
                onChange={handleChange}
                required
              />
            </div>

            <div className={`${fieldStack} sm:col-span-4`}>
              <label htmlFor="city" className={label}>
                City
              </label>
              <input
                id="city"
                name="city"
                type="text"
                className={input}
                maxLength={FIELD_LIMITS.ADDRESS_LINE}
                placeholder="Genève"
                value={formData.city}
                onChange={handleChange}
                required
              />
            </div>

            <div className={`${fieldStack} sm:col-span-6`}>
              <label htmlFor="country" className={label}>
                Country
              </label>
              <input
                id="country"
                name="country"
                type="text"
                className={input}
                maxLength={FIELD_LIMITS.ADDRESS_LINE}
                value={formData.country}
                onChange={handleChange}
                required
              />
            </div>
          </div>
        </fieldset>

        {error && (
          <div role="alert" className={alert}>
            {validationMessage(error) ??
              "Unable to create workspace. Please try again."}
          </div>
        )}

        <div className="flex sm:justify-end">
          <button
            type="submit"
            className={`${primaryButton} min-h-11 w-full gap-2 sm:w-auto sm:px-6`}
            disabled={isSubmitting}
          >
            {isSubmitting && (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            )}
            Create workspace
          </button>
        </div>
      </form>
    </div>
  );
}
