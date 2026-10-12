// Customer form values used by the ticket sidebar.

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

// Customer data as form values: missing fields become empty strings.
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
