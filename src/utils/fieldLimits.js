// Single source of the maximum lengths of user-entered fields.
//
// NAME: company, store, menu, category, product, customer first/last name and
//   user displayName.
// ADDRESS_LINE: street, city and country.
// LIST_ITEM: ingredient, size name, cooking level and customization.
// LIST_SIZE: maximum number of elements of a list and of Order items.
//
// The same numbers are repeated in firestore.rules, which must be kept in sync.
// The rules do not check the length of single list elements.
export const FIELD_LIMITS = {
  NAME: 100,
  ADDRESS_LINE: 100,
  STREET_NUMBER: 20,
  POSTAL_CODE: 20,
  PHONE: 30,
  DESCRIPTION: 500,
  LIST_ITEM: 100,
  LIST_SIZE: 50,
};
