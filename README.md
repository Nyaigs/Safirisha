# Safirisha

Safirisha is a hyperlocal logistics and transport platform that connects customers with nearby drivers for moving goods using vehicles such as bikes, tuk tuks, pickups, and lorries.

## Overview

Safirisha is designed to make local goods transport easier, faster, and more transparent. Customers can request transport, get matched with drivers, track trips live, confirm pickup and delivery, and complete payment through supported methods.

## Features

### Customer

- Create transport requests
- Choose pickup and drop-off locations
- Select vehicle type based on load
- View estimated trip pricing
- Search for nearby drivers
- Track trip live
- Confirm pickup handover
- Confirm delivery received
- Choose payment method
- Complete transport flow end-to-end

### Driver

- Register and complete KYC
- View nearby matching jobs
- Accept requests
- Sync live location
- Update trip progress
- Wait for customer confirmations
- Confirm cash payment receipt
- View earnings summary

### Admin

- Manage users
- Review drivers
- Monitor platform activity
- Track realtime admin stats

## Tech Stack

### Frontend

- React Native
- Expo
- TypeScript
- Expo Router

### Backend

- Node.js
- Express.js
- TypeScript

### Database

- PostgreSQL
- Prisma ORM

### Realtime

- Socket.IO

### Maps and Location

- Expo Location
- Geoapify

### Payments

- Cash
- Simulated M-Pesa flow

## Project Structure

```bash
Safirisha/
├── app/                # Expo app screens and routes
├── assets/             # Images and static assets
├── components/         # Reusable frontend components
├── constants/          # Frontend constants
├── hooks/              # Custom hooks
├── lib/                # Frontend utilities and API helpers
├── store/              # Zustand or app state
├── types/              # Shared frontend types
├── utils/              # Frontend utility helpers
├── backend/            # Express backend, Prisma, controllers, routes
└── README.md
```
