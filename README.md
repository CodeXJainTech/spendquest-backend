# SpendQuest — Backend

REST API for the SpendQuest personal finance app. Built with Node.js, Express, and MongoDB.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js |
| Framework | Express 4 |
| Database | MongoDB via Mongoose |
| Auth | JWT (jsonwebtoken) + bcryptjs |
| Validation | Zod |
| Config | dotenv |

---

## System Design

```
┌─────────────────────────────────────────────────────────┐
│                        CLIENT                           │
│                 (React SPA on Vercel)                   │
└────────────────────────┬────────────────────────────────┘
                         │  HTTPS REST
                         ▼
┌─────────────────────────────────────────────────────────┐
│                    EXPRESS SERVER                       │
│                                                         │
│   ┌─────────────┐   ┌──────────────────────────────┐    │
│   │    CORS     │   │         /api/v1              │    │
│   │ Middleware  │   │                              │    │
│   └─────────────┘   │  /user      /account         │    │
│                     │    │            │            │    │
│   ┌─────────────┐   │    ▼            ▼            │    │ 
│   │    Auth     │   │  user.js   account.js        │    │
│   │ Middleware  │   │  (router)  (router)          │    │
│   │  (JWT)      │   └──────────────────────────────┘    │
│   └─────────────┘                                       │
└────────────────────────┬────────────────────────────────┘
                         │  Mongoose ODM
                         ▼
┌─────────────────────────────────────────────────────────┐
│                      MONGODB                            │
│                                                         │
│   ┌──────────┐  ┌──────────┐  ┌──────────────────┐      │
│   │  users   │  │ accounts │  │   transactions   │      │
│   └──────────┘  └──────────┘  └──────────────────┘      │
│   ┌──────────┐  ┌──────────┐                            │
│   │ budgets  │  │  goals   │                            │
│   └──────────┘  └──────────┘                            │
└─────────────────────────────────────────────────────────┘
```

### Request Flow

```
Request
  │
  ├─► CORS check
  ├─► express.json() body parse
  ├─► Route match  (/api/v1/user/* or /api/v1/account/*)
  ├─► authMiddleware  (verifies JWT, sets req.userId)
  ├─► Zod validation  (on write routes)
  ├─► Mongoose query
  └─► JSON response
```

### Transfer Flow (atomic)

```
POST /account/transfer
  │
  ├─► Start MongoDB session + transaction
  ├─► Check sender balance >= amount
  ├─► Find recipient by userName
  ├─► Debit sender account
  ├─► Credit recipient account
  ├─► Create debit Transaction record (sender)
  ├─► Create credit Transaction record (recipient)
  ├─► Auto-add recipient to sender contacts (if new)
  └─► Commit — or Abort on any failure
```
---

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Create .env file
cp .env.example .env
# Fill in MONGO_URI, JWT_SECRET, CORS_ORIGIN

# 3. Start server
npm start
```
---