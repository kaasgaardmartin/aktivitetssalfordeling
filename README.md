# Aktivitetssalfordeling

System for fordeling av treningstid i kampidrettssaler — Oslo idrettssekretariat.

## Stack

- **Frontend/Backend**: Next.js 15 (App Router) + TypeScript
- **Database**: Supabase (PostgreSQL) — prosjekt: `aktivitetssalfordeling`
- **Hosting**: Vercel
- **E-post**: Resend (anbefalt) eller annen SMTP

## Kom i gang

### 1. Klon og installer

```bash
git clone <repo-url>
cd aktivitetssalfordeling
npm install
```

### 2. Sett opp miljøvariabler

```bash
cp .env.local.example .env.local
```

Fyll inn i `.env.local`:

| Variabel | Hvor hentes den |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Allerede satt: `https://hybfuhvrasznjhkhuerg.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Allerede satt |
| `SUPABASE_SERVICE_ROLE_KEY` | [Supabase Dashboard](https://supabase.com/dashboard/project/hybfuhvrasznjhkhuerg/settings/api) → Service Role |
| `RESEND_API_KEY` | [resend.com](https://resend.com) → API Keys |
| `EMAIL_FROM` | Verifisert avsenderadresse i Resend |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` (dev) / `https://din-url.vercel.app` (prod) |

### 3. Kjør lokalt

```bash
npm run dev
```

Åpne [http://localhost:3000](http://localhost:3000)

---

## Supabase

Prosjekt er allerede opprettet og migrasjoner kjørt:

- **URL**: `https://hybfuhvrasznjhkhuerg.supabase.co`
- **Region**: `eu-west-1` (Irland)
- **Migrasjoner**: `initial_schema`, `rls_policies`, `indexes_and_views`

### Generer TypeScript-typer etter skjemaendringer

```bash
npm run db:types
```

---

## Deployment til Vercel

### Første gang

```bash
npm install -g vercel
vercel
```

Vercel oppdager automatisk Next.js. Legg til miljøvariabler i Vercel Dashboard:
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `NEXT_PUBLIC_APP_URL` (sett til produksjons-URL)

### Kontinuerlig deployment

Push til `main` → Vercel deployer automatisk.

---

## Brukerflyt

### Klubber
1. Admin åpner sesong og sender magic links: `POST /api/admin/send-links`
2. Klubb klikker lenke → `GET /api/magic-link?token=xxx` → session settes
3. Klubb ser `/klubb` → bekrefter, endrer eller søker om tid

### Admin
- `/admin` — halloversikt, søknadsbehandling, venteliste

---

## API-oversikt

| Metode | Rute | Beskrivelse |
|---|---|---|
| GET | `/api/magic-link?token=` | Validerer token, setter session-cookie |
| POST | `/api/svar` | Klubb sender svar på én slot |
| PUT | `/api/svar` | Klubb bekrefter alle slots uendret |
| GET | `/api/tidslots` | Hent slots (filtrerbar) |
| POST | `/api/tidslots` | Admin oppretter slot(s) |
| PATCH | `/api/tidslots` | Admin tildeler/fjerner klubb fra slot |
| GET | `/api/soknader` | Admin henter alle søknader |
| POST | `/api/soknader` | Klubb sender søknad om ledig slot |
| PATCH | `/api/soknader` | Admin godkjenner/avslår søknad |
| GET | `/api/haller` | List alle aktive haller |
| POST | `/api/haller` | Admin oppretter hall |
| GET | `/api/sesonger` | List sesonger |
| POST | `/api/sesonger` | Admin oppretter sesong |
| GET | `/api/venteliste` | Admin ser venteliste |
| POST | `/api/venteliste` | Klubb melder seg på venteliste |
| PATCH | `/api/venteliste` | Admin tildeler/fjerner fra venteliste |
| POST | `/api/admin/send-links` | Sender magic links til alle klubber |

---

## Mappestruktur

```
src/
├── app/
│   ├── api/              # Route handlers
│   │   ├── magic-link/
│   │   ├── svar/
│   │   ├── tidslots/
│   │   ├── soknader/
│   │   ├── haller/
│   │   ├── sesonger/
│   │   ├── venteliste/
│   │   └── admin/send-links/
│   ├── klubb/            # Klubb-flate (magic link beskyttet)
│   ├── admin/            # Admin-flate
│   ├── layout.tsx
│   ├── page.tsx          # Landingsside
│   └── globals.css
├── components/
│   ├── klubb/
│   │   └── KlubbOversikt.tsx
│   └── admin/
│       └── AdminDashboard.tsx
├── lib/
│   └── supabase.ts       # Browser / server / admin klienter
├── types/
│   └── database.ts       # TypeScript-typer for hele skjemaet
└── middleware.ts          # Session-beskyttelse på /klubb og /admin
```
