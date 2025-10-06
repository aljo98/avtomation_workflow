Quick setup

Prerequisites
- Node.js 20+
- npm (or pnpm)
- Docker & Docker Compose

Steps

1) Start local services:

```bash
docker-compose up -d
```

2) Install dependencies (root uses npm workspaces):

```bash
npm run bootstrap
```

3) Start frontend (in separate terminal):

```bash
npm run dev:frontend
```
```

4) Start backend (in separate terminal):

```bash
npm run dev:backend
```

Notes
- Frontend and backend folders contain minimal package manifests; run `npm install` inside each if you prefer local installs.
- If you want, I can scaffold a Vite React TypeScript app in `apps/frontend` and a NestJS starter in `apps/backend` next.