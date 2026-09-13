# Lovable AI, MCP, /assistant และ AI Mode — Implementation Reference

> เอกสารอ้างอิงสำหรับ AI/นักพัฒนาที่ต้องทำงานลักษณะเดียวกันใน Lovable  
> สกัดจาก Lovable History ของโปรเจกต์ Car4Cash Demo ตั้งแต่ข้อความ **“เปิดใช้งาน AI สำหรับโปรเจกต์นี้”** จนถึง **“fix: bind LINE assistant to chat-tools AI mode”** และตรวจเทียบกับโค้ด/commit ใน GitHub  
> วันที่สกัดหลักฐาน: 2026-09-13  
> Source project: `superchoice-ai/car4cash`  
> Source integration commit: `14a93ed04f5c8046b9f659b182f5e6f26e08ce6d`

## 1. วิธีอ่านเอกสารนี้อย่างถูกต้อง

เอกสารนี้แยกข้อมูลสามระดับเพื่อป้องกัน AI อ้างผลเกินหลักฐาน:

1. **Observed** — พบใน Lovable History หรือ GitHub diff จริง
2. **Verified** — มีคำสั่งพร้อม exit code หรือมีโค้ดใน commit ที่ตรวจได้
3. **Recommended** — แนวทางใช้ซ้ำ ต้องปรับตาม schema, framework, package manager และ governance ของ repo เป้าหมาย

ห้ามถือข้อความ “เสร็จแล้ว” หรือ preview ที่แสดงผลได้ว่าเท่ากับ build/typecheck ผ่าน ถ้าไม่มี command, working directory, commit/branch และ exit code

## 2. ลำดับวิวัฒนาการที่สกัดได้

### 2.1 เปิด Lovable AI Gateway

**Observed — 1 ก.ย. 20:39**

คำสั่งผู้ใช้: “เปิดใช้งาน AI สำหรับโปรเจกต์นี้”

Lovable ตรวจ/เตรียม secret `LOVABLE_API_KEY` และรายงานว่า AI Gateway พร้อมใช้งาน

**บทเรียน**

- API key ต้องอยู่ฝั่ง server เท่านั้น
- ห้ามส่ง key ไป client, log, response หรือ commit
- ก่อนสร้าง UI ให้พิสูจน์ว่า server อ่าน key ได้
- หาก key ไม่มี ให้ fail แบบชัดเจน เช่น “ยังไม่ได้เปิดใช้งาน AI สำหรับโปรเจกต์นี้”
- การที่ secret ถูกตั้งค่าแล้ว ยังไม่พิสูจน์ว่า model call, build หรือ end-to-end flow ใช้งานได้

### 2.2 สร้างหน้า `/assistant` รุ่นแรก

**Observed — 1 ก.ย. 20:46; Lovable ระบุ Build unsuccessful**

โครงสร้างที่ทำ:

- `src/lib/assistant.functions.ts`
  - server function `askAssistant`
  - ใช้ `requireSupabaseAuth`
  - รับข้อความและ branch scope
  - ทำงานในตัวตนของผู้ใช้จริง
- `src/routes/_authenticated/assistant/index.tsx`
  - chat UI
  - scope/role badges
  - popular questions
  - Enter-to-send และ page metadata
- model ที่ระบุใน implementation: `google/gemini-3.7-flash`
- system prompt ภาษาไทย ครอบคลุมคู่มือการใช้งาน
- ข้อมูลที่ตั้งใจอ่าน: ลูกค้า สัญญา ยอดคงเหลือ งวดค้าง ใบเสร็จ สมุดเงินสด งานติดตาม และคำขออนุมัติ
- ผู้ใช้สาขาถูกบังคับให้เห็นเฉพาะสาขาตนเอง

**สิ่งที่ยังไม่ควรอ้างว่าผ่านในจุดนี้**

- History ระบุ Build unsuccessful
- ยังไม่ได้ตรวจ build log/typecheck จนครบ
- ยังไม่ได้ live-test `askAssistant`

### 2.3 เพิ่ม OAuth-protected MCP

**Observed — 3 ก.ย. 21:22; Lovable ระบุ Build unsuccessful**

องค์ประกอบ:

- dependency: `@lovable.dev/mcp-js` และ `zod`
- MCP server ใน `src/lib/mcp/index.ts`
- Supabase client แบบ user-token ใน `src/lib/mcp/supabase.ts`
- OAuth 2.1 consent route ที่ `/.lovable/oauth/consent`
- endpoint `/mcp`
- protected-resource metadata ที่ `/.well-known/oauth-protected-resource`
- route tree ที่ต้องมีทั้ง MCP และ OAuth metadata
- manifest ที่ `.lovable/mcp/manifest.json`

เครื่องมืออ่านอย่างเดียวรุ่นแรก 7 ตัว:

1. `list_branches`
2. `portfolio_summary`
3. `search_customers`
4. `list_contracts`
5. `get_contract`
6. `list_overdue_installments`
7. `list_pending_approvals`

ข้อกำหนดด้านข้อมูล:

- query ด้วย token ของผู้ใช้ เพื่อให้ RLS บังคับสิทธิ์
- ห้ามใช้ service-role เป็นทางลัดใน MCP tool
- จำนวนเงินที่คืนให้ AI ควรแปลงเป็นบาทอย่างชัดเจน
- ไม่คืนข้อมูลอ่อนไหวที่ไม่จำเป็น เช่นเลขบัตรประชาชน
- tool ทุกตัวควรประกาศ read-only/idempotent annotation และ validate input

**งานค้างที่ History ระบุในจุดนี้**

- ตรวจ redirect ของ Google/LINE auth
- extract MCP manifest
- typecheck/build
- ทดสอบ consent route และ MCP connection จริง

### 2.4 ใช้ registry เดียวร่วมกันระหว่าง MCP และ `/assistant`

**Observed — 4 ก.ย. 18:21; เครดิตหมดก่อน build/test**

เพิ่ม:

- `list_cash_entries`
- `list_payments`

รวมเป็น 9 read-only tools และสร้าง `src/lib/mcp/registry.ts` เป็น shared registry

รูปแบบที่ควรใช้:

```text
UI /assistant ─┐
               ├─> shared assistant core ─> shared read-only tool registry ─> user-scoped Supabase/RLS
LINE endpoint ─┘
External AI ─────> OAuth-protected /mcp ────────────────────────────────────────┘
```

ประโยชน์:

- tool name/schema/handler มีแหล่งจริงเพียงชุดเดียว
- หน้าเว็บ, LINE และ external MCP ได้ผลลัพธ์/สิทธิ์สอดคล้องกัน
- ลดความเสี่ยงที่ช่องทางหนึ่งหลุด branch scope หรือเรียก tool คนละเวอร์ชัน

ข้อห้าม:

- อย่าให้ AI เขียน SQL อิสระ
- อย่าสร้าง handler สำเนาแยกต่อ channel
- อย่าให้ model เลือกข้าม RLS
- อย่าเชื่อ branch ID จาก model โดยไม่ override ตามสิทธิ์ผู้ใช้

### 2.5 แยก shared assistant core และ LINE adapter

**Observed — 6 ก.ย.; รอบแรกทำบางส่วน แล้วรอบถัดไปรายงานว่าทำครบ**

โครงสร้าง:

- `src/lib/assistant.server.ts`
  - sanitize conversation
  - จำกัดจำนวน turns/tool rounds
  - รวบรวม role/home branch
  - สร้าง ToolContext จาก token ที่ตรวจแล้ว
  - แปลง Zod schema เป็น function schema
  - รัน tool loop
  - คืน `answer`, `scopeName`, `roles`, `toolsUsed`
- `assistant.functions.ts`
  - adapter บางสำหรับหน้า `/assistant`
- `src/routes/api/public/line/assistant.ts`
  - internal adapter สำหรับ n8n/LINE
  - ตรวจ shared secret ก่อนเปิดเผยสถานะระบบ
  - map LINE user ID ไป auth user
  - ตรวจ active/role
  - ออก token ชั่วคราวและรันผ่าน RLS
  - normalize error code
  - คืน `answer`, `toolsUsed`, `replyToken`

เหตุผลที่ LINE ไม่เรียก `/mcp` ตรง:

- `/mcp` ต้องใช้ OAuth ต่อผู้ใช้
- n8n webhook ไม่ได้มี browser login/consent flow ของผู้ใช้
- จึงควรมี internal adapter ที่ยืนยัน n8n ด้วย secret แล้วเปลี่ยนกลับไปทำงานในตัวตนของผู้ใช้ที่ map ได้
- secret ต้องเก็บสองฝั่งอย่างปลอดภัยและห้ามใส่ค่าจริงในเอกสาร/commit/log

LINE identity reconciliation ที่ปลอดภัย:

1. ค้นจาก `line_user_id` ก่อน
2. ตรวจว่า Auth UUID ที่ผูกไว้ยังอยู่
3. ถ้า profile orphan ห้ามคืน role/branch เก่าอัตโนมัติ
4. หากยังไม่ผูก จึงค้นด้วยอีเมลที่ LINE ยืนยันแล้ว
5. ตรวจ Auth user ของทุก candidate
6. ถ้ามีหลาย candidate หรือ LINE ID ผูกกับบัญชีอื่น ให้หยุดและให้ Admin ตรวจ
7. ถ้าต้องสร้างใหม่ ให้สร้าง Auth UUID ใหม่ ไม่ reuse UUID orphan
8. ผูก profile/sync metadata แล้วจึงสร้าง login link

การแก้ callback ใน History ถูกจำกัดไว้หนึ่งไฟล์ และยังไม่ได้ typecheck/live-test ในรอบนั้น จึงต้องถือเป็น **unverified จนกว่าจะมีหลักฐานเพิ่ม**

## 3. AI Mode ที่ถูกต้อง

**Verified จาก GitHub commit `14a93ed`**

สาม mode:

| Key | Channel | จุดบังคับหลัก |
|---|---|---|
| `assistant` | หน้า `/assistant` | adapter และ shared assistant core |
| `external_mcp` | external AI ผ่าน `/mcp` | MCP route ก่อนเรียก handler |
| `chat_tools` | LINE/n8n หรือ chat adapter | หลังตรวจ shared secret และใน shared core |

แนวทาง implementation:

- เก็บค่าใน setting กลาง เช่น `system_settings.ai_modes`
- normalize unknown/missing value ด้วย default ที่กำหนดชัด
- อ่านค่าฝั่ง server ใหม่ทุก request เพื่อให้สวิตช์มีผลจริง
- หน้า Admin แสดง toggle แต่ UI ไม่ใช่ security boundary
- บังคับที่ endpoint เพื่อ fail เร็ว
- บังคับซ้ำใน shared execution core แบบ defense in depth
- บังคับให้ caller ส่ง `channel` ผ่าน TypeScript type เพื่อลดโอกาส caller ใหม่ลืม gate
- เมื่อปิด external MCP ให้คืน 503
- LINE ตรวจ shared secret ก่อนตรวจ/เปิดเผยว่า mode ถูกปิด
- ค่า default ต้องพิจารณาความเข้ากันได้เดิมและนโยบาย security/cost ของแต่ละ repo; ห้าม copy default โดยไม่ทำ impact review

## 4. MCP generated artifacts: จุดที่เคยพลาดและวิธีป้องกัน

**Observed — 11 ก.ย.**

การแก้ build ครั้งแรกชี้ MCP plugin ไป entry ที่ไม่มีอยู่ ทำให้ build ผ่านชั่วคราว แต่กระทบ generated artifacts:

- `.lovable/mcp/manifest.json` ถูกลบ
- `src/routes/[.well-known]/oauth-protected-resource.ts` ถูกลบ
- `src/routeTree.gen.ts` เปลี่ยนเพราะ route หาย

แนวทางแก้ที่ยืนยันภายหลัง:

- restore manifest
- restore OAuth protected-resource route
- regenerate route tree ให้มี OAuth route และ `/mcp`
- คง `src/routes/mcp.ts` แบบ manual เพื่อ gate `external_mcp`
- ถอด `mcpPlugin()` ออกจาก build สำหรับ repo นี้
- ลบ AUTO-GENERATED banner ของ route ที่ต้อง take ownership ตามพฤติกรรม plugin
- เก็บ generated snapshots ที่จำเป็นไว้ใน repo
- เมื่อ tool เปลี่ยน ต้องรัน extract-manifest แยกและ review diff

**กฎทั่วไป**

อย่า copy วิธี “ถอด plugin” ไปทุก repo โดยอัตโนมัติ ให้ตรวจเวอร์ชัน plugin และ ownership model ของ repo ก่อน แต่ห้ามแก้ปัญหา overwrite ด้วย nonexistent entry เพราะอาจลบ artifact เงียบ ๆ หรือสร้าง endpoint bypass

หลัง build ต้องตรวจ diff อย่างน้อย:

- manifest ยังอยู่
- OAuth metadata route ยังอยู่
- route tree มี route ที่ต้องใช้
- มี MCP endpoint เดียว
- ไม่มี generated bypass endpoint
- manual gate ไม่ถูก overwrite

## 5. ลำดับทำงานมาตรฐานสำหรับ AI ใน Lovable

### Phase A — Readiness Gate

1. ยืนยัน repo, branch, HEAD SHA และ working directory
2. อ่าน `AGENTS.md` และ Markdown ทุกไฟล์ตาม governance ของ repo
3. ตรวจ package manager จาก lockfile/scripts จริง
4. ตรวจ framework/version และคำสั่ง build จริง
5. inventory auth, roles, branches, RLS, settings, routes, generated files และ secrets names
6. ถ้า branch ที่แก้พิสูจน์ไม่ได้ หรือ Lovable จะ sync ไป branch ต้องห้าม ให้หยุดโดยไม่แก้

### Phase B — Impact Review

จัดทำ source-to-target map ก่อนแก้:

- AI gateway/server secret
- authenticated assistant route
- shared assistant core
- tool registry
- user-scoped DB client/RLS
- OAuth/MCP endpoint
- consent/metadata/manifest/route tree
- LINE/n8n adapter
- Admin AI Mode controls
- migrations ที่จำเป็น
- build/typecheck/preview/E2E

ระบุสิ่งที่ ported, adapted, omitted พร้อมเหตุผล ห้าม bulk-copy repo อื่นทับไฟล์เป้าหมาย

### Phase C — Implement จากแกนกลางออกสู่ adapters

1. สร้าง tool registry แบบ read-only
2. ทำ user-scoped DB context และ branch enforcement
3. สร้าง shared assistant core
4. ต่อ `/assistant`
5. ต่อ OAuth-protected MCP
6. ต่อ LINE/internal adapter
7. เพิ่ม AI Mode server gates
8. เพิ่ม Admin UI เฉพาะเมื่อ authorization/RLS ฝั่ง server พร้อม
9. refresh generated artifacts ตามวิธีของ repo

### Phase D — Validation

ใช้คำสั่งของ repo จริงและรายงานทุก exit code ตัวอย่างสำหรับ source repo นี้:

```bash
bunx tsgo --noEmit
bun run build
bun run build:dev
```

ถ้า repo ใช้ npm และมี lockfile ที่สอดคล้อง ให้ใช้คำสั่ง npm ของ repo เช่น:

```bash
npm ci
npx tsc --noEmit
npm run build
npm run build:dev
```

ห้ามสลับ bun/npm หรืออ้างคำสั่งจาก repo อื่นโดยไม่ตรวจ lockfile

จากนั้นตรวจ:

- git status/diff
- generated artifacts
- route inventory
- ไม่มี secret ใน diff/log
- ไม่มี write tool
- branch/HQ scope
- mode OFF ของทั้งสาม channel
- inactive/no-role user
- OAuth consent
- external MCP connect
- `/assistant` tool call
- LINE known/unknown/conflict user
- normalized error และไม่มีข้อมูลเกินสิทธิ์

ถ้ายังไม่ได้รันจริง ให้เขียน “NOT RUN” หรือ “UNVERIFIED” ห้ามเขียน “ผ่าน”

## 6. Security invariants

- AI ต้องอ่านข้อมูลเท่าที่ user ปัจจุบันมีสิทธิ์
- RLS เป็น enforcement หลัก; prompt และ UI เป็นเพียงชั้นเสริม
- branch user ต้องถูก force เป็น home branch
- service role ใช้ได้เฉพาะงาน identity/admin ที่จำเป็นและต้องแยกจาก data-query path
- tool registry สำหรับ assistant/MCP ต้อง read-only เว้นแต่เจ้าของอนุมัติ write capability โดยเฉพาะ
- ห้าม model สร้าง/แก้/ลบ/อนุมัติ/ชำระเงิน
- sanitize input, จำกัด turns, จำกัด tool rounds, จำกัด output size
- validate tool arguments ด้วย schema
- ไม่คืน national ID, token, secret หรือข้อมูลอ่อนไหวที่ไม่จำเป็น
- shared-secret compare ควรป้องกัน timing attack
- ตรวจ secret ก่อนคืน operational state
- AI Mode ต้องบังคับฝั่ง server และ shared core
- OAuth metadata, consent, manifest และ route tree ถือเป็นส่วนหนึ่งของ feature ไม่ใช่ของตกแต่ง

## 7. Prompt template สำหรับรอบพัฒนาถัดไป

```text
ทำงานเฉพาะ repo <owner/repo> branch <branch> ที่ HEAD <sha>
ห้าม main/merge/PR/publish/deploy/production DB/n8n/LINE config/secrets เว้นแต่ระบุอนุญาตแยก

ก่อนแก้:
1. อ่าน AGENTS.md และ .MD ทุกไฟล์ตาม governance
2. ยืนยัน repo/branch/HEAD/working directory/package manager
3. ทำ impact map ของ AI Gateway, /assistant, shared core, MCP registry,
   OAuth consent/metadata/manifest/route tree, LINE adapter และ AI Mode
4. หยุดทันทีถ้าพิสูจน์ branch ไม่ได้

ข้อกำหนด:
- shared read-only tool registry ชุดเดียว
- user token + RLS + forced branch scope
- ห้าม service-role สำหรับ business-data tool query
- AI Mode แยก assistant/external_mcp/chat_tools
- gate ที่ endpoint และ shared core
- ห้ามสร้าง MCP bypass endpoint
- รักษา generated artifacts และตรวจ diff หลัง build
- ห้ามใส่ secret จริงใน code/log/report

Validation:
- install/typecheck/build/build:dev ตาม package manager ของ repo
- รายงานคำสั่ง, working directory และ exit code จริงทุกคำสั่ง
- ตรวจ diff/route/manifest/OAuth artifacts
- ถ้าไม่ได้รัน ให้ระบุ NOT RUN; ห้ามอ้างผ่าน
```

## 8. Provenance และข้อจำกัดของ reference

Lovable History เป็นหลักฐานลำดับการสนทนาและสิ่งที่ agent รายงาน แต่หลายช่วงจบด้วยเครดิตหมดหรือ Build unsuccessful จึงไม่ใช่หลักฐานการทำงานสำเร็จด้วยตัวมันเอง

ปลายช่วงตรวจยืนยันกับ GitHub commit:

- [Car4Cash integration commit 14a93ed](https://github.com/superchoice-ai/car4cash/commit/14a93ed04f5c8046b9f659b182f5e6f26e08ce6d)
- commit message รวม:
  - `fix: enforce AI mode in shared assistant core`
  - `fix: bind in-app assistant to its AI mode`
  - `fix: bind LINE assistant to chat-tools AI mode`

เอกสารนี้เป็น reference ไม่ใช่คำอนุมัติให้ execute migration, เปลี่ยน secret, ต่อ connector, publish หรือ deploy
