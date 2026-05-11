# MediSync

MediSync is a full-stack healthcare workflow platform for patients, doctors, nurses, pharmacists, receptionists, and administrators. It supports appointment scheduling, triage workflows, medical records, prescriptions, billing, inventory, notifications, audit logging, and admin analytics.

## Tech Stack

- Frontend: React, TypeScript, Vite, Tailwind CSS
- Backend: Node.js, Express, MongoDB, Mongoose
- Realtime: Socket.IO
- Security: JWT, HTTP-only cookies, CSRF protection, Helmet, rate limiting, audit logs
- Deployment: Docker Compose and Nginx reverse proxy

## Project Structure

```text
MediSync/
  client/   React/Vite frontend
  server/   Express API, models, routes, services, middleware
  nginx/    Reverse proxy configuration
```

## Getting Started

### Server

```bash
cd server
npm install
cp .env.example .env
npm run dev
```

### Client

```bash
cd client
npm install
npm run dev
```

### Docker

```bash
docker compose up --build
```

Set strong values for `JWT_SECRET`, `JWT_REFRESH_SECRET`, `ENCRYPTION_SECRET`, and `MASTER_KEY` before using the Docker setup beyond local development.

## Verification

```bash
cd client
npm run build

cd ../server
npm test
```
