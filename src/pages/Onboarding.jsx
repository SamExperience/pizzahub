import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { createOnboardingWorkspace } from "../services/onboarding.service";

const initialFormData = {
  companyName: "",
  storeName: "",
  street: "",
  streetNumber: "",
  postalCode: "",
  city: "",
  country: "Switzerland",
};

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
      const { userId, companyId, storeId } = await createOnboardingWorkspace({
        uid: authUser.uid,
        userName: authUser.displayName,
        ...formData,
      });

      console.log("Onboarding success:", {
        userId,
        companyId,
        storeId,
      });
      await refreshProfile();
    } catch (err) {
      setError(err);
      console.error("Onboarding error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <h1>Onboarding</h1>


      <main>
        <form onSubmit={handleSubmit}>
          <fieldset>
            <legend>Company data</legend>

            <div>
              <label htmlFor="companyName">Company name</label>
              <br />
              <input
                id="companyName"
                name="companyName"
                type="text"
                placeholder="Write name here..."
                value={formData.companyName}
                onChange={handleChange}
                required
              />
            </div>
          </fieldset>

          <fieldset>
            <legend>Store data</legend>

            <div>
              <label htmlFor="storeName">Store name</label>
              <br />
              <input
                id="storeName"
                name="storeName"
                type="text"
                placeholder="Write name here..."
                value={formData.storeName}
                onChange={handleChange}
                required
              />
            </div>

            <div>
              <label htmlFor="street">Street</label>
              <br />
              <input
                id="street"
                name="street"
                type="text"
                placeholder="Rue du Lyon"
                value={formData.street}
                onChange={handleChange}
                required
              />

              <br />

              <label htmlFor="streetNumber">Number</label>
              <br />
              <input
                id="streetNumber"
                name="streetNumber"
                type="text"
                placeholder="3"
                value={formData.streetNumber}
                onChange={handleChange}
                required
              />

              <br />

              <label htmlFor="postalCode">NPA</label>
              <br />
              <input
                id="postalCode"
                name="postalCode"
                type="text"
                placeholder="1201"
                value={formData.postalCode}
                onChange={handleChange}
                required
              />

              <br />

              <label htmlFor="city">City</label>
              <br />
              <input
                id="city"
                name="city"
                type="text"
                placeholder="Genève"
                value={formData.city}
                onChange={handleChange}
                required
              />

              <br />

              <label htmlFor="country">Country</label>
              <br />
              <input
                id="country"
                name="country"
                type="text"
                value={formData.country}
                onChange={handleChange}
                required
              />
            </div>
          </fieldset>

          <button type="submit" disabled={isSubmitting}>
            Create workspace
          </button>
          {error && <p>Unable to create workspace. Please try again.</p>}
        </form>
      </main>
    </div>
  );
}
