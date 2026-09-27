# Safirisha

**An integrated mobility and logistics ecosystem for Africa.**

Safirisha connects customers who need goods moved — parcels, documents, groceries, furniture, construction materials, farm produce, commercial stock, and more — with a network of drivers operating motorbikes, tuk-tuks, pickups, and lorries.

> **Safirisha is not a ride-hailing app.** It is a logistics platform purpose-built for moving cargo, serving Kenya and the broader African market.

## Vision

To build Africa's premier integrated mobility and logistics platform — one that empowers drivers to earn more, gives customers confidence, and scales from hundreds to millions of users without architectural rewrites.

The long-term roadmap covers goods transportation, parcel delivery, business logistics, fleet management, corporate mobility, scheduled transport, digital payments (M-Pesa), intelligent dispatch, and operational analytics.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile (Customer + Driver) | Expo · React Native · TypeScript |
| Backend | Node.js · Express · TypeScript |
| Database | PostgreSQL · Prisma ORM |
| Realtime | Socket.IO |
| Auth | Clerk + legacy JWT |
| Maps | react-native-maps · Geoapify (Google Maps stub ready) |
| Monitoring | Sentry |
| Background Jobs | BullMQ (planned) |
| Caching | Redis (planned) |

## Project Structure
```text
Safirisha/
├── app/                    # Expo Router screens
│   ├── (auth)/             # Login, register, password reset
│   ├── (customer)/         # Customer booking flow
│   ├── (driver)/           # Driver dashboard and jobs
│   └── (admin)/            # Admin console
├── assets/                 # Images, icons, splash
├── components/             # Reusable UI + feature components
│   ├── booking/            # Booking sheet and steps
│   ├── driver/             # Job ping overlay
│   └── ui/                 # Design system primitives
├── constants/              # design.ts, layout.ts, vehicles, loadsizes
├── hooks/                  # Custom React hooks
├── lib/                    # API client, socket, maps, config
├── store/                  # Zustand stores
├── types/                  # Shared TypeScript types
├── utils/                  # Helpers
├── backend/                # Express + Prisma backend
│   ├── src/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── services/
│   │   └── socket/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   └── uploads/            # Runtime uploads (not tracked)
├── .env.example            # Frontend env template
├── eas.json                # EAS build profiles
└── package.json
```
## Quick Start

### Prerequisites
- Node.js 20+
- npm or yarn
- Expo Go app on your phone
- A PostgreSQL database (Neon free tier works)

### Clone git clone https://github.com/Nyaigs/Safirisha.git
cd Safirisha

### Environment Setup cp .env.example .env
cp backend/.env.example backend/.env
text


Frontend `.env` requires:
- `EXPO_PUBLIC_API_BASE_URL`
- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `EXPO_PUBLIC_GEOAPIFY_KEY`
- `EXPO_PUBLIC_SENTRY_DSN` (optional)

Backend `.env` requires:
- `DATABASE_URL` and `DIRECT_DATABASE_URL`
- `JWT_SECRET`
- `CLERK_SECRET_KEY`
- `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD`

### Install Dependencies

npm install
cd backend && npm install && cd ..
text


### Set Up Database

cd backend
npx prisma generate
npx prisma migrate deploy
cd ..
text


### Run Backend

cd backend
npm run dev
text


### Run Frontend

npx expo start --tunnel --clear
text


## Features

### Customer App
- Map-first booking with draggable bottom sheet (30/60/90%)
- Location search with autocomplete, landmarks, and estates
- Three methods to select pickup and drop-off: GPS, search, map pin
- Delivery details (category, description, fragile toggle)
- Load size selection (Small, Medium, Large, Extra Large, Custom)
- Vehicle selection (Motorbike, TukTuk, Pickup, Lorry) with transparent pricing
- Real-time driver matching and live tracking
- 4-stage progress stepper
- Safety sheet (call support, share trip, driver identity)
- Trip history and profile

### Driver App
- Full-screen dashboard with availability toggle
- GPS-aware: must have a valid fix before going online
- Job ping overlay: 30-second countdown, payout, distance, cargo
- Active trip with status stepper and one-tap navigation handoff
- Earnings summary
- KYC submission with document uploads

### Admin Console
- Platform metrics dashboard
- Pending driver approvals
- Trip monitoring with filters
- User management
- Live map
- Deletion requests

## Project Status

### Phase 1 — Stabilisation (Complete)
- TypeScript zero-error compilation
- Prisma schema consistency
- Full trip lifecycle FSM
- Cancellation fees and driver penalties
- Scheduled trips
- Real-time events (Socket.IO)
- Backend security hardening (Helmet, rate limit, CORS allow-list)

### Phase 2 — Polish (Complete)
- Design system tokens (constants/design.ts, constants/layout.ts)
- Reusable UI primitives (button, card, input, bottom sheet, skeleton)
- Responsive layouts and safe-area handling
- Skeleton loading states
- Customer safety sheet with share trip
- Driver job ping overlay
- Maps provider abstraction (Geoapify + Google Maps stub)
- Unit tests for utilities and stores

### Phase 3 — Beta Readiness (In Progress)
- End-to-end testing on physical devices
- Web preview deployment
- Android APK build
- Push notifications (Firebase)
- Backend rating endpoint

### Phase 4 — Launch (Planned)
- M-Pesa STK Push integration
- Redis + BullMQ for scale
- In-app messaging
- Production deployment
- Google Play + App Store submission

## Engineering Principles

1. TypeScript strict mode everywhere. No `any`, no `@ts-ignore`.
2. Modular monolith — do not convert to microservices prematurely.
3. PostgreSQL is the system of record. Redis is for speed, not truth.
4. Reuse over rewrite. Extend working modules, do not replace them.
5. Test before shipping. Manual verification on real devices.
6. Every screen must do real work. No dead buttons, no fake data.

## Contributing

1. Create a feature branch: `git checkout -b feat/your-feature`
2. Make changes and verify: `npx tsc --noEmit && npx expo lint`
3. Commit with a clear message
4. Push and open a pull request

## License

Proprietary — © Safirisha. All rights reserved.

## Contact

- Repository: https://github.com/Nyaigs/Safirisha
- Maintainer: @Nyaigs
