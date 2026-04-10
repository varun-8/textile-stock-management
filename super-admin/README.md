# Super Admin

Private cloud control plane for LoomTrack/Prodexa licensing.

## New Layout

- `backend/` API only, deploy this to Render
- `frontend/` Vite app, deploy this to Vercel

## Backend

Deploy `super-admin/backend` as a separate Render service.

Required env vars:

- `SUPER_ADMIN_EMAIL`
- `SUPER_ADMIN_PASSWORD`
- `LICENSE_PRIVATE_KEY_PEM` or `LICENSE_PRIVATE_KEY_PATH`
- `LICENSE_PUBLIC_KEY_PEM` or `LICENSE_PUBLIC_KEY_PATH`

Recommended env vars:

- `PORT`
- `SUPER_ADMIN_TOKEN_TTL_MS`
- `SUPER_ADMIN_DATA_DIR`
- `SUPER_ADMIN_ALLOWED_ORIGINS`
- `SUPER_ADMIN_COMPANY_NAME`
- `SUPER_ADMIN_PORTAL_TITLE`
- `SUPER_ADMIN_SUPPORT_EMAIL`
- `SUPER_ADMIN_SUPPORT_PHONE`
- `SUPER_ADMIN_BILLING_EMAIL`
- `SUPER_ADMIN_COMPANY_ADDRESS`
- `SUPER_ADMIN_BRAND_COLOR`

## Access Model

- Login is email-based and restricted to Gmail addresses.
- `SUPER_ADMIN` can manage users, block or deactivate systems, revoke licenses, and review audit logs.
- `MANAGER` can issue licenses, register clients, and generate reset codes.
- Every authenticated action is written to the audit log for accountability.
- Company branding and support details are managed inside the portal itself and stored separately from the main product.
- Each logged-in account can change its own password from the portal, but no other account can edit the Super Admin login.

## Frontend

Deploy `super-admin/frontend` as a separate Vercel project.

Set:

- `VITE_SUPER_ADMIN_API_URL=https://your-render-service.onrender.com`

## Local Development

Backend:

```bash
cd super-admin/backend
npm install
npm run dev
```

Frontend:

```bash
cd super-admin/frontend
npm install
npm run dev
```

The frontend should point at the backend via `VITE_SUPER_ADMIN_API_URL`.
