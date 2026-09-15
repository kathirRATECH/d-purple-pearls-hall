# School Portal

A self-contained school portal for **Students**, **Class Teachers**, and **Owners**, built with Node.js, Express, EJS, and SQLite.

## Features

- Explicit account tables for `students`, `teachers`, and the singleton `owner`; scores reference the teacher who recorded them.
- One-time first-run setup at `/owner/setup` creates the Owner account.
- Separate login/signup routes and role-aware sessions:
  - `/student/signup`, `/student/login`, `/student/dashboard`
  - `/teacher/signup`, `/teacher/login`, `/teacher/dashboard`
  - `/owner/setup`, `/owner/login`, `/owner/dashboard`
- Student login accepts either admission number or email; owner login uses username.
- Students can view scores, averages, and rankings.
- Class Teachers can record or update scores only for their own class. Scores use a database-enforced unique `(student_id, subject)` key and parameterized upserts.
- Owners can filter rankings by class and view an all-school performance table.
- SQLite schema initialization/migration and default subjects happen automatically on first run.
- HTTP-only, `SameSite=Lax` cookies; secure cookies are enabled in production.
- Login/signup rate limiting, bcrypt password hashing, input validation, and parameterized SQL.

## Run locally

```bash
npm install
copy .env.example .env
# Set a long SESSION_SECRET in .env
npm start
```

Open <http://localhost:3000>. The first visit links to `/owner/setup`. The SQLite database is created at `data/school.sqlite` by default. Set `DB_FILE` to use another location.

## Publish online with Render

The included `render.yaml` configures a public Render web service with HTTPS,
a generated session secret, a health check, and a persistent disk for the
SQLite database.

1. Put this `school` folder in a GitHub repository.
2. Create a Render account at <https://render.com>.
3. Choose **New + → Blueprint** and connect the GitHub repository.
4. Select `render.yaml` and deploy.
5. Open the generated `onrender.com` URL and visit `/owner/setup` if the
   database is new.

The persistent disk is important: without it, the SQLite database and all
accounts can be lost when the service restarts. Render's persistent disk
requires a paid service plan. Change the service name in `render.yaml` if
the name is already taken.

## Demo data

For local development only, create sample accounts and scores with:

```bash
npm run seed
```

The seed is safe to run repeatedly because accounts are inserted only when
missing and scores are upserted:

- Owner: `admin` / `DemoPass123!`
- Teacher: `teacher@example.com` / `DemoPass123!`
- Student: `STU-1001` or `sam@example.com` / `DemoPass123!`
- Student: `STU-1002` or `priya@example.com` / `DemoPass123!`

Change or remove these demo credentials before deploying.

## Database model

The application deliberately keeps account types in separate tables:

- `students(id, full_name, email, admission_number, class_name, password_hash, created_at)`
- `teachers(id, full_name, email, class_name, password_hash, created_at)`
- `owner(id, username, password_hash)` with `id = 1`
- `scores(student_id, subject, score, recorded_by, updated_at)` with foreign keys to `students` and `teachers` and a unique `(student_id, subject)` constraint.

For production, use `NODE_ENV=production`, a strong `SESSION_SECRET`, HTTPS, and a persistent session store instead of Express's in-memory store.
