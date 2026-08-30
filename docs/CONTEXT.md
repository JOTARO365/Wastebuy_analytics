# สถานะงาน ณ 2026-08-30 (เก็บก่อน restart เครื่อง)

อ่านไฟล์นี้ก่อนทำงานต่อ แล้วค่อยไป `PLAN.md` (หัวข้อ 8-9) กับ `SETUP.md`

---

## เปิดระบบขึ้นมาใหม่ยังไง

```powershell
cd D:\Projects\wastebuy_e
npm start
```

เปิดทั้ง API และเว็บให้เอง รอ API พร้อมก่อนค่อยเปิดเว็บ → http://localhost:3000
ปิดด้วย Ctrl+C ทีเดียว

**ไม่ต้องสั่ง refresh cache เอง** — `server.js` ตรวจทุก 15 นาทีว่าข้อมูลเปลี่ยนไหม
เปลี่ยนแล้วคำนวณ materialized view ทั้ง 16 ตัวใหม่เบื้องหลัง
(พิสูจน์แล้ว: หลัง re-import รอบล่าสุด ระบบคำนวณใหม่เองเวลา 18:02 โดยไม่มีใครสั่ง)

ตัวทดสอบที่เคยเปิดไว้ที่ port 3100/4100 จะหายไปตอน restart — ไม่ต้องสนใจ

---

## สถานะฐานข้อมูล (วัดเมื่อ 2026-08-30 18:00)

| ตาราง | จำนวน | หมายเหตุ |
|---|---|---|
| `weight_query` | **1,311,301 แถว** | ถึง 2026-07-30 · 19,475,613 กก. · 65,056,860 บาท |
| `booking_queue` | 90,040 ใบ | 2024-02-26 → 2026-12-24 |
| `customers` | 78,647 | |
| `drivers` | 245 | มี `plate_normalized` แล้ว |
| `stations` | 5 | พิกัดยืนยัน 3 · ยังเดา 2 (A1, ฉลองกรุง) |
| materialized view | 16 ตัว | รีเฟรชล่าสุด 18:02 |

**เปลี่ยนไปจากเดิมระหว่างวัน** (ฝั่ง automation ทำ):
- re-import 2024-02..2026-03 → `station`/`ghg`/`customer_group`/`trees`
  จาก 19.2% เป็น **99.98%**
- พบว่า 2024-06-30 เคยถูกโหลดซ้ำตั้งแต่แรก → ลบแถวซ้ำ **602 แถว**
  (1,311,903 → 1,311,301 · น้ำหนักรวม 19,482,784 → 19,475,613)

> ตัวเลขอ้างอิงใน docs ที่เขียนไว้ก่อนหน้าจึงเป็นค่าเก่า — อัปเดตแล้วในรอบนี้
> เกณฑ์ตรวจคือ "ผลรวมหน้า Report 50 Districts ต้องเท่ากับ `sum(net_weight)`"
> ไม่ใช่ตัวเลขคงที่ตัวใดตัวหนึ่ง

---

## ที่ยังไม่ได้ commit (ทั้งสอง repo)

**`D:\Projects\wastebuy_e`** — งานทั้งวันยังอยู่ใน working tree

ไฟล์ใหม่:
```
SETUP.md · docs/PLAN.md (หัวข้อ 8-9) · docs/CONTEXT.md
database/  rename_columns.sql · add_weight_query_columns.sql
           driver_performance.sql · recurring_jobs.sql
           analysis_v2.sql · analysis_cache.sql · station_coords.sql
function/  gemini.js · cache.js
scripts/   setup.ps1 · dump-seed.ps1 · refresh-cache.ps1 · run-all.mjs
views/     Overview.ejs (หน้าแรกใหม่) · Report-Member-Insight.ejs
           Report-Station-Compare.ejs · Report-Month-Summary.ejs
           Report-Data-Quality.ejs · Report-Driver-Performance.ejs
           Report-Recurring-Jobs.ejs · Report-Zone-Coverage.ejs
           Report-Zone-Members.ejs · partials/page-head.ejs · partials/filter-bar.ejs
public/scripts/recurring-jobs.js · nodemon.json · .env.example
```
ไฟล์ที่แก้: `app.js` `server.js` `function/scripts.js` `package.json`
`public/styles/stylesheet.css` + views เดิมอีก 6 ไฟล์ · ลบ `views/Scheduling-system.ejs`

**`D:\claude_workspace\wastebuy_pass_automation`** — เอกสารใหม่
`docs/DATA_CHECKLIST.md` · `docs/PROMPT_data_pipeline.md`
(สองไฟล์เก่า `PROMPT_export_expansion.md` `PROMPT_master_data_sync.md` ถูกแทนที่แล้ว)

---

## ทำอะไรไปแล้ววันนี้

1. **rename คอลัมน์ production** — แก้ query ทุกจุดให้ตรงชื่อใหม่ โดยคง JSON key เดิม
   ไว้ views ไม่ต้องแก้ตาม
2. **หน้าใหม่ 5 หน้า** — Overview (หน้าแรก) · Member Insight · Station Compare ·
   Month Summary · Data Quality
3. **ชั้น cache** — 16 materialized view · `/api-drivers` 5,300 ms → 13 ms ·
   zone 18,400 → 24 ms
4. **Gemini** — จัดหมวดสินค้า + สรุปรายเดือน (คีย์อยู่ใน `.env` แล้ว ใช้ได้จริง)
5. **audit ทั้งระบบด้วยผู้ตรวจ 4 ชุด** แล้วแก้ครบทุกข้อร้ายแรง (ดู PLAN.md หัวข้อ 9)
6. **ทำให้ระบบดูแลตัวเอง** — `npm start` ตัวเดียว + cache รีเฟรชอัตโนมัติ
7. **DATA_CHECKLIST.md** — คอลัมน์ไหนใช้คำนวณอะไร ครบกี่ % วัดจากฐานจริง

---

## ค้างอยู่ เรียงตามความสำคัญ

| # | เรื่อง | รายละเอียด |
|---|---|---|
| 1 | **commit ทั้งสอง repo** | งานทั้งวันยังไม่ได้ commit เลย |
| 2 | **พิกัดคลัง A1** | เป็นคลังที่ทำงานมากที่สุด (129,041 รายการ) แต่พิกัดที่เดาไว้ทำให้จับได้แค่ 1 เขต ขณะที่วัชรพลจับ 27 เขต — หาหมุดจริงมาใส่ใน `tools/config/stations.csv` แล้วรัน `database/station_coords.sql` ซ้ำ |
| 3 | ตัดสินหมวดสินค้า 30 SKU | AI เสนอไว้แล้ว รอคนกดยืนยันที่หน้า Data Quality — ยังไม่ไหลเข้ารายงานจนกว่าจะยืนยัน |
| 4 | รหัสผ่าน admin ที่หลุดใน git history | ยังไม่เปลี่ยน — ค่าอยู่ใน commit เก่าของ repo automation ไม่เขียนซ้ำที่นี่ |
| 5 | เขตนอกพื้นที่บนหน้า Zone | วัชรพลมีเขตห่าง 672 กม. (ต่างจังหวัด) ถูกจับให้คลังที่ใกล้ที่สุดทั้งที่ไม่มีคลังไหนใกล้ ควรแยกเป็นกลุ่ม "นอกพื้นที่" |
| 6 | `booking_queue.vehicle` 45% | ตรวจแล้วต้นทางว่างเอง (CSV มีแค่ 43.6%) ดึงเพิ่มไม่ช่วย — ต้องให้ฝ่ายปฏิบัติการกรอก หรืออนุมานจาก `weight_query` |

---

## กับดักที่เจอมาแล้ว อย่าเหยียบซ้ำ

- **โปรเซสเก่าค้าง port** — แก้โค้ดแล้วเหมือนไม่มีอะไรเปลี่ยน เพราะโปรเซสเดิม
  ยังรันโค้ดเก่าอยู่ ฆ่าด้วย port ไม่ใช่ชื่อคำสั่ง (`Get-NetTCPConnection -LocalPort`)
- **`git checkout <file>`** — เคยล้างงานที่ยังไม่ commit หายทั้งไฟล์
- **แก้ไฟล์ผ่าน shell heredoc** — `\n` `\r` กลายเป็นอักขระจริง ทำไฟล์พังมาหลายรอบ
  ใช้ python script ที่ประกอบ escape ด้วย `chr()` แทน
- **`CREATE OR REPLACE VIEW`** เปลี่ยนชื่อ/ลำดับคอลัมน์ไม่ได้ ต้อง `DROP` ก่อน
  (และ `DROP VIEW IF EXISTS` ไม่ลบ materialized view)
- **`zone_analysis_*.sql` ขึ้นต้นด้วย `DROP TABLE ... CASCADE`** — ลบ view ของ
  driver / recurring / analysis ทิ้งหมด ต้องรันไฟล์อื่นตามหลังเสมอ (ดู SETUP.md)
- **ห้ามรัน `zone_analysis` ที่ generate จาก CSV หน้า Reservation ทับ** —
  ไฟล์นั้นมีใบจอง 868 ใบ ฐานมี 90,040
