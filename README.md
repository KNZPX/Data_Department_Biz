# Power BI Portal — Standalone Catalog & License Manager

ระบบจัดการรายงาน Power BI, รายการแดชบอร์ด, วิเคราะห์ช่องว่างรหัสรายงาน (Code Series Gap Tracking), ประวัติการเผยแพร่ (Publish Version History), และบริหารจัดการสิทธิ์การใช้งาน (License & Capacity 32 คอลัมน์)

---

## 🚀 ฟีเจอร์หลัก (Key Features)

1. **Reports & Dashboards Catalog**
   - แสดงรายการรายงานและแดชบอร์ดจาก Workspace ที่กำหนด
   - ค้นหาและกรองตาม Workspace หรือหมวดหมู่รายงาน (Code Series Prefix)
   - วิเคราะห์ช่องว่างของรหัสรายงาน (Report Code Series Gap Tracker) และช่วงรหัสที่ยังไม่ถูกใช้งาน
   - ปุ่ม Ticket Link สำหรับเปิดรายงานทันที
   - ส่งออกข้อมูลเป็นไฟล์ Excel (.xlsx)

2. **Publish Version History (`DashboardLogModal`)**
   - บันทึกและตรวจสอบประวัติการแก้ไขและเผยแพร่รายงาน (Publish Log)
   - รองรับการสลับมุมมองระหว่าง **Table View** และ **Timeline View**

3. **Licenses & Capacity (โครงสร้าง 32 คอลัมน์)**
   - จัดการสิทธิ์การใช้งาน Power BI Pro / Premium Capacity แบบครบถ้วน
   - ระบบ **Permission Matrix Explorer** ตรวจสอบสิทธิ์รายกลุ่ม (Executive, Marketing, HOD, STG, Admin, Quality)
   - นำเข้า (Import) และส่งออก (Export) ข้อมูลผ่านไฟล์ Excel (.xlsx) พร้อมระบบ Auto Column Mapping
   - ฟอร์มเพิ่ม/แก้ไขสิทธิ์ผู้ใช้งาน

4. **Dedicated Database (ระบบฐานข้อมูลอิสระ)**
   - ใช้งาน **Local SQLite Engine** (`powerbi.db`) เป็นค่าเริ่มต้นผ่าน `bun:sqlite` รันได้ทันทีโดยไม่ต้องตั้งค่าฐานข้อมูลภายนอก
   - รองรับ **Dual-Engine Architecture**: สามารถสลับไปใช้ **PostgreSQL / Supabase** ได้ทันทีผ่าน `.env.local`
   - เตรียม DDL Schema ให้ครบทั้ง `database/schema.sqlite.sql` และ `database/schema.sql`

5. **Microsoft Power BI Authentication**
   - รองรับ Azure OAuth 2.0 PKCE Flow
   - มีระบบ Manual Access Token Paste สำหรับใช้งานทันที

---

## 🛠️ เทคโนโลยีที่ใช้ (Tech Stack)

- **Framework**: Next.js 16.2.6 (App Router) + React 19
- **Styling**: Tailwind CSS 4
- **Runtime & Package Manager**: Bun
- **Database**: SQLite (`bun:sqlite`) / Supabase (`@supabase/supabase-js`)
- **Excel Processing**: ExcelJS
- **Icons**: Lucide React

---

## 📦 โครงสร้างโฟลเดอร์ (Directory Structure)

```
PowerBI_Portal/
├── database/
│   ├── schema.sqlite.sql       # DDL สำหรับ SQLite Database
│   └── schema.sql              # DDL สำหรับ PostgreSQL / Supabase
├── scripts/
│   ├── init-db.ts              # สคริปต์ Initialize ตาราง SQLite
│   └── migrate-from-timesheet.ts # สคริปต์ Migration ข้อมูล
├── src/
│   ├── app/                    # Next.js App Router (Pages & API Routes)
│   ├── components/             # Reusable UI & Feature Modals
│   └── lib/                    # Core Database, Auth, Types, and Sync Logic
├── .env.example
├── package.json
└── tsconfig.json
```

---

## ⚙️ การติดตั้งและเริ่มต้นใช้งาน (Getting Started)

### 1. ติดตั้ง Dependencies
```bash
bun install
```

### 2. ตั้งค่า Environment Variables
คัดลอกไฟล์ `.env.example` เป็น `.env.local`:
```bash
cp .env.example .env.local
```
กำหนดค่าที่จำเป็น เช่น:
```env
# Azure OAuth 2.0 PKCE
AZURE_CLIENT_ID=your_client_id
AZURE_TENANT_ID=your_tenant_id

# Database Provider ('sqlite' หรือ 'supabase')
DATABASE_PROVIDER=sqlite
```

### 3. รันโปรเจกต์ (Development Mode)
```bash
bun run dev
```
เปิดเบราว์เซอร์ไปที่: **http://localhost:3005**

---

## 🏗️ Build สำหรับ Production
```bash
bun run build
bun run start
```
