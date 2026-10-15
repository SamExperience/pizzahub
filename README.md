# PizzaHub

PizzaHub is a web application for pizzeria staff. It lets a team register (and reset a forgotten password), set up its Company and Store, select the Store to work on and manage that Store's Menu, create, edit and cancel tickets (orders), preview a ticket receipt, move tickets through their statuses, follow the Store's orders of the day in real time on the Tableau, browse the Store's order history by day on the Dashboard and subscribe to a demo plan through Stripe Checkout in test mode. The interface is responsive and usable on desktop, tablet and mobile.

PizzaHub is an MVP (V1); this document describes only what is implemented. The app is live at [pizzahub-11284.web.app](https://pizzahub-11284.web.app).

## Implemented features

### User interface

- Responsive, mobile-first layout built with Tailwind CSS utility classes; light theme with a tomato-red brand color on neutral greys. Order statuses keep distinct colors: Pending amber, In progress blue, Completed green.
- App shell: a header with the brand, the navigation to Tableau, Menu and Dashboard (active page highlighted), the active Store name, the signed-in User and logout. On small screens the navigation, Store and User move into a collapsible menu. Onboarding and Store Selection use a minimal header without navigation.
- Consistent loading, empty and error states and a shared confirmation dialog across all pages; visible focus states and accessible labels on icon-only buttons. Icons come from lucide-react.
- Read errors show a message with a **Retry** action instead of redirecting to the wrong page (User profile, Menu readiness, subscription status, order history, Customers); Firebase errors are shown as generic, readable messages.
- Touch-friendly controls: buttons, inputs, navigation links and ticket controls are at least 44 px tall.

### Authentication

- Centered sign-in card with a toggle between login and registration; authentication errors are shown in an alert.
- Registration and login with email and password.
- Sign-in with Google.
- Password reset: **Forgot password?** on the sign-in form sends the Firebase password reset email to the typed address; Firebase hosts the page where the new password is set. The confirmation message is the same whether or not an account exists, so it does not reveal registered emails. Google accounts recover access through Google.
- Logout and persistent sessions across page reloads.
- Automatic redirects: a new user is sent to Onboarding, an existing user to Store Selection.
- Protected routes: every application page requires an authenticated user.

### Onboarding

- Company and Store creation form, split into Company and Store sections, with required-field validation.
- The first User is created with the `admin` role and linked to the Company and Store through the Firebase UID.

### Store Selection

- Lists the Stores the User can access as a responsive grid of Store cards, with an empty state when there are none. A card shows the Store image when one is set, otherwise a placeholder icon (Store images cannot be uploaded from the app).
- The selected Store becomes the active Store and is persisted across page reloads (`localStorage`).
- After selection, the User is sent to the Menu if it is not ready yet, otherwise to the Tableau.

### Menu management

- Categories: create, edit, delete (deleting a Category also deletes its Products) and reorder. The category sidebar starts with the add-category form; on small screens the categories become a horizontal, scrollable selector above the products. Each category card shows its name (up to two lines) and a product count badge (capped at 99+); the selected card shows its actions.
- Menu actions run one at a time and show a saving state; other actions are disabled until the current one finishes.
- Products: create, edit, delete and reorder within a Category.
- Product fields: name (unique within its Category), description, single price or prices per size, ingredients, cooking levels, availability and position.
- Compact product rows that expand in place: the collapsed row shows an ingredient preview, a price summary and an availability switch; the expanded row shows the price per size, the cooking levels and the edit and delete actions.
- Product image upload, replacement and deletion. Images are resized in the browser before upload (longest side at most 800 px) and compressed to WebP, or JPEG when the browser cannot encode WebP, under 150 KB; browsers cache them for one day.
- Menu readiness guard: until the Menu has at least one Category containing at least one valid Product, only `/menu` is reachable, including via direct URL.

### Tableau (real-time orders)

- Three status columns: Pending, In progress, Completed.
- Real-time listener on the active Store's orders of the current day (device time zone). It is renewed when the active Store changes and at midnight. Cancelled Orders are not shown.
- Column ordering: Pending and In progress by scheduled time (earliest first); Completed by completion time (latest first), with Orders that have no completion time last. Editing a ticket never changes its position.
- Each column shows its ticket count. On large screens the board fills the page height and every column scrolls on its own; on tablets the columns scroll horizontally; on phones one column is shown at a time through tabs.
- Loading, empty and error states (with a retry action).
- Compact ticket cards that expand in place. A card shows order type (Takeaway or Delivery), scheduled time, items (quantity, size, cooking level, customizations, subtotal), customer info (phone and address for delivery), total and status.
- Each card reads its Customer in real time, so a customer change saved from any ticket updates every card of that Customer.
- Card actions: a labelled status action (**Start**, **Complete**, **Reopen**; the backward move is labelled **Back**), a printer icon that opens the print preview (see Ticket print preview) and a **More actions** menu with **Edit** and **Cancel** (see Ticket management).
- The **Create Ticket** button opens the ticket creation sidebar (see below); on phones it is a floating button.

### Ticket creation

- Right sidebar opened from **Create Ticket**, with close and cancel actions. It is full screen on phones and uses two columns (customer details and ticket summary) on large screens.
- Order type (Takeaway or Delivery) and scheduled time, on one row: a time of day on the current date, defaulting to 30 minutes from now (capped at 23:59 late in the evening, so the default never falls on the next day).
- Customer search by first name among the Company's Customers (case-insensitive, matches any part of the name) with dynamic results. Selecting a Customer shows it as a card with an **Edit details** action (the form opens automatically while a required field is missing); otherwise a new Customer is entered.
- Customer validation by order type: Takeaway requires the first name; Delivery also requires phone, street, street number, postal code and city (country is optional). An existing Customer is updated only when its fields were changed.
- **Add product**, in the ticket summary header, opens a left panel with a category sidebar and product cards; unavailable products are shown but cannot be selected. A **Done · N items · total** footer closes the panel.
- Item configuration step: size, cooking level, free-text customizations and quantity, then **Add to ticket**. A customization still being typed is added when the field loses focus or when the item is saved.
- Ticket summary: compact item rows to change the quantity or remove an item; the total is calculated automatically and shown in the sidebar footer.
- Validation with inline errors, a saving state and error handling. On success the sidebar closes and the ticket appears in the Pending column.
- Closing the sidebar (close button, **Cancel**, Escape or the backdrop) asks for confirmation only when the ticket form has unsaved changes.
- The Customer and the Order are written atomically in a single batch. The Order stores item snapshots, the Customer reference, the order type, the scheduled time and the Pending status.

### Ticket management

- **Status changes** from the card: Pending can only move forward (**Start**), In progress both ways (**Complete** or back to Pending), Completed only back (**Reopen**). The card shows a saving state and an error message if the change fails. The completion time is recorded when a ticket moves to Completed and cleared when it moves back.
- **Cancel** asks for confirmation and sets the status to Cancelled (soft delete). A cancelled ticket is final: it disappears from the Tableau, is kept in Firestore and can no longer be edited.
- **Edit** reopens the ticket sidebar prefilled with the Order, in any status. Customer, order type, scheduled time and items can be changed; the Customer and the Order are saved in a single batch and the total is recalculated. Store, status and creation time are not changed by an edit. Concurrent edits follow a last-write-wins rule.
- Items in the summary can be reconfigured by reopening the item configuration step. The step shows the item as saved ("Before"), an inline size selector with the saved size marked, a note explaining which price applies, and the old and new line total:
  - Product still on sale (exists and is available): full edit. The saved unit price is kept unless the size changes, in which case the current menu price applies.
  - Product unavailable but still in the Menu: customizations, cooking level and a lower quantity can be changed; size and price are locked.
  - Product deleted from the Menu: only customizations and a lower quantity can be changed; size, cooking level and price are locked.
  - In both cases **+** in the summary cannot exceed the quantity saved in the ticket.
- Items always keep their snapshot: deleting a Product from the Menu never removes it from existing tickets. **Add product** still shows unavailable products as disabled.

### Ticket print preview

- The printer icon on every Tableau ticket card opens a print preview: a plain-text receipt formatted for a 58 mm thermal printer (32 characters per line) with the Store, date and time, order type, customer (phone and address for delivery), items with options and customizations, right-aligned prices and the total.
- No printer is connected: **Print** closes the preview, like **Close**, Escape or the backdrop.
- A **Print on save** switch in the ticket sidebar footer (on by default, remembered per device in `localStorage`) opens the preview after a new ticket is saved. Edits never open it automatically; the receipt can be reopened from the card.

### Dashboard (order history)

- Section sidebar with one item, **Order history**; on small screens it becomes a selector above the content. The selected section is local state, not a separate route.
- A day field (default today, future days not allowed) shows the active Store's Orders created on that day (device time zone), newest first. The Orders are read once when the page opens or the day changes; the history is not updated in real time.
- Each row shows the creation time, the customer name, the order type, the status and the total. Cancelled Orders are included, greyed out, with their status badge.
- Clicking a row expands a read-only detail in place (one row at a time): the stored item snapshots (quantity, size, cooking level, customizations, subtotal), the customer name, phone and, for delivery, address, the created, scheduled and completed times and the total.
- The Company's Customers are read once, not on every day change. Loading, empty and error states (with a retry action).

### Subscription (Stripe test mode)

- Stripe runs in **test mode only**: the Cloud Functions refuse any Stripe secret key that does not start with `sk_test_`, so no real payment is possible. No Stripe key is ever shipped to the client.
- One demo plan: a single monthly Stripe Price, paid through Stripe Checkout in subscription mode.
- The Dashboard sidebar has a **Subscription** section (also reachable at `/dashboard?section=subscription`). It shows the current status (Active, Past due, Canceled, Incomplete, …), the renewal date of an active subscription and a **Subscribe** button that redirects to Stripe Checkout. Back from Checkout, a "payment being processed" message is shown until the webhook writes the final status; the section updates in real time.
- While the Company's subscription is not active, a warning banner with a **Manage subscription** link is shown under the header on every app page (once the Menu is ready). It is hidden while loading or on read errors and never blocks any feature.
- The subscription status of each Company is stored in `subscriptions/{companyId}` (status, Stripe customer and subscription ids, price, current period end, cancel at period end, last event time).
- Backend: two Firebase Cloud Functions (v2, Node.js 22, region `europe-west6`), the only server-side code of the project:
  - `createCheckoutSession` (callable): requires a signed-in User with the `admin` role, takes the Company from the User profile (never from the request) and refuses when the subscription is already active. On the first **Subscribe** it creates the Company's Stripe Customer and stores its id in `subscriptions/{companyId}`; later it reuses it. Before opening a new Checkout it lists that Customer's active Stripe subscriptions: if one exists, it syncs the document (the one with the latest period end wins) and refuses, so a Company cannot pay twice. Otherwise it returns the Checkout URL; success and cancel URLs point to the Dashboard of `APP_URL`.
  - `stripeWebhook` (HTTP): verifies the Stripe signature on the raw request body (missing or invalid signature: `400`), handles `checkout.session.completed` and `customer.subscription.created`, `updated` and `deleted`, ignores events older than the last one applied (Stripe does not guarantee ordering) and events of a subscription other than the stored active one, and acknowledges any other event type with `200`.
  - The webhook and the Checkout sync map a Stripe subscription to the same document fields (`functions/subscription.js`).

### Security

- Firestore and Storage security rules restrict access to authenticated Users and isolate data per Company and Store; access across Companies and Stores is denied.
- Each Company has one User, created during Onboarding with the `admin` role. Dedicated rules allow a signed-in User to create only their own Company, Store and User profile, together, and never to change them afterwards: a User cannot edit their own Company, Store or role.
- Writes to business data (Menu, Categories, Products, product images, Customers, Orders) require the `admin` role.
- Every written document is checked for allowed fields, required fields on creation, value types and length limits. Updates cannot remove required fields or change immutable ones (such as Company, Store and creation time).
- Products have either a single price or prices per size, never both.
- Users can read, create and update the Orders of their Store. An Order has 1 to 50 items. An update is either a status change (with the matching completion time) or a content edit (customer, order type, scheduled time, items, total); cancelled Orders cannot be updated and Orders can never be deleted.
- Users can read, create and update the Customers of their Company. A Delivery Order requires a Customer with a non-blank phone, street, street number, postal code and city.
- Product images must be WebP or JPEG files smaller than 150 KB.
- `subscriptions/{companyId}` can be read only by the Users of that Company and can never be written by clients: only the Cloud Functions (Admin SDK) write it.

### Data validation

- Maximum field lengths (names, address parts, phone, description, list elements) and the 50-element cap on lists and Order items are defined once in `src/utils/fieldLimits.js` and repeated in the Firestore rules.
- Forms limit their inputs to these lengths and stop adding list elements and items at the cap.
- Services validate the same limits and the required fields before writing, so invalid data is rejected with a clear error before it reaches Firestore.

## Tech stack

- [React](https://react.dev/) 19 and [Vite](https://vite.dev/) 8
- [React Router](https://reactrouter.com/) 8
- [Firebase](https://firebase.google.com/) 12: Authentication, Cloud Firestore, Cloud Storage
- [Cloud Functions for Firebase](https://firebase.google.com/docs/functions) v2 (firebase-functions 7, firebase-admin 14) on Node.js 22
- [Stripe](https://docs.stripe.com/) Node.js SDK 23 (test mode, Stripe Checkout)
- [Tailwind CSS](https://tailwindcss.com/) v4 (Vite plugin)
- [Lucide](https://lucide.dev/) icons (lucide-react)
- [Vitest](https://vitest.dev/) and Testing Library
- [Oxlint](https://oxc.rs/)
- [concurrently](https://github.com/open-cli-tools/concurrently) to run the emulators and the Stripe listener together
- [JSDoc](https://jsdoc.app/) to generate the code reference from the source comments
- [Firebase Hosting](https://firebase.google.com/docs/hosting) for the production client

## Getting started

### Prerequisites

- Node.js 24 (see `.nvmrc`)
- Java 21 or later, required by the Firebase Emulator Suite
- For the subscription: a Stripe account in test mode (or a Stripe sandbox) with one recurring monthly Price, and the [Stripe CLI](https://docs.stripe.com/stripe-cli) to forward webhooks locally. The Cloud Functions target the Node.js 22 runtime.

### Setup

```bash
npm install
cp .env.example .env
```

Fill in the `VITE_FIREBASE_*` values in `.env` with your Firebase project configuration.

Install the Cloud Functions dependencies and create their local configuration (both files are git-ignored):

```bash
npm install --prefix functions
```

`functions/.env.local` holds the non-secret params:

```dotenv
STRIPE_PRICE_ID=price_...
APP_URL=http://localhost:5173
```

`functions/.secret.local` holds the secrets used by the emulator:

```dotenv
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

Outside the emulator, `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are read from Google Secret Manager, and `STRIPE_PRICE_ID` and `APP_URL` from `functions/.env.<projectId>` (see Deployment).

The default Firebase project is set in `.firebaserc`; the emulators, the Stripe listener URL and the deploy scripts use it.

### Run locally

In development mode the app always connects to the local Firebase emulators (Auth on port 9099, Firestore on 8080, Storage on 9199, Functions on 5001). Start them first, then the dev server in a second terminal:

```bash
npm run emulator
npm run dev
```

The Emulator Suite UI is enabled and its address is printed when the emulators start.

`npm run emulator` imports the local emulator data from `emulator-data/`, which is git-ignored and must exist: on a fresh clone create the empty folder first (`mkdir emulator-data`) and the emulators start without data. Run `npm run emulator:export` while the emulators are running to save the current data there. The test suite clears the emulator data.

### Stripe webhooks locally

`npm run emulator` also starts the Stripe CLI (`npm run stripe:listen`), which forwards the four Stripe events handled by the webhook (`checkout.session.completed`, `customer.subscription.created`, `updated`, `deleted`) to the `stripeWebhook` function on the Functions emulator (`127.0.0.1:5001`, project `pizzahub-11284`). Sign in to the Stripe CLI first (`stripe login`).

On first use, copy the `whsec_...` signing secret printed by `stripe listen` into `STRIPE_WEBHOOK_SECRET` in `functions/.secret.local` and restart the emulators. Events sent while the listener was not running are not retried locally: resend them with `stripe events resend <eventId>`. Then subscribe from the Dashboard with a Stripe test card: `4242 4242 4242 4242` succeeds, `4000 0000 0000 0341` is declined (any future expiry date and any CVC). A test subscription can be cancelled with `stripe subscriptions cancel <subscriptionId>`; the status in the Dashboard and the banner update automatically.

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start the Vite development server. |
| `npm run build` | Build the production bundle into `dist/`. |
| `npm run preview` | Serve the production build locally. |
| `npm run lint` | Run Oxlint. |
| `npm test` | Run the Vitest suite (requires the emulators). |
| `npm run test:functions` | Run the Cloud Functions unit tests (Stripe and Firestore are mocked; no emulator needed). |
| `npm run emulator` | Start the Firebase emulators with the data in `emulator-data/` and the Stripe webhook listener, in one terminal. |
| `npm run emulator:firebase` | Start only the Firebase emulators with the data in `emulator-data/`. |
| `npm run stripe:listen` | Forward the Stripe test events handled by the webhook to the Functions emulator. |
| `npm run emulator:export` | Export the running emulators' data to `emulator-data/`. |
| `npm run deploy:rules` | Deploy the Firestore rules and indexes and the Storage rules to the default Firebase project. |
| `npm run deploy:functions` | Deploy the Cloud Functions. |
| `npm run deploy:backend` | Deploy the rules, indexes and Cloud Functions together. |
| `npm run deploy:hosting` | Build the client and deploy `dist/` to Firebase Hosting. |
| `npm run docs` | Generate the JSDoc HTML reference of `src/` and `functions/` into `docs/` (git-ignored). |

Tests run against the emulators using the configuration in `.env.test`. Besides unit, UI and security-rules tests, `tests/e2e.flow.test.js` runs the whole flow on the emulators: registration, onboarding, Store selection, Menu, takeaway and delivery orders, status changes and cancellation, logout and login, order history and subscription status. To start the emulators, run the suite once and stop them, use the same command as CI:

```bash
npx firebase-tools emulators:exec --only auth,firestore,storage "npm test -- --run"
```

## Deployment

The client is served by Firebase Hosting as a single-page app (every path rewrites to `index.html`); the backend is Firestore, Storage and the two Cloud Functions in the same Firebase project.

1. Firebase project on the Blaze plan (required by Cloud Functions), with Firestore and Storage in `europe-west6`, and the Email/Password and Google sign-in providers enabled. Set the project in `.firebaserc` and its web configuration in `.env` (the production build reads the `VITE_FIREBASE_*` values).
2. Stripe secrets in Google Secret Manager:

   ```bash
   firebase functions:secrets:set STRIPE_SECRET_KEY
   firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
   ```

3. Non-secret params in `functions/.env.<projectId>` (`STRIPE_PRICE_ID`, and `APP_URL` set to the Hosting URL).
4. Deploy the backend, then the client:

   ```bash
   npm run deploy:backend
   npm run deploy:hosting
   ```

   `deploy:backend` also deploys the composite indexes in `firestore.indexes.json`; the emulators do not enforce indexes, so a missing one only shows up in production.
5. In the Stripe Dashboard (test mode), add a webhook endpoint pointing to the deployed `stripeWebhook` URL with the four handled events, and store its signing secret in `STRIPE_WEBHOOK_SECRET` (step 2), then redeploy the functions.

## Project structure

```text
src/
  pages/        Route-level pages (Login, Onboarding, StoreSelection, Menu, Tableau, Dashboard)
  components/   Reusable UI components (app shell with header and navigation, route guards, shared loading, error and confirmation states, category and product UI, Tableau board and ticket cards, receipt print preview, ticket sidebar for creation and editing, customer section, menu panel, item configuration and ticket summary, Dashboard order history list and detail, Dashboard subscription section and subscription banner)
  contexts/     React contexts for auth state and the active Store
  services/     Firebase data layer, one service per entity plus the billing service (Checkout and subscription status); components never call Firebase directly
  utils/        Shared helpers, including the shared Tailwind class sets, the field length limits, the receipt formatter and image compression
  routes.jsx    Route definitions
tests/          Unit, UI, security-rules and end-to-end tests
functions/      Cloud Functions (Stripe test mode)
  index.js      Function exports
  config.js     Region, secrets, params and the test-mode Stripe client
  checkout.js   createCheckoutSession callable
  webhook.js    stripeWebhook HTTP endpoint
  subscription.js Stripe subscription to Firestore mapping, shared by the webhook and the Checkout sync
  .env.<projectId> Non-secret params of the deployed functions
  tests/        Functions unit tests
.github/workflows/ CI and release workflows
firestore.rules Firestore security rules
firestore.indexes.json Firestore composite indexes (a Store's orders by day, Categories and Products by position)
storage.rules   Storage security rules
firebase.json   Firebase Hosting, rules, functions and emulator configuration
.firebaserc     Default Firebase project
jsdoc.json      JSDoc configuration (output in docs/, git-ignored)
```

## Continuous integration and releases

- **CI** (`.github/workflows/ci.yml`) runs on pull requests to `develop` and `main`: workflow linting, `npm run lint`, the test suite against the emulators and `npm run build`.
- **Release** (`.github/workflows/release.yml`) runs on `vX.Y.Z` tags pushed on `main` and creates a GitHub release with generated notes.
