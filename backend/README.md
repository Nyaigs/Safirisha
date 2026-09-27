# Safirisha Backend

Express + Prisma + PostgreSQL backend for the Safirisha logistics platform.

## Structure

backend/
├── src/
│ ├── controllers/ # Route handlers
│ ├── middleware/ # Auth, error, validation
│ ├── routes/ # API route definitions
│ ├── services/ # Business logic
│ ├── socket/ # Socket.IO realtime handlers
│ ├── lib/ # Prisma client, helpers
│ └── server.ts # Entry point
├── prisma/
│ ├── schema.prisma
│ └── migrations/
├── uploads/ # Runtime file storage (not tracked)
└── .env.example
text


## Endpoints

### Authentication
- POST /api/auth/register/customer
- POST /api/auth/register/driver
- POST /api/auth/login
- GET /api/auth/me
- PATCH /api/auth/me

### Trips
- POST /api/trips
- GET /api/trips/my-trips
- GET /api/trips/my-stats
- GET /api/trips/my-active
- GET /api/trips/:id
- POST /api/trips/:id/accept
- PATCH /api/trips/:id/status
- PATCH /api/trips/:id/cancel
- PATCH /api/trips/:id/cancel/driver
- PATCH /api/trips/:id/confirm-pickup
- PATCH /api/trips/:id/confirm-delivery
- PATCH /api/trips/:id/start-transit

### Drivers
- GET /api/drivers/me
- PATCH /api/drivers/me/location
- PATCH /api/drivers/me/availability
- PATCH /api/drivers/me/kyc
- GET /api/drivers/me/nearby-trips
- GET /api/drivers/me/active-trip

### Admin
- GET /api/admin/dashboard
- GET /api/admin/drivers/pending
- PATCH /api/admin/drivers/:id/approval
- GET /api/admin/trips
- GET /api/admin/users
- GET /api/admin/deletion-requests

### Health
- GET /api/health
- GET /api/db-ping

## Development

npm install
npx prisma generate
npx prisma migrate deploy
npm run dev
text


Runs on http://localhost:5000

## Trip Lifecycle (FSM)

REQUESTING → SEARCHING → SEARCHING_DRIVER → DRIVER_ASSIGNED → ACCEPTED → DRIVER_EN_ROUTE → ARRIVED_PICKUP → PICKUP_CONFIRMED → IN_TRANSIT → ARRIVED_DROPOFF → DELIVERY_CONFIRMED → PAYMENT_PENDING → DELIVERED

Terminal states: DELIVERED, CANCELLED

## Security

- Helmet for HTTP headers
- express-rate-limit (100 req/15 min auth, 300 req/15 min API)
- CORS allow-list via CORS_ALLOWED_ORIGINS
- JWT authentication with Clerk fallback
- Prisma parameterized queries
- bcrypt password hashing

## Environment Variables

Required:
- DATABASE_URL, DIRECT_DATABASE_URL
- JWT_SECRET
- CLERK_SECRET_KEY
- SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD

Optional:
- REDIS_URL
- CORS_ALLOWED_ORIGINS

## Uploads

Runtime uploads stored in backend/uploads/ and not tracked in Git. See uploads/README.md.

## Scripts

npm run dev # Start development server
npm run build # Compile TypeScript
npm start # Run compiled build
npx prisma studio # Open Prisma Studio
npx prisma migrate dev # Create and apply migration
text


## License

Proprietary — © Safirisha. All rights reserved.
