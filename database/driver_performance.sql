-- ============================================================
-- สถิติและโปรไฟล์คนขับ
-- ------------------------------------------------------------
-- รันซ้ำได้ ไม่แตะข้อมูล สร้างแต่ view
--     psql -v ON_ERROR_STOP=1 -f database/driver_performance.sql
--
-- ต้องมี: weight_query (บังคับ), booking_queue (ถ้าไม่มี ฝั่งใบจองจะว่าง)
--
-- ต้องรันไฟล์นี้ "หลัง" zone_analysis_*.sql เสมอ
-- ไฟล์นั้นสั่ง DROP TABLE booking_queue, vehicle_station_map ... CASCADE
-- ซึ่งลบ v_driver_bookings / v_driver_stations ที่อ้างอยู่ไปด้วย แล้วลาก
-- v_driver_performance หายตามทั้งชุด หน้าเว็บจะขึ้นว่ายังไม่ได้สร้าง view
--
-- ชื่อคอลัมน์ weight_query ถูกแก้ให้ตรงความหมายแล้วโดย database/rename_columns.sql
-- (ก่อนหน้านั้นชื่อเลื่อนไป 1 ช่อง — ดู docs/PLAN.md หัวข้อ D1)
--     driver_name       = พนักงานขับ        (เดิมชื่อ customer_name)
--     member_name       = ผู้จำหน่าย/สมาชิก  (เดิมชื่อ location)
--     quantity_per_unit = จำนวน/หน่วย       (เดิมชื่อ gross_weight)
--     gross_weight      = จำนวนน้ำหนัก       (เดิมชื่อ tare_weight)
--     deduct_weight     = จำนวนน้ำหนักหัก    (เดิมชื่อ net_weight)
--     net_weight        = จำนวนน้ำหนักสุทธิ  (เดิมชื่อ price_per_kg)
-- ไฟล์นี้ต้องรันหลัง rename_columns.sql เท่านั้น
-- ============================================================

BEGIN;

-- IF NOT EXISTS / IF EXISTS พ่น NOTICE ทุกครั้งที่รันซ้ำ ซึ่งไม่ใช่ปัญหา
-- แต่ตัวเรียกที่ถือว่า stderr = error (PowerShell) จะหยุดกลางคัน
SET client_min_messages = warning;

-- ค้นด้วยชื่อคนขับบ่อยมาก ไม่มี index จะ scan 1.3M ทุกครั้ง
CREATE INDEX IF NOT EXISTS weight_query_driver_idx
    ON weight_query (btrim(driver_name));

-- ── ราคากลางต่อสินค้า ────────────────────────────────────────
-- ใช้ median ไม่ใช่ mean เพราะรายการเดียวที่ราคาผิดปกติลาก mean ไปทั้งชุด
--
-- ทำเป็น MATERIALIZED เพราะ percentile_cont บน 1.3M แถวถูกคำนวณใหม่ทุกครั้ง
-- ที่มี view อื่นมา join ด้วย ทำให้หน้าคนขับใช้เวลา 62 วินาที เหลือ ~15 วินาที
-- ราคากลางขยับช้า (เดือนละครั้งตามรอบโหลดข้อมูล) จึงไม่ต้องสดตลอดเวลา
--
--   หลังโหลดข้อมูลเดือนใหม่ ต้องสั่ง:
--   REFRESH MATERIALIZED VIEW v_item_price_benchmark;
-- เผื่อเครื่องที่เคยรันไฟล์เวอร์ชันก่อนหน้าไว้ ตอนนั้นเป็น view ธรรมดา
-- DROP VIEW ไม่ยอมลบ materialized view และกลับกันด้วย แม้ใส่ IF EXISTS
-- จึงต้องดูจาก catalog ก่อนว่าตอนนี้เป็นชนิดไหน
DO $do$
DECLARE kind "char";
BEGIN
    SELECT relkind INTO kind FROM pg_class WHERE relname = 'v_item_price_benchmark';
    IF kind = 'm' THEN
        DROP MATERIALIZED VIEW v_item_price_benchmark CASCADE;
    ELSIF kind = 'v' THEN
        DROP VIEW v_item_price_benchmark CASCADE;
    END IF;
END $do$;
CREATE MATERIALIZED VIEW v_item_price_benchmark AS
SELECT item_name,
       percentile_cont(0.5) WITHIN GROUP (ORDER BY price_per_unit) AS median_price,
       count(*)                                                    AS samples
  FROM weight_query
 WHERE item_name IS NOT NULL
   AND price_per_unit IS NOT NULL
   AND price_per_unit > 0
 GROUP BY item_name
HAVING count(*) >= 20;   -- สินค้าที่ซื้อไม่กี่ครั้ง ราคากลางยังไม่นิ่งพอจะใช้เทียบ

CREATE UNIQUE INDEX ON v_item_price_benchmark (item_name);

-- ── แยกคน ออกจาก ชื่อจุดรับเข้า ──────────────────────────────
-- ช่อง "พนักงานขับ" ในรายงานไม่ได้มีแต่ชื่อคน ยังมีชื่อจุดรับเข้าปนอยู่ด้วย
-- (ปตท. สาขาต่าง ๆ, MAKRO, LOTUS, ทีมการตลาด) ถ้าไม่แยก จะเอาปั๊มน้ำมัน
-- ไปเทียบผลงานกับคนขับรถ ซึ่งไม่มีความหมาย
--
-- ตัวช่วยแยกที่ใช้ได้จริงคือรหัสรถ:
--   0117 3ฒส7062      ทะเบียนจริง        = คนขับรถ
--   0144 PTTรามอินทรา  รหัสจุดรับเข้า      = สถานที่
--   0225 S031          รหัสจุดรับซื้อ       = คนประจำจุด (เป็นคน ไม่ใช่สถานที่)
-- ชื่อที่ขึ้นต้นด้วยแบรนด์/หน่วยงานตัดออกก่อน เพราะบางจุดใช้รหัส S0xx เหมือนคน
CREATE OR REPLACE VIEW v_worker_kind AS
SELECT btrim(driver_name) AS driver,
       btrim(regexp_replace(min(vehicle_number), '^[0-9]{3,4}[[:space:]]*', ''))
                                                   AS vehicle_code,
       CASE
           WHEN btrim(driver_name) ~* '^(ปตท|makro|lotus|บริษัท|ร้าน|ศูนย์)'
             OR btrim(driver_name) LIKE 'ทีม%'
             OR btrim(driver_name) LIKE '%สาขา%'
               THEN 'จุดรับเข้า'
           WHEN btrim(regexp_replace(min(vehicle_number), '^[0-9]{3,4}[[:space:]]*', ''))
                ~ '^[0-9]{0,2}[ก-๙]{1,3}[ -]?[0-9]{1,4}$'
               THEN 'คนขับรถ'
           ELSE 'ประจำจุดรับซื้อ'
       END                                         AS kind
  FROM weight_query
 WHERE driver_name IS NOT NULL AND btrim(driver_name) <> ''
 GROUP BY btrim(driver_name);

-- ── งานรับซื้อรายคนขับ ───────────────────────────────────────
CREATE OR REPLACE VIEW v_driver_purchases AS
SELECT btrim(driver_name)                        AS driver,
       count(DISTINCT purchase_number)             AS bills,
       count(*)                                    AS lines,
       count(DISTINCT purchase_date)               AS work_days,
       count(DISTINCT member_name)                    AS customers,
       count(DISTINCT vehicle_number)              AS vehicles,
       min(purchase_date)                          AS first_date,
       max(purchase_date)                          AS last_date,
       -- net_weight คือน้ำหนักสุทธิหลังหักแล้ว (ดูหัวไฟล์)
       sum(net_weight)                           AS total_kg,
       sum(total_price)                            AS total_baht,
       sum(gross_weight)                            AS gross_kg,
       sum(deduct_weight)                             AS deducted_kg,
       min(purchase_time)                          AS earliest_time,
       max(purchase_time)                          AS latest_time,
       avg(EXTRACT(EPOCH FROM purchase_time) / 3600.0) AS avg_hour,
       count(*) FILTER (WHERE payment_method = 'เงินสด')  AS cash_lines,
       count(*) FILTER (WHERE payment_method <> 'เงินสด') AS transfer_lines
  FROM weight_query
 WHERE driver_name IS NOT NULL
   AND btrim(driver_name) <> ''
 GROUP BY btrim(driver_name);

-- ── ราคาที่จ่ายจริง เทียบราคากลาง ────────────────────────────
-- ถ่วงน้ำหนักด้วยปริมาณ ไม่ใช่เฉลี่ยรายบรรทัด — จ่ายแพงในรายการ 500 กก.
-- ส่งผลมากกว่าจ่ายแพงในรายการ 2 กก. แต่ถ้าเฉลี่ยรายบรรทัดจะนับเท่ากัน
--
-- ยอดจ่ายต้องใช้ total_price ที่ระบบบันทึกไว้จริง ไม่ใช่ น้ำหนัก x ราคาต่อหน่วย
-- เพราะสินค้าที่คิดราคาต่อชิ้น (ขวดเบียร์ ฯลฯ) จ่ายตาม จำนวนชิ้น x ราคา
-- ใช้สูตรผิดทำให้ฐานโป่ง 33.8% (87.0M เทียบยอดจ่ายจริง 65.1M) และธง
-- "จ่ายแพงกว่าราคากลาง" ชี้ผิดคน — ยอดเทียบจึงคิดจากอัตราส่วนต่อบรรทัด
CREATE OR REPLACE VIEW v_driver_price_drift AS
SELECT btrim(w.driver_name)                                  AS driver,
       sum(w.total_price)                                    AS paid_value,
       -- ราคากลางของบรรทัดนั้น = ยอดจ่ายจริง x (ราคากลาง / ราคาที่จ่ายต่อหน่วย)
       sum(w.total_price * b.median_price / w.price_per_unit) AS benchmark_value,
       sum(w.net_weight)                                     AS compared_kg,
       count(*)                                              AS compared_lines
  FROM weight_query w
  JOIN v_item_price_benchmark b ON b.item_name = w.item_name
 WHERE w.driver_name IS NOT NULL
   AND w.price_per_unit IS NOT NULL AND w.price_per_unit > 0
   AND w.total_price IS NOT NULL
   AND w.net_weight > 0
 GROUP BY btrim(w.driver_name);

-- ── ทะเบียนรถ -> คนขับ ──────────────────────────────────────
-- ใบจองบันทึกรถเป็น "ทะเบียนล้วน" (3ฒศ4620) ส่วนบิลบันทึกเป็น
-- "รหัสรถ ทะเบียน" (0117 3ฒส7062) — ถอดตัวคั่นออกทั้งสองฝั่งแล้วเทียบทะเบียน
--
-- ของเดิมพยายามแกะ "ชื่อคนขับ" ออกจากช่องรถของใบจอง ซึ่งใช้ได้เฉพาะแถว
-- ที่เป็น "ทะเบียน ชื่อคน" — ข้อมูลจริง 91.9% เป็นทะเบียนล้วน regex จึงกิน
-- ทั้ง string เหลือค่าว่าง แล้วสถิติใบจองทั้งหน้าคำนวณจากเศษ 3% ของงานจริง
--
-- รถคันเดียวเปลี่ยนคนขับได้ตามช่วงเวลา — เลือกคนที่ขับคันนั้นบ่อยที่สุด
CREATE OR REPLACE VIEW v_vehicle_driver AS
SELECT DISTINCT ON (plate) plate, driver, trips
  FROM (
      SELECT regexp_replace(
                 upper(regexp_replace(vehicle_number, '^[0-9]{3,4}[[:space:]]*', '')),
                 '[^0-9A-Zก-๙]', '', 'g')      AS plate,
             btrim(driver_name)                 AS driver,
             count(*)                           AS trips
        FROM weight_query
       WHERE vehicle_number IS NOT NULL
         AND driver_name IS NOT NULL AND btrim(driver_name) <> ''
       GROUP BY 1, 2
  ) t
 WHERE plate <> ''
 ORDER BY plate, trips DESC;

-- ── งานจากใบจอง ─────────────────────────────────────────────
CREATE OR REPLACE VIEW v_driver_bookings AS
SELECT vd.driver                                            AS driver,
       count(*)                                             AS assigned,
       count(*) FILTER (WHERE b.status = 'สำเร็จ')           AS done,
       count(*) FILTER (WHERE b.status = 'ยกเลิก')          AS cancelled,
       count(*) FILTER (WHERE b.status = 'รอยืนยัน')         AS pending,
       count(*) FILTER (WHERE b.status LIKE 'อยู่ระหว่าง%'
                           OR b.status = 'ยืนยัน')           AS in_progress,
       count(DISTINCT b.district)                           AS districts,
       min(b.booking_date)                                  AS first_booking,
       max(b.booking_date)                                  AS last_booking
  FROM booking_queue b
  JOIN v_vehicle_driver vd
    ON vd.plate = regexp_replace(upper(btrim(b.vehicle)), '[^0-9A-Zก-๙]', '', 'g')
 WHERE b.vehicle IS NOT NULL AND btrim(b.vehicle) <> ''
 GROUP BY vd.driver;

-- ใบจองที่ยังจับคู่คนขับไม่ได้ — หน้าเว็บต้องบอกผู้ใช้ว่าสถิติครอบคลุมแค่ไหน
CREATE OR REPLACE VIEW v_booking_match_coverage AS
SELECT count(*)                                         AS bookings_with_vehicle,
       count(vd.plate)                                  AS matched,
       count(*) - count(vd.plate)                       AS unmatched
  FROM booking_queue b
  LEFT JOIN v_vehicle_driver vd
    ON vd.plate = regexp_replace(upper(btrim(b.vehicle)), '[^0-9A-Zก-๙]', '', 'g')
 WHERE b.vehicle IS NOT NULL AND btrim(b.vehicle) <> '';

-- ── station ที่คนขับวิ่งเข้า ─────────────────────────────────
CREATE OR REPLACE VIEW v_driver_stations AS
SELECT main_driver                        AS driver,
       string_agg(DISTINCT station_name, ', ' ORDER BY station_name) AS stations,
       count(DISTINCT station_name)       AS station_count
  FROM vehicle_station_map
 WHERE main_driver IS NOT NULL AND btrim(main_driver) <> ''
 GROUP BY main_driver;

-- ── โปรไฟล์รวม ──────────────────────────────────────────────
-- DROP ก่อน เพราะ CREATE OR REPLACE เปลี่ยนชนิดคอลัมน์เดิมไม่ได้
DROP VIEW IF EXISTS v_driver_performance;
CREATE VIEW v_driver_performance AS
WITH company AS (
    SELECT
        -- ค่ากลางของบริษัท ใช้เป็นเส้นเทียบว่าคนขับคนไหนผิดปกติ
        percentile_cont(0.5) WITHIN GROUP (
            ORDER BY p2.deducted_kg / nullif(p2.gross_kg, 0)) AS median_deduct_ratio,
        percentile_cont(0.5) WITHIN GROUP (
            ORDER BY p2.bills::numeric / nullif(p2.work_days, 0)) AS median_bills_per_day
      FROM v_driver_purchases p2
      JOIN v_worker_kind k2 ON k2.driver = p2.driver
     -- ค่ากลางต้องมาจากคนขับรถด้วยกันเอง จุดรับเข้าไม่ได้ชั่งแบบเดียวกัน
     WHERE k2.kind = 'คนขับรถ'
       AND p2.work_days >= 5   -- คนที่ทำไม่กี่วันทำให้ค่ากลางเพี้ยน
)
SELECT p.driver,
       k.kind,
       k.vehicle_code,
       p.bills,
       p.lines,
       p.work_days,
       p.customers,
       p.vehicles,
       -- ส่งเป็น text ไม่ใช่ date — driver pg แปลง date เป็น Date ของ JS
       -- แล้วหน้าเว็บได้ '2024-02-01T17:00:00.000Z' ซึ่งเพี้ยนไปหนึ่งวันตาม timezone
       p.first_date::text                                     AS first_date,
       p.last_date::text                                      AS last_date,
       round(p.total_kg::numeric, 2)                          AS total_kg,
       round(p.total_baht::numeric, 2)                        AS total_baht,
       round((p.bills::numeric / nullif(p.work_days, 0)), 2)  AS bills_per_day,
       round((p.total_kg / nullif(p.bills, 0))::numeric, 2)   AS kg_per_bill,
       round((p.total_baht / nullif(p.bills, 0))::numeric, 2) AS baht_per_bill,
       p.earliest_time,
       p.latest_time,
       round(p.avg_hour::numeric, 2)                          AS avg_hour,
       round((100.0 * p.cash_lines
             / nullif(p.cash_lines + p.transfer_lines, 0))::numeric, 1) AS cash_pct,

       -- น้ำหนักที่หักออกคิดเป็นกี่ % ของน้ำหนักก่อนหัก
       -- สูงกว่าค่ากลางมาก = ควรตรวจสอบ ไม่ใช่ข้อสรุปว่าผิด
       round((100.0 * p.deducted_kg / nullif(p.gross_kg, 0))::numeric, 2) AS deduct_pct,
       round((100.0 * c.median_deduct_ratio)::numeric, 2)                 AS company_deduct_pct,

       -- จ่ายแพง/ถูกกว่าราคากลางกี่ % (ถ่วงด้วยปริมาณ)
       round((100.0 * (d.paid_value - d.benchmark_value)
             / nullif(d.benchmark_value, 0))::numeric, 2)                AS price_drift_pct,
       d.compared_lines,

       s.stations,
       COALESCE(s.station_count, 0)                            AS station_count,

       COALESCE(b.assigned, 0)                                 AS booking_assigned,
       COALESCE(b.done, 0)                                     AS booking_done,
       COALESCE(b.cancelled, 0)                                AS booking_cancelled,
       COALESCE(b.pending, 0)                                  AS booking_pending,
       COALESCE(b.in_progress, 0)                              AS booking_in_progress,
       COALESCE(b.districts, 0)                                AS booking_districts,
       -- คิด % จากใบที่ปิดแล้วเท่านั้น ใบที่ยังค้างยังไม่รู้ผล
       round((100.0 * b.done / nullif(b.done + b.cancelled, 0))::numeric, 1) AS success_pct,
       round((100.0 * b.cancelled / nullif(b.done + b.cancelled, 0))::numeric, 1) AS cancel_pct
  FROM v_driver_purchases p
  JOIN v_worker_kind k ON k.driver = p.driver
 CROSS JOIN company c
  LEFT JOIN v_driver_price_drift d ON d.driver = p.driver
  LEFT JOIN v_driver_stations   s ON s.driver = p.driver
  LEFT JOIN v_driver_bookings   b ON b.driver = p.driver;

-- ── ผลงานรายเดือน (ใช้วาดกราฟความคืบหน้า) ────────────────────
CREATE OR REPLACE VIEW v_driver_monthly AS
SELECT btrim(driver_name)                    AS driver,
       date_trunc('month', purchase_date)::date AS month,
       count(DISTINCT purchase_number)          AS bills,
       count(DISTINCT purchase_date)            AS work_days,
       round(sum(net_weight)::numeric, 2)     AS total_kg,
       round(sum(total_price)::numeric, 2)      AS total_baht
  FROM weight_query
 WHERE driver_name IS NOT NULL AND btrim(driver_name) <> ''
 GROUP BY 1, 2;

COMMIT;
