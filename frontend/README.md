# Frontend

Next.js (App Router) + TypeScript UI for the Route 53 clone, built with the
Cloudscape Design System. See the [root README](../README.md) for setup,
architecture and deployment.

```bash
npm install
npm run dev          # http://localhost:3000, proxies /api to http://127.0.0.1:8000
npm run lint
npm run typecheck
npm run test:e2e     # Playwright; set E2E_BASE_URL to test a deployment
```
