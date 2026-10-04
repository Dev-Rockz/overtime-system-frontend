# Overtime System Frontend

Vite and React starting point for the overtime planning and approval system.

## Local development

```powershell
npm.cmd install
npm.cmd run dev
```

Verification commands:

```powershell
npm.cmd run lint
npm.cmd test
npm.cmd run build
```

The default frontend URL is `http://127.0.0.1:5173`. The backend base URL can be
configured with `VITE_API_BASE_URL`; see `.env.example`.

Employee authentication is connected to the backend. Overtime feature endpoints
will be added inside `src/api` as their corresponding feature pages are built.

During development, the login form can remember test credentials in browser local
storage. This stores the password as plain text and must remain disabled in a real
deployment by setting `VITE_REMEMBER_TEST_CREDENTIALS=false`.

## Source organization

```text
src/
|-- api/                 HTTP client, structured errors, and endpoint modules
|-- components/shared/   Reusable UI used across roles
|-- config/              Environment-based application settings
|-- features/auth/       Login, session provider, and authentication tests
|-- features/employee/   Employee layout, routes, pages, and styles
|-- routes/              Public and protected route guards
|-- styles/              Shared design tokens and base styles
|-- test/                Shared test setup
|-- App.jsx              Application route definitions
`-- main.jsx             Application providers and React entry point
```

Employee routes currently include `/employee`, `/employee/plans`, and
`/employee/actual-overtime`. Authenticated API calls automatically use the saved
bearer token, and an authenticated `401` response clears the expired session.

Future role work should be added as sibling feature folders, such as
`features/supervisor`, `features/japanese-management`, and `features/admin`.
