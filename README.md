# PizzaHub

PizzaHub is a web application for pizzeria staff. It lets a team register, set up its Company and Store, select the Store to work on and manage that Store's Menu, create, edit and cancel tickets (orders), move them through their statuses and follow the Store's orders of the day in real time on the Tableau. The project is an MVP under active development; this document describes only what is implemented today.

## Implemented features

### Authentication

- Registration and login with email and password.
- Sign-in with Google.
- Logout and persistent sessions across page reloads.
- Automatic redirects: a new user is sent to Onboarding, an existing user to Store Selection.
- Protected routes: every application page requires an authenticated user.

### Onboarding

- Company and Store creation form with required-field validation.
- Optional Store image upload (Firebase Storage).
- The first User is created with the `admin` role and linked to the Company and Store through the Firebase UID.

### Store Selection

- Lists the Stores the User can access.
- The selected Store becomes the active Store and is persisted across page reloads (`localStorage`).
- After selection, the User is sent to the Menu if it is not ready yet, otherwise to the Tableau.

### Menu management

- Categories: create, edit, delete (deleting a Category also deletes its Products) and reorder.
- Products: create, edit, delete and reorder within a Category.
- Product fields: name (unique within its Category), description, single price or prices per size, ingredients, cooking levels, availability and position.
- Availability toggle directly from the product list.
- Product image upload, replacement and deletion.
- Menu readiness guard: until the Menu has at least one Category containing at least one valid Product, only `/menu` is reachable, including via direct URL.

### Tableau (real-time orders)

- Three status columns: Pending, In progress, Completed.
- Real-time listener on the active Store's orders of the current day (device time zone). It is renewed when the active Store changes and at midnight. Cancelled Orders are not shown.
- Column ordering: Pending and In progress by scheduled time (earliest first); Completed by completion time (latest first), with Orders that have no completion time last. Editing a ticket never changes its position.
- Loading, empty and error states (with a retry action) and a responsive layout.
- Ticket card: order type (Takeaway or Delivery), scheduled time, items (quantity, size, cooking level, customizations, subtotal), customer info (phone and address for delivery), total and status.
- Each card reads its Customer in real time, so a customer change saved from any ticket updates every card of that Customer.
- Card actions: status arrows, **Edit** and **Cancel** (see Ticket management).
- The **Create Ticket** button opens the ticket creation sidebar (see below).

### Ticket creation

- Right sidebar opened from **Create Ticket**, with close and cancel actions.
- Order type (Takeaway or Delivery) and scheduled time: a time of day on the current date, defaulting to 30 minutes from now.
- Customer search by first name among the Company's Customers (case-insensitive, matches any part of the name) with dynamic results. Selecting a Customer fills in its data; otherwise a new Customer is entered.
- Customer validation by order type: Takeaway requires the first name; Delivery also requires phone, street, street number, postal code and city (country is optional). An existing Customer is updated only when its fields were changed.
- **Add product** opens a left panel with a category sidebar and product cards; unavailable products are shown but cannot be selected.
- Item configuration step: size, cooking level, free-text customizations and quantity, then **Add to ticket**.
- Ticket summary: change the quantity or remove an item; the total is calculated automatically.
- Validation with inline errors, a saving state and error handling. On success the sidebar closes and the ticket appears in the Pending column.
- The Customer and the Order are written atomically in a single batch. The Order stores item snapshots, the Customer reference, the order type, the scheduled time and the Pending status.

### Ticket management

- **Status changes** with back and forward arrows on the card: Pending can only move forward, In progress both ways, Completed only back. The card shows a saving state and an error message if the change fails. The completion time is recorded when a ticket moves to Completed and cleared when it moves back.
- **Cancel** asks for confirmation and sets the status to Cancelled (soft delete). A cancelled ticket is final: it disappears from the Tableau, is kept in Firestore and can no longer be edited.
- **Edit** reopens the ticket sidebar prefilled with the Order, in any status. Customer, order type, scheduled time and items can be changed; the Customer and the Order are saved in a single batch and the total is recalculated. Store, status and creation time are not changed by an edit. Concurrent edits follow a last-write-wins rule.
- Items in the summary can be reconfigured by reopening the item configuration step:
  - Product still on sale (exists and is available): full edit. The saved unit price is kept unless the size changes, in which case the current menu price applies.
  - Product no longer on sale (unavailable or deleted): only customizations and a lower quantity can be changed; size, cooking level and price are locked, and **+** in the summary cannot exceed the quantity saved in the ticket.
- Items always keep their snapshot: deleting a Product from the Menu never removes it from existing tickets. **Add product** still shows unavailable products as disabled.

### Other pages

- **Dashboard** exists as a route with placeholder content only.

### Security

- Firestore and Storage security rules restrict access to authenticated Users and isolate data per Company and Store.
- Users can read, create and update the Orders of their Store. An update is either a status change (with the matching completion time) or a content edit (customer, order type, scheduled time, items, total); Store and creation time are immutable, cancelled Orders cannot be updated and Orders can never be deleted.
- Users can read, create and update the Customers of their Company.
- Written Orders and Customers are checked for allowed and required fields.

## Tech stack

- [React](https://react.dev/) 19 and [Vite](https://vite.dev/) 8
- [React Router](https://reactrouter.com/) 8
- [Firebase](https://firebase.google.com/) 12: Authentication, Cloud Firestore, Cloud Storage
- [Tailwind CSS](https://tailwindcss.com/) v4 (Vite plugin)
- [Vitest](https://vitest.dev/) and Testing Library
- [Oxlint](https://oxc.rs/)

## Getting started

### Prerequisites

- Node.js 24 (see `.nvmrc`)
- Java 21 or later, required by the Firebase Emulator Suite

### Setup

```bash
npm install
cp .env.example .env
```

Fill in the `VITE_FIREBASE_*` values in `.env` with your Firebase project configuration.

### Run locally

In development mode the app always connects to the local Firebase emulators (Auth on port 9099, Firestore on 8080, Storage on 9199). Start them first, then the dev server in a second terminal:

```bash
npm run emulator
npm run dev
```

The Emulator Suite UI is enabled and its address is printed when the emulators start.

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start the Vite development server. |
| `npm run build` | Build the production bundle into `dist/`. |
| `npm run preview` | Serve the production build locally. |
| `npm run lint` | Run Oxlint. |
| `npm test` | Run the Vitest suite (requires the emulators). |
| `npm run emulator` | Start the Firebase emulators. |

Tests run against the emulators using the configuration in `.env.test`. To start the emulators, run the suite once and stop them, use the same command as CI:

```bash
npx firebase-tools emulators:exec --only auth,firestore,storage "npm test -- --run"
```

## Project structure

```text
src/
  pages/        Route-level pages (Login, Onboarding, StoreSelection, Menu, Tableau, Dashboard)
  components/   Reusable UI components (layout, route guards, category and product UI, Tableau board and ticket cards, ticket sidebar for creation and editing, customer section, menu panel, item configuration and ticket summary)
  contexts/     React contexts for auth state and the active Store
  services/     Firebase data layer, one service per entity; components never call Firebase directly
  utils/        Shared helpers
  routes.jsx    Route definitions
tests/          Unit, UI and security-rules tests
firestore.rules Firestore security rules
firestore.indexes.json Firestore composite indexes (orders of the day)
storage.rules   Storage security rules
firebase.json   Firebase Hosting, rules and emulator configuration
```

## Continuous integration and releases

- **CI** (`.github/workflows/ci.yml`) runs on pull requests to `develop` and `main`: workflow linting, `npm run lint`, the test suite against the emulators and `npm run build`.
- **Release** (`.github/workflows/release.yml`) runs on `vX.Y.Z` tags pushed on `main` and creates a GitHub release with generated notes.
