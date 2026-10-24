# Enat Agar (እናት አጋር) - Fullstack Maternal Health Platform

Enat Agar is a comprehensive maternal and antenatal care (ANC) platform designed for Ethiopian mothers, clinicians, and health administrators.

---

## 🌟 Architecture & Tech Stack

- **Frontend:** React 19 + TypeScript + Tailwind CSS
- **Backend:** Node.js Express + TypeScript (`server/index.ts`)
- **Database:** PostgreSQL (with automated schema migration and resilient in-memory fallback for immediate zero-config testing)
- **Security:** Native JWT Authentication with Bcrypt password hashing
- **Language:** Amharic UI with bilingual medical indicators

---

## 👥 Three Dedicated Portals

### 1. 🤰 Mother / Patient Portal
- Unique identifiers: **Phone Number** and optional **ID Number**
- Data securely synchronized to database
- Antenatal care (ANC) schedule calculated via LNMP or ultrasound
- View reminders & notifications sent directly from clinicians
- Ethiopian calendar support with holiday alerts
- Interactive danger signs checker & pregnancy quiz

### 2. 👩‍⚕️ Clinician Dashboard
- Roster of assigned patients with gestational age & risk notes
- **Add Patients via Credentials:** Clinicians verify patient's phone and password for patient-consent linking
- **Register New Patients:** Clinicians can directly enroll new mothers
- **Track Appointments & Missed Visits:** Flag missed appointments with clinician notes & reason
- **Send Direct Reminders:** Push medication, hydration, and appointment alerts to patients
- **Profile Management:** View and edit patient medical notes and pregnancy calculations

### 3. 🛡️ Admin Dashboard
- **System Overview:** Total registered mothers, active clinicians, scheduled and missed appointments
- **Patient Directory:** Complete database view of all registered mothers across all facilities
- **Clinician Management:** View all clinicians, their specialties, and expandable lists of assigned patients
- **Create Clinician Accounts:** Easily onboard medical staff

---

## 🔑 Demo Accounts (Pre-seeded)

| Role | Phone | Password | Name / Description |
|---|---|---|---|
| **Admin** | `0911000000` | `admin123` | System Administrator |
| **Clinician** | `0922000000` | `clinician123` | Dr. Selamawit Tadesse (Midwife Specialist) |
| **Patient** | `0933000000` | `patient123` | Aster Bekele (Primigravida, Week 14) |

*You can also click the quick-fill buttons in the Login modal for instant access.*

---

## 🚀 How to Run

### Development Mode (with hot-reload)

Open two terminals:

**Terminal 1 (Backend API):**
```bash
npm run server
```
*API runs at `http://localhost:5000/api`*

**Terminal 2 (Frontend Vite Dev Server):**
```bash
npm run dev
```
*Visit `http://localhost:3000` (proxies `/api` requests to backend)*

---

### Production Mode (All-in-One Server)

Build the frontend and run everything from the Express server:

```bash
npm run build
npm start
```
*Visit `http://localhost:5000`*

---

## 🗄️ PostgreSQL Setup (Optional)

The application automatically uses an in-memory data store if PostgreSQL is not detected, allowing you to test right away without database setup.

To connect to a live PostgreSQL instance (local, Docker, Supabase, Neon, etc.), add your connection string to a `.env` file:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/enatagar
```

Or configure individual environment variables:
```env
PGHOST=localhost
PGPORT=5432
PGUSER=postgres
PGPASSWORD=your_password
PGDATABASE=enatagar
```

The database tables and demo seed data will automatically be generated on first startup!
