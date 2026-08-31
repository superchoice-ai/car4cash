# การเปลี่ยน Backend / Database ไปยังโปรเจกต์ใหม่ (หลัง Remix)

- วันที่ตรวจสอบ: 2026-08-31 14:30 UTC (21:30 Asia/Bangkok)
- Branch ที่ทำงาน: `edit/edt-c6d54f93-5c65-4966-9b93-2956caf17906` (ไม่ใช่ `main`)
- Backend/DB ปัจจุบัน (ใหม่): project ref `immeymyueynzegvcmaki`, Postgres 17.6, database `postgres`
- ขอบเขต: ตรวจสอบว่าไม่มีค่าอ้างอิง backend/DB ของโปรเจกต์เดิมเหลืออยู่ + ยืนยันการทำงานของ backend/DB ใหม่ (read-only verification, ไม่มีการแก้ schema ในรอบนี้)

---

## 1. จุดที่เก็บค่า Backend / DB ทั้งหมดในโปรเจกต์นี้

| จุด | ไฟล์ / ที่เก็บ | ค่าที่ใช้ | สถานะ |
| --- | --- | --- | --- |
| ค่าเชื่อมต่อฝั่ง client (build-time) | `.env` → `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID` | ชี้ไป `immeymyueynzegvcmaki` | ถูกต้อง (ไฟล์นี้ระบบสร้างให้อัตโนมัติ ห้ามแก้มือ) |
| ค่าเชื่อมต่อฝั่ง server (runtime) | env: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | ชี้ไป `immeymyueynzegvcmaki` | ถูกต้อง (ผูกใหม่ด้วยเครื่องมือ rebind secrets) |
| Project ref ของ CLI/migration | `supabase/config.toml` | `project_id = "immeymyueynzegvcmaki"` | ถูกต้อง |
| Client ฝั่งเบราว์เซอร์ | `src/integrations/supabase/client.ts` | อ่านจาก `import.meta.env.VITE_*` | ไม่มี hardcode |
| Client ฝั่ง server (service role) | `src/integrations/supabase/client.server.ts` | อ่านจาก `process.env` | ไม่มี hardcode |
| Middleware ตรวจ token | `src/integrations/supabase/auth-middleware.ts` | อ่านจาก `process.env` | ไม่มี hardcode |
| Secrets ของ integration (LINE ฯลฯ) | ตาราง `public.integration_secrets` (ใน DB ใหม่) | 5 รายการ | อ่านผ่านฟังก์ชันแบบปกปิดเท่านั้น |

ผลการค้นทั้ง repository: **ไม่พบ URL / project ref / คีย์ ของโปรเจกต์เดิมค้างอยู่ในซอร์สโค้ดเลย** (ทุกจุดอ่านจาก environment)

---

## 2. ตารางยืนยันการทำงานของ Backend / DB ใหม่

| # | รายการตรวจ | วิธีตรวจ | ผลลัพธ์ | สถานะ |
| --- | --- | --- | --- | --- |
| 1 | ตัวแปร environment ฝั่ง server | ตรวจ `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | ตั้งค่าครบ ชี้ไปโปรเจกต์ใหม่ | ผ่าน |
| 2 | เชื่อมต่อฐานข้อมูล | query `current_database()`, `server_version` | `postgres`, 17.6 | ผ่าน |
| 3 | REST API (publishable key) | `GET /rest/v1/branches` | HTTP 200 | ผ่าน |
| 4 | Auth service | `GET /auth/v1/health` | HTTP 200 | ผ่าน |
| 5 | แอปพลิเคชันขึ้นได้ | `GET /auth` ของแอป | HTTP 200 | ผ่าน |
| 6 | Build / typecheck | build log ล่าสุด | `build OK` | ผ่าน |
| 7 | ตารางหลักอ่านได้ทั้งหมด | อ่าน 13 ตารางหลักผ่าน Data API | ตอบ 200 ทุกตาราง | ผ่าน |
| 8 | โครงสร้าง schema | นับตารางใน `public` | 26 ตาราง | ผ่าน |
| 9 | RLS policies | นับจาก `pg_policies` | 75 policies | ผ่าน |
| 10 | ตารางที่ไม่มี policy | ตรวจตารางที่ RLS เปิดแต่ไม่มี policy | มี 1 ตาราง: `integration_secrets` (ตั้งใจล็อกไว้ เข้าถึงผ่าน security-definer function เท่านั้น) | ผ่าน (ตามการออกแบบ) |
| 11 | Trigger ทำงานครบ | นับ trigger ที่ไม่ใช่ internal | 19 trigger (รวม `on_auth_user_created`) | ผ่าน |
| 12 | สมัครสมาชิก → สร้างโปรไฟล์/สิทธิ์ | เทียบ `auth.users` กับ `profiles` / `user_roles` | users 2 / profiles 7 / user_roles 7 (ครบทุกบัญชี) | ผ่าน |
| 13 | ข้อมูลธุรกิจคงอยู่ | นับข้อมูลจริง | สาขา 11, ลูกค้า 7, สัญญา 6, งวด 120, รับชำระ 62, สมุดเงินสด 71, คำขออนุมัติ 2, แจ้งเตือน 3 | ผ่าน |
| 14 | Integration secrets | นับใน `integration_secrets` | 5 รายการ (อ่านกลับเป็นค่าปกปิด) | ผ่าน |

สรุป: backend/DB โปรเจกต์ใหม่ **ทำงานครบทุกด้านที่ตรวจได้** (การเชื่อมต่อ, Data API, Auth, schema, RLS, trigger, ข้อมูล)

### สิ่งที่ยังต้องติดตาม (ไม่ใช่ปัญหาการเชื่อมต่อ)
- Security linter ค้าง 39 รายการจาก migration ก่อนหน้า (RLS-without-policy 1 รายการตามการออกแบบ + ฟังก์ชัน SECURITY DEFINER ที่ role `anon`/`authenticated` เรียกได้) — ต้องทำ impact review ก่อนแก้
- LINE Login callback URL ต้องลงทะเบียนใน LINE Developers Console ให้ตรงตัวกับโดเมนที่ใช้จริง

---

## 3. วิธีเปลี่ยนไปใช้ Backend / DB โปรเจกต์ใหม่ (ขั้นตอนละเอียด)

### ขั้นที่ 0 — Readiness gate
1. ยืนยัน branch ที่ทำงาน ต้องไม่ใช่ `main`
2. ตรวจสถานะผู้ให้บริการ (Lovable Cloud / Supabase) และบันทึกเวลา + timezone
3. ยืนยันว่าเจ้าของอนุญาต scope นี้ชัดเจน

### ขั้นที่ 1 — ผูกค่าเชื่อมต่อใหม่
ไม่ต้องแก้ `.env` หรือไฟล์ใน `src/integrations/supabase/` ด้วยมือ (เป็นไฟล์ที่ระบบสร้าง) ให้ใช้เครื่องมือผูก secrets ของแพลตฟอร์มเพื่อดึงค่าปัจจุบันมาใส่ให้ทั้ง:
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- และ `VITE_*` ฝั่ง client

จากนั้นรีสตาร์ท dev server เพื่อให้โค้ดฝั่ง server อ่านค่าใหม่

### ขั้นที่ 2 — ตรวจ project ref ของ migration
เปิด `supabase/config.toml` ให้ `project_id` ตรงกับ project ref ใหม่ ถ้าไม่ตรง migration จะถูกส่งไปผิดฐานข้อมูล

### ขั้นที่ 3 — ค้นหาค่าค้างของโปรเจกต์เดิม
ค้นทั้ง repository ด้วยคำค้น: project ref เดิม, `*.supabase.co`, `sb_publishable_`, โดเมน preview เดิม
ทุกจุดที่พบต้องถูกเปลี่ยนเป็นการอ่านจาก environment ไม่ใช่ hardcode

### ขั้นที่ 4 — ตรวจ schema และ trigger ในฐานข้อมูลใหม่
Remix จะคัดลอกโค้ดแต่ **trigger ในสคีมา `auth` อาจไม่ถูกคัดลอกมาด้วย** ให้ตรวจ:
- มี trigger `on_auth_user_created` บน `auth.users` เรียก `public.handle_new_user()` หรือไม่
- ถ้าไม่มี ต้องสร้างด้วย migration และ backfill บัญชีที่ยังไม่มี `profiles` / `user_roles`
- ตรวจตารางที่เปิด RLS แต่ยังไม่มี policy และ GRANT ของทุกตารางใน `public`

### ขั้นที่ 5 — ทดสอบใช้งานจริง (smoke test)
1. สมัครสมาชิกบัญชีทดสอบใหม่ (ห้ามใช้/แก้ข้อมูลเดิม) แล้วตรวจว่ามีแถวใน `profiles` และ `user_roles`
2. เข้าสู่ระบบ แล้วเปิดหน้า: แดชบอร์ด, ลูกค้า, คำขอสินเชื่อ, สัญญา, รับชำระ, การเงิน, อนุมัติ, รายงาน, ตั้งค่า
3. ทดสอบเขียนข้อมูลหนึ่งรายการ (สร้างใหม่เท่านั้น) และตรวจว่า audit log บันทึกถูกสาขา
4. เก็บ evidence ของทุกข้อ และเก็บข้อมูลทดสอบไว้จนได้รับอนุญาตให้ลบ

### ขั้นที่ 6 — ตั้งค่า integration ใหม่
คีย์ภายนอกทั้งหมด (LINE OA / LINE Login ฯลฯ) เก็บใน `integration_secrets` ของ **ฐานข้อมูลใหม่** จึงต้องกรอกใหม่ผ่านหน้าตั้งค่า และลงทะเบียน callback URL ของโดเมนใหม่ที่ผู้ให้บริการภายนอก

### ขั้นที่ 7 — ก่อน publish
ตรวจว่าไม่มีข้อมูล/ไฟล์ทดสอบตกค้าง, typecheck/build ผ่าน, merge เข้าสู่ `main` ตามขั้นตอน review แล้วจึง publish เมื่อเจ้าของอนุญาตอย่างชัดเจน

---

## 4. Rollback
- ค่าเชื่อมต่อ: ผูก secrets กลับไปยัง project ref เดิม + แก้ `supabase/config.toml` แล้วรีสตาร์ท dev server
- Schema: migration ที่รันในรอบนี้เป็นการ "สร้าง trigger + backfill" หากต้องย้อน ให้ลบ trigger ที่สร้างและคง profile ที่ backfill ไว้ (ไม่ลบข้อมูลผู้ใช้)
- ไม่มีการแก้ข้อมูลธุรกิจเดิมในรอบตรวจสอบนี้ จึงไม่ต้อง rollback ข้อมูล
