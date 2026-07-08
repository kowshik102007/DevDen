# School Timetable Generator

**AI-powered, clash-free school timetable generator** built with React + TypeScript + Supabase.

> 🎓 Designed for Indian schools — government, private, and higher secondary schools.

---

## 🚀 Features

- **Smart Algorithm**: Constraint satisfaction algorithm generates clash-free timetables automatically
- **School Setup**: Configure working days, period timings, lunch breaks
- **Class Management**: Add unlimited classes and divisions
- **Subject Management**: Subject catalog with category, code, weekly period requirements
- **Teacher Management**: Teacher assignments, availability restrictions, workload limits
- **3 Timetable Views**: Class-wise, Teacher-wise, Subject-wise
- **Verification System**: Detects clashes, missing periods, violations
- **Export System**: PDF, Excel (.xlsx), CSV formats
- **Payment Gate**: ₹20 UPI payment to unlock downloads
- **Admin Dashboard**: View all schools, payments, revenue
- **Auth**: Email login + Google login (via Supabase Auth)
- **Landing Page**: Professional SaaS design

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript |
| Styling | Tailwind CSS |
| State Management | Zustand |
| Backend | Supabase (PostgreSQL + Auth + Storage) |
| PDF Export | jsPDF + jspdf-autotable |
| Excel Export | SheetJS (xlsx) |
| Payment | Razorpay + UPI QR |
| Deployment | Vercel |

---
<img width="1313" height="857" alt="image" src="https://github.com/user-attachments/assets/bca92873-9097-41d4-8323-5b4b22f33ce5" />
<img width="1917" height="946" alt="Screenshot 2026-06-10 131640" src="https://github.com/user-attachments/assets/8be4084b-53fa-46f5-922c-8e465a656277" />



## 📁 Project Structure

```
src/
├── components/
│   └── layout/
│       └── AppLayout.tsx      # Sidebar + main layout
├── lib/
│   ├── algorithm.ts           # CSP timetable generation
│   ├── exportPdf.ts           # PDF export
│   ├── exportExcel.ts         # Excel/CSV export
│   └── supabase.ts            # Supabase client
├── pages/
│   ├── Landing.tsx            # SaaS landing page
│   ├── Auth.tsx               # Login/Signup
│   ├── Dashboard.tsx          # Main dashboard
│   ├── SchoolSetup.tsx        # School configuration
│   ├── ClassManagement.tsx    # Class & division management
│   ├── SubjectManagement.tsx  # Subjects & assignments
│   ├── TeacherManagement.tsx  # Teachers & availability
│   ├── TimetableGenerator.tsx # Run algorithm
│   ├── TimetableView.tsx      # View + export timetable
│   └── AdminDashboard.tsx     # Admin panel
├── store/
│   └── index.ts               # Zustand stores
├── types/
│   └── index.ts               # TypeScript types
└── App.tsx                    # Routes
```

---

## ⚡ Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
```

Edit `.env` with your Supabase credentials:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Set Up Supabase
1. Create a project at [supabase.com](https://supabase.com)
2. Run the schema: copy `supabase/schema.sql` into the SQL editor and execute
3. Enable Google Auth in Authentication > Providers

### 4. Run Development Server
```bash
npm run dev
```

Visit `http://localhost:5173`

### 5. Deploy to Vercel
```bash
npm run build
vercel --prod
```

---

## 🧠 Algorithm

The timetable generation uses a **Constraint Satisfaction Problem (CSP)** approach:

**Priority Order:**
1. No teacher clash (critical)
2. No class clash (critical)
3. Fulfill weekly subject period counts
4. Respect teacher availability
5. Balance subject distribution across days

**Steps:**
1. Mark fixed periods (Assembly on Monday P1, Lunch break)
2. Sort subjects by weekly period count (descending)
3. For each subject-class pair, find valid slots:
   - Teacher not assigned elsewhere
   - Teacher within daily/weekly limits
   - Teacher available at that slot
   - Prefer days where subject not already assigned (balancing)
4. Fill remaining slots with "Free"
5. Run violation detection and report issues

---

## 💳 Payment Flow

1. User generates timetable → Preview shown immediately
2. Export buttons show a 🔒 lock icon
3. User clicks "Unlock Downloads (₹20)"
4. Payment modal shows:
   - UPI QR code (scan with GPay/PhonePe)
   - UPI ID: `timetableai@upi`
   - Razorpay option for card/net banking
5. User enters transaction ID → verified → downloads unlocked

---

## 🗄️ Database Schema

See `supabase/schema.sql` for the complete schema with:
- Row Level Security (RLS) policies
- Indexes for performance
- Automatic `updated_at` triggers

---

## 👨‍💼 Admin Access

Visit `/admin` while logged in as a user with `admin` role (email containing "admin" in demo mode).

---

## 📄 License

MIT License — Free for use by schools and educational institutions.

---

*Built with ❤️ for Indian schools.*
