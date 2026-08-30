# ตั้งเครื่องใหม่

ใช้งานจริงมี 3 ขั้น จบ — หลังจากนั้นระบบดูแลตัวเอง ไม่ต้องสั่งสคริปต์อะไรอีก

```powershell
git clone <repo> wastebuy_e     # 1. ดึงโค้ด
cd wastebuy_e
notepad .env                     # 2. ใส่รหัสผ่านฐานข้อมูล (คัดลอกจาก .env.example)
npm run setup                    # 3. ติดตั้ง + สร้างตาราง/view ทั้งหมด
npm start                        #    เปิดใช้งาน
```

เปิด http://localhost:3000

`npm start` เปิดทั้งสองส่วนให้เอง (ตัวคุยฐานข้อมูล + หน้าเว็บ) ปิดด้วย Ctrl+C ทีเดียว
ไม่ต้องเปิดสอง terminal เหมือนเดิม

**หลังจากนี้ไม่ต้องสั่งอะไรอีก** — ข้อมูลเข้าใหม่เมื่อไร ระบบตรวจเจอเองภายใน 15 นาที
แล้วคำนวณตัวเลขใหม่ให้เบื้องหลัง หน้าแรกมีแถบบอกสถานะและปุ่มสั่งคำนวณทันทีถ้าไม่อยากรอ

## เครื่องที่มีข้อมูลอยู่แล้ว

```powershell
git pull
npm run setup
npm start
```

`setup.ps1` ตรวจเจอเองว่าฐานมีข้อมูลแล้ว ข้ามการกู้ dump ไปสร้างเฉพาะของที่เพิ่มใหม่

อยากได้หน้า Zone ด้วย ต้องมีไฟล์จาก repo automation:

```powershell
.\scripts\setup.ps1 -ZoneSql D:\zone_analysis_20260829.sql
```

## สำหรับคนที่แก้โค้ด

```powershell
npm run dev        # terminal 1 — API :4000 (รีสตาร์ทเองเมื่อแก้ไฟล์)
npm run dev:web    # terminal 2 — เว็บ :3000
```

---

## เครื่องเปล่าที่ยังไม่มีฐานข้อมูล

```powershell
git clone <repo> wastebuy_e
cd wastebuy_e
.\scripts\setup.ps1 -DumpFile D:\wastebuy-seed-20260829.dump
```

---

## ต้องมีอะไรก่อน

| อย่าง | เวอร์ชัน | หมายเหตุ |
|---|---|---|
| Node.js | 18+ | ทดสอบบน 24 |
| PostgreSQL | 15+ | ต้องมี `psql` และ `pg_restore` |
| ไฟล์ dump | — | **เฉพาะเครื่องเปล่า** เครื่องที่มีข้อมูลแล้วไม่ต้องใช้ |

`setup.ps1` หา `psql.exe` ใน `C:\Program Files\PostgreSQL\*\bin\` ให้เองถ้าไม่ได้อยู่ใน PATH

---

## สิ่งที่เพิ่มมารอบนี้ (เครื่องเก่าต้องลง)

| อย่าง | มาจาก | จำเป็น |
|---|---|---|
| `v_driver_performance` และ view คนขับอีก 5 ตัว | `database/driver_performance.sql` (อยู่ใน repo) | ใช่ — หน้า Driver Performance |
| index `weight_query_driver_idx` | ไฟล์เดียวกัน | ใช่ — ไม่มีแล้วช้ามาก |
| `v_item_price_benchmark` (materialized) | ไฟล์เดียวกัน | ใช่ |
| `stations` `district_centroids` `booking_queue` `vehicle_station_map` + 7 view | `zone_analysis_*.sql` จาก repo automation | เฉพาะหน้า Zone |
| ชื่อคอลัมน์ `weight_query` / `weight_query_station` ที่ตรงความหมาย | `database/rename_columns.sql` (อยู่ใน repo) | ใช่ — ไม่ทำ query ที่ใช้ชื่อใหม่จะพัง |
| 4 คอลัมน์ที่เคยถูกทิ้งตอน import (`customer_group` `station` `ghg` `trees`) | `database/add_weight_query_columns.sql` | ใช่ — ค่าจะเข้ามาตอน re-import |
| `recurring_jobs` `recurring_job_members` `recurring_schedule` `holidays` + 7 view | `database/recurring_jobs.sql` (อยู่ใน repo) | ใช่ — หน้า Recurring Jobs |
| `item_category_overrides` `ai_runs` `ai_monthly_summary` + 10 view | `database/analysis_v2.sql` | ใช่ — หน้า Member Insight / Station Compare / Data Quality |
| materialized view 13 ตัว + `refresh_analysis_cache()` | `database/analysis_cache.sql` | ใช่ — ไม่มีแล้วหน้าคนขับใช้เวลา 54 วินาที |
| index `weight_query_date_location_idx` | ไฟล์เดียวกัน | ใช่ — ไม่มีแล้วหน้าปฏิทิน timeout |

`setup.ps1` ลงตัวที่อยู่ใน repo ให้อัตโนมัติ ตัว zone ต้องส่งไฟล์มาด้วย `-ZoneSql`

---

## ทำไมเครื่องเปล่าต้องมี dump

repo สร้างฐานข้อมูลเองไม่ได้:

- `database/create_table.sql` สร้างได้ **14 จาก 25 ตาราง** ที่โค้ดใช้จริง
- และมันอ้าง `thai_provinces` `thai_tambons` `thai_geographies` ที่ตัวเองไม่ได้สร้าง
- ข้อมูลอ้างอิงไม่ได้อยู่ใน git เลย — `thai_tambons` 7,451 แถว · `thai_amphures` 929 · `materials` 112 · `lookup_provinces` 77
- ข้อมูลจริง `weight_query` 1.3M แถว ใหญ่เกินกว่าจะเก็บใน git

**บนเครื่องที่ใช้งานอยู่:**

```powershell
.\scripts\dump-seed.ps1
```

ได้ไฟล์ `wastebuy-seed-<วันที่>.dump` เอาไปเครื่องใหม่ผ่าน USB / network share
**ห้าม commit** — ไฟล์ใหญ่และมีข้อมูลลูกค้าจริง

---

## setup.ps1 ทำอะไรบ้าง

1. ตรวจว่ามี `node` `npm` `psql`
2. `npm ci` (หรือ `npm install` ถ้าไม่มี lock file)
3. คัดลอก `.env.example` เป็น `.env` ถ้ายังไม่มี — **ต้องใส่ `DB_PASSWORD` เอง**
4. สร้างฐานข้อมูลถ้ายังไม่มี (ไม่ลบของเดิม)
5. `pg_restore` จาก dump — ถ้าฐานมีตารางอยู่แล้วจะถามยืนยันก่อนเขียนทับ
6. รัน `database/rename_columns.sql` + `add_weight_query_columns.sql` ตั้งชื่อคอลัมน์
7. รัน `database/driver_performance.sql` สร้าง view ผลงานคนขับ
8. รัน `database/recurring_jobs.sql` สร้างตารางงานประจำ วันหยุด และ view สถานะ
9. รัน `database/analysis_v2.sql` + `analysis_cache.sql` + `station_coords.sql`
10. ตรวจว่าตาราง/view ที่จำเป็นครบไหม แล้วรายงานจำนวนแถว

รันซ้ำได้ ไม่ลบอะไรทิ้งโดยไม่ถาม

ตัวเลือก:

```powershell
.\scripts\setup.ps1 -SkipInstall              # ข้าม npm
.\scripts\setup.ps1 -SkipDatabase             # แค่ npm + .env
.\scripts\setup.ps1 -DbHost 10.0.0.5 -DbUser app
```

---

## ลำดับการโหลด SQL — สำคัญ

ถ้าโหลดข้อมูลใหม่จาก repo automation ต้องเรียงแบบนี้เสมอ:

```powershell
psql -v ON_ERROR_STOP=1 -d wastebuy-analytics -f database
ename_columns.sql
psql -v ON_ERROR_STOP=1 -d wastebuy-analytics -f databasedd_weight_query_columns.sql
psql -v ON_ERROR_STOP=1 -d wastebuy-analytics -f data\sql\zone_analysis_<วันที่>.sql
psql -v ON_ERROR_STOP=1 -d wastebuy-analytics -f database\driver_performance.sql
psql -v ON_ERROR_STOP=1 -d wastebuy-analytics -f database\recurring_jobs.sql
psql -v ON_ERROR_STOP=1 -d wastebuy-analytics -f database\analysis_v2.sql
psql -v ON_ERROR_STOP=1 -d wastebuy-analytics -f database\analysis_cache.sql
psql -v ON_ERROR_STOP=1 -d wastebuy-analytics -f database\station_coords.sql
```

`analysis_cache.sql` ต้องเป็นไฟล์สุดท้ายเสมอ — มันทำ materialized view ทับ view
ของทุกไฟล์ก่อนหน้า รันก่อนจะได้ cache ของที่ยังไม่มี

`rename_columns.sql` ต้องมาก่อนทุก view — ชื่อคอลัมน์เดิมเลื่อนไป 1 ช่อง
(`customer_name` เก็บชื่อคนขับ, `price_per_kg` เก็บน้ำหนักสุทธิ) view ที่สร้างไว้ก่อน
เปลี่ยนชื่อยังทำงานต่อได้เพราะ PostgreSQL ตามการ rename ให้เอง แต่ไฟล์ .sql
ที่ยังเขียนชื่อเก่าจะรันไม่ผ่าน

`zone_analysis` ขึ้นต้นด้วย `DROP TABLE ... CASCADE` ซึ่งลบ view ที่อ้าง
`booking_queue` / `vehicle_station_map` ไปด้วย — ทั้ง view ของ `driver_performance`
และ `v_recurring_status` ที่ใช้ตัดสินสถานะงานประจำ ถ้ารันสลับกัน หน้า Driver Performance
จะขึ้นว่ายังไม่ได้สร้าง view และสถานะงานประจำจะหายไป
(ตัว `zone_analysis` จะ `RAISE NOTICE` เตือนตอนจบให้)

ข้อมูลในตารางงานประจำไม่หาย — `recurring_jobs.sql` ใช้ `CREATE TABLE IF NOT EXISTS`
กับ `CREATE OR REPLACE VIEW` ตลอด รันซ้ำได้ไม่ลบของเดิม

**หลังโหลดข้อมูลเดือนใหม่ — ไม่ต้องทำอะไร**

ระบบดูแลตัวเอง: `server.js` ตรวจทุก 15 นาทีว่าข้อมูลต้นทางเปลี่ยนไหม
(นับแถว + วันล่าสุดของ `weight_query` และ `booking_queue`) เปลี่ยนเมื่อไร
คำนวณ cache ใหม่เบื้องหลังให้เอง ใช้ `REFRESH ... CONCURRENTLY` คนที่เปิดหน้าอยู่
ยังเห็นตัวเลขเดิมได้ระหว่างคำนวณ ไม่ค้าง

หน้าแรกมีแถบบอกว่าตัวเลขตรงกับข้อมูลล่าสุดหรือยัง พร้อมปุ่ม "คำนวณใหม่เดี๋ยวนี้"
ถ้าไม่อยากรอรอบตรวจถัดไป

ตั้งค่าได้ใน `.env`:
- `CACHE_CHECK_MINUTES=15` — ความถี่ในการตรวจ
- `CACHE_AUTO_REFRESH=0` — ปิดการคำนวณอัตโนมัติ (แล้วสั่งเองด้วย
  `.\scripts\refresh-cache.ps1` ซึ่งยังใช้ได้ตามเดิม ~80 วินาที)

ทำไมต้อง cache — วัดจริงบนเครื่อง dev ก่อนทำ:

| view | อ่านสด | อ่านจาก cache |
|---|---|---|
| `v_driver_performance` | 53.8 วิ | 15 ms |
| `v_month_facts` | 18.7 วิ | 5 ms |
| `v_zone_member_summary` | 18.4 วิ | 17 ms |
| `v_member_rfm` | 13.8 วิ | 435 ms |
| `v_station_performance` | 4.8 วิ | 3 ms |

ทั้งหมดอ่าน `weight_query` 1.3 ล้านแถวสดทุกครั้งที่มีคนเปิดหน้า
ข้อมูลเข้าเดือนละครั้งแต่คนเปิดหน้าวันละหลายสิบครั้ง — คำนวณซ้ำจึงเปล่าประโยชน์
ลำดับใน `refresh-cache.ps1` สำคัญ: ราคากลางต้องมาก่อนผลงานคนขับ
ไม่งั้นคนขับถูกวัดด้วยราคากลางของรอบก่อน

---

## หน้าที่ต้องมีข้อมูลเพิ่ม

| หน้า | ต้องมี |
|---|---|
| Material Information · Report 50 Districts · Carbon Credit · Customer Details | `weight_query` |
| Driver Performance | `weight_query` + `database/driver_performance.sql` |
| Zone Coverage · Zone Members | `zone_analysis_*.sql` (จาก repo automation) |
| Member Insight · Station Compare · Month Summary · Data Quality | `analysis_v2.sql` + `analysis_cache.sql` |
| ปุ่ม AI ในหน้า Data Quality / Month Summary | `GEMINI_API_KEY` ใน `.env` (ไม่มีก็ใช้หน้าอื่นได้ปกติ) |
| Recurring Jobs | `weight_query` + `database/recurring_jobs.sql` · สถานะจะละเอียดขึ้นถ้ามี `booking_queue` ด้วย |

หน้า Zone จะขึ้นข้อความบอกวิธีแก้เอง ถ้ายังไม่ได้โหลด ไม่ใช่หน้า error เปล่า

---

## ตรวจว่าใช้ได้ไหม

```powershell
curl http://localhost:3000/health
```

```json
{ "web": "ok", "api": "http://127.0.0.1:4000/", "upstream": "ok" }
```

`upstream` ไม่ใช่ `ok` แปลว่า `server.js` ไม่ได้รันหรือ DB ต่อไม่ติด

---

## ปัญหาที่เจอบ่อย

**`โหลด materials ไม่ได้ ... ECONNREFUSED 127.0.0.1:4000`**
`app.js` รันอยู่ตัวเดียว ต้องเปิด `server.js` คู่กันเสมอ

**`Connection Failed: postgres@localhost:5432/wastebuy-analytics`**
DB ไม่ขึ้น หรือรหัสผ่านผิด — `server.js` จะพิมพ์ค่าที่ใช้ต่อ (ไม่รวมรหัสผ่าน) ก่อนหยุด

**nodemon รีสตาร์ทวนไม่หยุด**
`nodemon.json` จำกัดให้จับเฉพาะ `server.js` `app.js` `function/` `views/` แล้ว
ถ้ายังวน แปลว่ามีอะไรเขียนไฟล์ในโฟลเดอร์พวกนั้นอยู่

**`column "price_per_kg" does not exist` / `column "location" does not exist`**
โค้ดหรือไฟล์ SQL ตัวนั้นยังใช้ชื่อเก่า ชื่อใหม่ของ `weight_query` คือ

| ชื่อเดิม | ชื่อใหม่ | ค่าที่เก็บจริง |
|---|---|---|
| `customer_name` | `driver_name` | พนักงานขับ |
| `location` | `member_name` | ผู้จำหน่าย/สมาชิก |
| `gross_weight` | `quantity_per_unit` | จำนวน/หน่วย |
| `tare_weight` | `gross_weight` | จำนวนน้ำหนัก |
| `net_weight` | `deduct_weight` | จำนวนน้ำหนักหัก |
| `price_per_kg` | `net_weight` | จำนวนน้ำหนักสุทธิ |

ของ `weight_query_station` ดูตารางเทียบเต็มที่หัวไฟล์ `database/rename_columns.sql`

**หน้า Driver Performance ขึ้นว่ายังไม่ได้สร้าง view**
รัน `database/driver_performance.sql` ซ้ำ — น่าจะเพิ่งโหลด `zone_analysis` ไป

**หน้า Recurring Jobs ปฏิทินโหลดนาน / timeout**
ขาด index `weight_query (purchase_date, btrim(location))` — รัน `database/recurring_jobs.sql` ซ้ำ

**ปฏิทินงานประจำไม่มีวันหยุดเลย**
ตาราง `holidays` ว่าง — กดปุ่ม "ดึงวันหยุด" ในหน้านั้น ดึงจากปฏิทินวันหยุดไทยของ Google
(iCal สาธารณะ ไม่ต้องมี API key) เก็บลงฐานครั้งเดียว ใช้ได้ต่อแม้เน็ตล่ม
วันหยุดบริษัทที่ไม่มีในปฏิทินสาธารณะให้เพิ่มเองด้วยปุ่ม "+ วันหยุด" — การ sync
รอบต่อไปจะไม่ทับ เพราะแยกด้วยคอลัมน์ `source`

**สถานะงานประจำขึ้น "ไม่มีข้อมูล" ทั้งที่รถไปรับแล้ว**
สถานะคำนวณจากข้อมูลจริง แก้มือไม่ได้ — เทียบ `weight_query.location` กับชื่อสมาชิกในงาน
ชื่อไม่ตรงกันเป๊ะจะจับคู่ไม่ได้ ตรวจด้วย
`SELECT DISTINCT btrim(location) FROM weight_query WHERE purchase_date = '<วันที่>'`

**หน้าแรกโหลดช้า ~20 วินาที**
Driver Performance รวมยอดจาก `weight_query` 1.3M แถว ครั้งแรกช้า
หลังจากนั้น cache 10 นาที เหลือไม่ถึงวินาที
