# Modern Material You (MD3) Electricity Bill Directory App

A comprehensive Material Design 3 (Material You) redesign for the Bengali Electricity Bill Directory web application, creating an Android-native mobile experience with light/dark theming, real-time KPI statistics, thumb-friendly navigation, and full preservation of customer records, validation rules, and cloud synchronization.

## User Review & Critical Decisions

> [!IMPORTANT]
> The original application logic, customer schema, validation rules (11-digit mobile, 13-digit meter/SMS number, duplicate checks, 1-31 due day), Firebase Auth, Firestore sync, and JSON/CSV backup compatibility are completely preserved without any breaking changes.

- **Theme Palette**: Deep Indigo primary (`#3F51B5` / `#303F9F`) with Material You dynamic tonal containers (`primaryContainer`, `onPrimaryContainer`, `surfaceVariant`, `outlineVariant`) supporting both Light Mode and Dark Mode with persistent theme switching.
- **Mobile Navigation**: 4-Destination Material 3 Bottom Navigation Bar:
  1. **হোম (Home)**: Top App Bar, Real-time KPI Dashboard, quick overdue alerts, and recent bills.
  2. **গ্রাহক (Customers)**: Complete directory with instant search, filter chips, and due date selection.
  3. **বকেয়া (Dues)**: Focused view of unpaid customers for the current month with bulk summary copy.
  4. **সেটিংস (Settings)**: Dedicated Material 3 settings hub for Google Cloud Sync, JSON backup import/export, CSV spreadsheet download, and preferences.
- **Adaptive Screen Layout**: On mobile viewports ($< 768\text{px}$), the app utilizes the bottom navigation bar and thumb-friendly bottom sheets. On tablet/desktop viewports ($\ge 768\text{px}$), the layout adapts to an elevated side navigation rail / clean multi-column dashboard without trapped narrow strips.

---

## 1. Overview & Core Concept

- **What It Does**: A mobile-first utility directory and bill management application in Bengali that helps local electricity meter managers, landlords, and community bill collectors track monthly electricity dues, view remaining countdowns, copy meter numbers and phone numbers with 1-click, and synchronize records across all devices.
- **Target Audience / Persona**: Bengali-speaking electricity meter readers, neighborhood managers, and billing coordinators who primarily operate on Android mobile phones and require fast, high-contrast, offline-capable tracking with zero lag.
- **Key Value**: Replaces cumbersome manual record-keeping with an Android-native Material Design 3 experience that operates reliably both offline (LocalStorage) and online (Firebase Firestore), featuring instant 1-tap copy, accurate Bengali countdowns, and automated cloud backups.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Dashboard & Status Overview (Home Tab)**:
   - User opens the app and sees the MD3 Top App Bar with live Google Cloud Sync status and Theme Toggle.
   - 4 real-time KPI cards display total customers, paid bills, unpaid bills, and current month's pending dues calculated from live data.
   - Quick action banner highlights upcoming overdue bills with one-tap status review.
2. **Directory & Rapid Search (Customers Tab)**:
   - MD3 Search bar with leading search icon and trailing clear button (`✕`).
   - Material 3 Filter Chips: "সব গ্রাহক" (All), "বাকি আছে" (Unpaid), "পরিশোধিত" (Paid).
   - Dropdown chip for due date filtering (১-৩১ তারিখ).
   - Customer Cards displaying serial number, customer name, father/mother name, address, countdown pill, and dedicated 1-tap copy rows for mobile and 13-digit SMS meter number.
   - Tapping a card opens a Material 3 Bottom Sheet / Dialog with actions: Toggle Paid Status, Edit Details, or Delete (with confirmation dialog).
3. **Dedicated Dues Manager (Dues Tab)**:
   - Curated list of all unpaid customers for the current month.
   - Quick-action floating header allows 1-click copying of the WhatsApp/SMS overdue bill summary with Bengali date and formatted list.
4. **Customer Registration & Editing (Modal / Sheet)**:
   - Material Outlined Text Fields with floating labels, helper text, and Bengali error messages:
     - গ্রাহকের নাম (Required)
     - পিতার নাম & মাতার নাম (Optional)
     - ঠিকানা (Address)
     - মোবাইল নম্বর (Exact 11 digits validation)
     - SMS অ্যাকাউন্ট / মিটার নম্বর (Exact 13 digits validation with duplicate prevention)
     - বিলের শেষ তারিখ (1 to 31 valid day of month)
   - Tonal elevated "সেভ করুন" action button with immediate toast notification and real-time pulse.
5. **Settings & Data Hub (Settings Tab)**:
   - **Google Cloud Sync Card**: Live user avatar, email, connection status, Google Sign-In / Sign-Out, and manual "ক্লাউডে ডাটা রি-সিঙ্ক করুন" button.
   - **Data Backup & Restore**: Full JSON backup export, drag-and-drop JSON import with Smart Merge vs. Replace All preview, CSV export with UTF-8 BOM, and stats display.
   - **Appearance**: Light / Dark mode toggle switch.

### Visual Identity & Theme System

```
[ MATERIAL DESIGN 3 COLOR TOKENS ]
Token                  Light Mode              Dark Mode
----------------------------------------------------------------
--md-sys-primary       #3F51B5 (Indigo 600)    #9FA8DA (Indigo 200)
--md-sys-on-primary    #FFFFFF                 #1A237E
--md-sys-primary-cont  #E8EAF6                 #283593
--md-sys-surface       #F8FAFC                 #0F172A
--md-sys-surface-cont  #FFFFFF                 #1E293B
--md-sys-outline       #CBD5E1                 #334155
--md-sys-error         #DC2626                 #EF4444
--md-sys-success       #059669                 #10B981
```

- **Typography**: Google Fonts `Noto Sans Bengali` paired with tabular numerals (`tabular-nums`) for currency, meter numbers, dates, and countdown hours.
- **Component Styling**:
  - `rounded-2xl` ($16\text{px}$) for cards and containers, `rounded-3xl` ($24\text{px}$) for modal dialogs and bottom sheets.
  - Floating Action Button (FAB) at bottom-right with MD3 elevation and subtle press states.
  - No decorative AI slop, no arbitrary gradients; clean, purposeful surfaces and Material Symbol icons.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: 4-Tab Bottom Navigation with Dedicated Settings View**:
  - *Chosen Approach*: Replace modal-based settings with a first-class "সেটিংস" tab in the bottom navigation bar.
  - *Why*: In mobile utility apps, hiding backup, import/export, and cloud sync inside a small app-bar menu leads to reach fatigue and accidental misses. A dedicated tab makes cloud backup status prominent and accessible.
  - *Alternative Considered*: Floating modal drawer (harder to navigate on small phones).
- **Decision 2: Light and Dark Theme Support with Local Storage Persistence**:
  - *Chosen Approach*: Implement a system-aware theme provider that supports explicit Light / Dark toggling and remembers user preference in `localStorage`.
  - *Why*: Field meter readers often operate in bright sunlight (requiring crisp, high-contrast light surfaces) or late at night (requiring soft, battery-saving dark surfaces).
- **Decision 3: Real-Time Dynamic Dashboard**:
  - *Chosen Approach*: Compute KPIs (Total, Paid, Unpaid, Current Month Overdue) dynamically from live React state.
  - *Why*: Provides instant insight into revenue collection efficiency without stale counters or manual recalculations.

---

## 4. Technical Architecture & Data Strategy

### System Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                        TOP APP BAR & THEME ENGINE                      │
│     [Brand Title]  [Sync Status Indicator]  [Dark/Light Toggle]       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
           ┌────────────────────────┴────────────────────────┐
           ▼                                                 ▼
┌─────────────────────────┐                       ┌──────────────────────┐
│  MOBILE BOTTOM NAV      │                       │  DESKTOP NAV RAIL    │
│  [হোম] [গ্রাহক] [বকেয়া] [সেটিংস]               │  Sidebar navigation  │
└──────────┬──────────────┘                       └──────────┬───────────┘
           │                                                 │
           └────────────────────────┬────────────────────────┘
                                    │
    ┌───────────────────────────────┴───────────────────────────────┐
    │                       VIEW DISPATCHER                         │
    ├───────────────────┬──────────────────────┬────────────────────┤
    ▼                   ▼                      ▼                    ▼
┌───────────────┐ ┌──────────────────┐ ┌────────────────┐ ┌─────────────────┐
│ HOME (ড্যাশবোর্ড) │ │ CUSTOMERS (ডিরেক্টরি) │ │ DUES (বকেয়া তালিকা) │ │ SETTINGS (ব্যাকআপ/সিঙ্ক)│
│ • KPI Cards   │ │ • Instant Search │ │ • Unpaid cards │ │ • Google Auth   │
│ • Due Alerts  │ │ • Filter Chips   │ │ • WhatsApp     │ │ • JSON Import/  │
│ • Recent List │ │ • Add Customer   │ │   Summary Copy │ │   Export, CSV   │
└───────┬───────┘ └────────┬─────────┘ └───────┬────────┘ └────────┬────────┘
        │                  │                   │                   │
        └──────────────────┼───────────────────┴───────────────────┘
                           ▼
        ┌──────────────────────────────────────────────┐
        │              DATA & SYNC LAYER               │
        │  • React State (Optimistic CRUD)             │
        │  • LocalStorage ('billCustomers')            │
        │  • Firebase Firestore (onSnapshot realtime)  │
        │  • Firebase Auth (Google & Email/Password)   │
        └──────────────────────────────────────────────┘
```

### Customer Data Model (Strictly Preserved)

```typescript
interface Customer {
  id: string | number;        // Unique ID (timestamp or string)
  name: string;               // Customer full name (required)
  father: string;             // Father's name
  mother?: string;            // Mother's name (optional)
  address: string;            // Village/area address
  mobile: string;             // Exact 11 digits (normalized)
  sms: string;                // Exact 13 digits (unique meter account)
  dueDate: string;            // Day of month (1 to 31)
  group?: string;             // Area group tag
  lastPaidMonth: string;      // "YYYY-M" format
  userId?: string;            // Authenticated user UID
}
```

### Verification & Testing Plan

1. **Compilation**: Run `compile_applet` to verify TypeScript compilation and Vite build with zero errors.
2. **Linting**: Run `lint_applet` to guarantee type safety and formatting.
3. **Data Integrity**: Verify sample customer creation, validation boundaries (11-digit mobile, 13-digit meter number, duplicate SMS rejection), payment toggle, and deletion.
4. **Backup Compatibility**: Verify JSON export/import and CSV spreadsheet download with UTF-8 BOM.
5. **Cloud Sync**: Verify Firebase Auth connection check and real-time state listeners.
6. **Responsive Layout**: Test on mobile ($< 430\text{px}$) and desktop ($> 1024\text{px}$) breakpoints.
