// Customer form values used by the ticket sidebar.

/**
 * Blank Customer form. Every field is an empty string, never undefined, so
 * the inputs stay controlled from the first render.
 * @type {object}
 * @example
 * const [form, setForm] = useState(EMPTY_CUSTOMER_FORM);
 */
export const EMPTY_CUSTOMER_FORM = {
  firstName: "",
  lastName: "",
  phone: "",
  address: {
    street: "",
    streetNumber: "",
    postalCode: "",
    city: "",
    country: "",
  },
};

/**
 * Converts a saved Customer into form values: missing or null fields become
 * empty strings, so selecting a Customer fills the form without
 * uncontrolled-input warnings.
 * @param {object} customer
 * @returns {object} Form values shaped like EMPTY_CUSTOMER_FORM.
 * @example
 * customerToForm({ firstName: "Mario", phone: null }); // phone ""
 */
export const customerToForm = (customer) => ({
  firstName: customer.firstName ?? "",
  lastName: customer.lastName ?? "",
  phone: customer.phone ?? "",
  address: {
    ...EMPTY_CUSTOMER_FORM.address,
    ...Object.fromEntries(
      Object.entries(customer.address ?? {}).filter(([, value]) => value),
    ),
  },
});
