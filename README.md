# PizzaHub

PizzaHub is a web application for pizzeria staff. It lets a team register, set up its Company and Store, select the Store to work on and manage that Store's Menu. The project is an MVP under active development; this document describes only what is implemented today.

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

### Other pages

- **Tableau** and **Dashboard** exist as routes with placeholder content only.

### Security

- Firestore and Storage security rules restrict access to authenticated Users and isolate data per Company and Store.

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
  components/   Reusable UI components (layout, route guards, category and product UI)
  contexts/     React contexts for auth state and the active Store
  services/     Firebase data layer, one service per entity; components never call Firebase directly
  utils/        Shared helpers
  routes.jsx    Route definitions
tests/          Unit, UI and security-rules tests
firestore.rules Firestore security rules
storage.rules   Storage security rules
firebase.json   Firebase Hosting, rules and emulator configuration
```

## Continuous integration and releases

- **CI** (`.github/workflows/ci.yml`) runs on pull requests to `develop` and `main`: workflow linting, `npm run lint`, the test suite against the emulators and `npm run build`.
- **Release** (`.github/workflows/release.yml`) runs on `vX.Y.Z` tags pushed on `main` and creates a GitHub release with generated notes.
