-- ============================================================
-- analysis_v2.sql — หมวดสินค้าที่ถูกต้อง + วิเคราะห์สมาชิก + เทียบ station
--
-- ครอบ PLAN.md หัวข้อ 8: A1 (หมวดปนชื่อโครงการ) · A5 (หมวดที่ join ไม่ติด)
--                        B1 (RFM สมาชิก) · B4 (ผลงาน station) · C2/C4 (log ของ AI)
--
-- ต้องรันหลัง database/rename_columns.sql เท่านั้น — ใช้ชื่อคอลัมน์ใหม่
-- รันซ้ำได้ ไม่ลบสิ่งที่คนกรอก/ยืนยันไว้
--
-- Run: psql -v ON_ERROR_STOP=1 -f database/analysis_v2.sql
-- ============================================================

SET client_encoding = 'UTF8';

BEGIN;

SET client_min_messages = warning;

-- ── A1: หมวดสินค้าที่ถูกต้อง ─────────────────────────────────
-- ช่อง category ของบางแถวเก็บ "ชื่อโครงการ" ไม่ใช่หมวดวัสดุ
-- (สยามพารากอน / ชุมชนดวงประทีป / แม็คโค-RDF / เนสท์เล่)
-- รวม 7,876 แถว แต่มีแค่ 70 SKU — เล็กพอให้คนตรวจได้ทั้งหมด
--
-- ไม่แก้ค่าใน weight_query เพราะนั่นคือสิ่งที่ระบบต้นทางส่งมาจริง
-- ถ้าเขียนทับ รอบ import หน้าจะทับกลับ แล้วก็ต้องมานั่งแก้ใหม่ทุกเดือน
-- ใช้ตารางแมปคุมทับตอนอ่านแทน
CREATE TABLE IF NOT EXISTS item_category_overrides (
    item_code     varchar(50) PRIMARY KEY,
    item_name     text        NOT NULL,
    -- ค่าที่ระบบต้นทางใส่มาในช่องหมวด (ชื่อโครงการ) — เก็บไว้ ไม่ทิ้ง
    source_value  text,
    project_name  text,
    -- หมวดวัสดุจริง NULL = ยังไม่รู้ ต้องมีคนหรือ AI เสนอก่อน
    category      text,
    -- 'auto'    = จับชื่อกับ materials ได้ตรง ๆ
    -- 'ai'      = Gemini เสนอ ยังไม่มีคนยืนยัน
    -- 'manual'  = คนกรอก/ยืนยันเอง — ห้าม auto เขียนทับ
    source        text NOT NULL DEFAULT 'auto',
    confidence    numeric,
    note          text,
    confirmed_by  text,
    confirmed_at  timestamptz,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ชื่อโครงการที่เคยโผล่ในช่องหมวด — ใช้ทั้งตอน seed และตอนอ่าน
CREATE OR REPLACE VIEW v_project_categories AS
SELECT DISTINCT category AS project_name
  FROM weight_query
 WHERE category IS NOT NULL
   AND NOT EXISTS (
       SELECT 1 FROM category_materials cm
        WHERE btrim(cm.material_group) = btrim(weight_query.category));

-- เติมอัตโนมัติ: ตัดคำนำหน้ารหัสโครงการออกจากชื่อ แล้วจับกับ materials
-- ("SS กระดาษลังน้ำตาล (ลูกฟูก)" -> "กระดาษลังน้ำตาล (ลูกฟูก)")
-- แถวที่คนยืนยันแล้ว (source='manual') ไม่ถูกแตะ
INSERT INTO item_category_overrides
       (item_code, item_name, source_value, project_name, category, source, confidence)
-- ชื่อสินค้าซ้ำกันได้ใน materials (คนละรหัส ชื่อเดียวกัน) การ join จึงคูณแถว
-- ต้องยุบอีกชั้นหลัง join ไม่ใช่แค่ตอนอ่านจาก weight_query
SELECT DISTINCT ON (s.item_code)
       s.item_code,
       s.item_name,
       s.source_value,
       s.source_value AS project_name,
       cm.material_group,
       'auto',
       1.0
  FROM (
      -- item_code เดียวมีได้หลายชื่อ (สะกด/เว้นวรรคต่าง) เอาแถวที่ใช้บ่อยสุด
      -- DISTINCT เฉย ๆ จะได้ item_code ซ้ำ แล้ว ON CONFLICT ล้มทั้งคำสั่ง
      SELECT DISTINCT ON (w.item_code)
             w.item_code,
             w.item_name,
             w.category AS source_value,
             btrim(regexp_replace(w.item_name, '^[A-Za-z]{2,4}[[:space:]]+', '')) AS clean
        FROM weight_query w
        JOIN v_project_categories p ON p.project_name = w.category
       WHERE w.item_code IS NOT NULL
       GROUP BY w.item_code, w.item_name, w.category
       ORDER BY w.item_code, count(*) DESC
  ) s
  JOIN materials m       ON btrim(m.name_mat) = s.clean
  JOIN group_materials g ON g.id = m.id_mat_group
  JOIN category_materials cm
       ON cm.category_code = substring(m.code_mat from '^[A-Za-z]+')
 ORDER BY s.item_code, m.id
    ON CONFLICT (item_code) DO UPDATE
   SET item_name  = EXCLUDED.item_name,
       category   = EXCLUDED.category,
       updated_at = now()
 WHERE item_category_overrides.source <> 'manual';

-- ลงแถวเปล่าไว้สำหรับ SKU ที่ยังจับคู่ไม่ได้ — จะได้เห็นว่าเหลืออะไรต้องตัดสิน
INSERT INTO item_category_overrides
       (item_code, item_name, source_value, project_name, category, source)
SELECT DISTINCT ON (w.item_code)
       w.item_code, w.item_name, w.category, w.category, NULL, 'auto'
  FROM weight_query w
  JOIN v_project_categories p ON p.project_name = w.category
 WHERE w.item_code IS NOT NULL
 GROUP BY w.item_code, w.item_name, w.category
 ORDER BY w.item_code, count(*) DESC
    ON CONFLICT (item_code) DO NOTHING;

-- หมวดที่ควรใช้ในรายงาน = override ที่ "ตัดสินแล้ว" เท่านั้น
--
-- source='ai' คือคำเดาของโมเดล ยังไม่มีคนยืนยัน — ห้ามให้ไหลเข้ารายงาน
-- ไม่งั้นตัวเลขรายหมวดเปลี่ยนตามคำเดา ขัดกับที่หน้าจอบอกผู้ใช้ว่า "รอคนยืนยัน"
-- ('auto' = จับชื่อกับ materials ได้ตรงตัว ถือว่าเป็นข้อเท็จจริง ไม่ใช่การเดา)
-- DROP ก่อน: CREATE OR REPLACE แทรกคอลัมน์กลางชุดไม่ได้
-- CASCADE: v_station_materials + mv_station_materials อ่านต่อจาก view นี้
-- ทั้งสองตัวถูกสร้างใหม่ในไฟล์นี้และ analysis_cache.sql ตามลำดับอยู่แล้ว
DROP VIEW IF EXISTS v_item_category CASCADE;
CREATE VIEW v_item_category AS
SELECT w.item_code,
       max(w.item_name)                              AS item_name,
       max(w.category)                               AS source_category,
       max(o.project_name)                           AS project_name,
       COALESCE(max(o.category) FILTER (WHERE o.source IN ('auto', 'manual')),
                max(w.category))                     AS category,
       max(o.category) FILTER (WHERE o.source = 'ai') AS ai_suggested,
       bool_or(o.item_code IS NOT NULL)              AS is_override,
       bool_or(o.category IS NULL AND o.item_code IS NOT NULL) AS needs_decision
  FROM weight_query w
  LEFT JOIN item_category_overrides o ON o.item_code = w.item_code
 WHERE w.item_code IS NOT NULL
 GROUP BY w.item_code;

-- ── A5: หมวดสินค้าที่ไม่มีสินค้าผูกอยู่ ───────────────────────
-- /materials join ด้วย prefix ของ code_mat หมวดที่รหัสเป็นตัวเลข
-- (00010 ทองเหลือ · 00009 ทองแดง · 001 รีไชเคิล) จึงไม่มีวันถูกใช้
-- ไม่ลบให้ — ต้องให้ฝั่ง operation ยืนยันรหัสจริงก่อน view นี้แค่ทำให้เห็น
CREATE OR REPLACE VIEW v_orphan_categories AS
SELECT cm.id,
       cm.category_code,
       cm.material_group,
       count(m.id) AS materials,
       cm.category_code ~ '^[0-9]+$' AS numeric_code
  FROM category_materials cm
  LEFT JOIN materials m
         ON substring(m.code_mat from '^[A-Za-z]+') = cm.category_code
 GROUP BY cm.id, cm.category_code, cm.material_group
HAVING count(m.id) = 0;

-- SKU ที่ไม่มีใน materials เลย (รหัสชุดโครงการ) — master สินค้าไม่ครบ
CREATE OR REPLACE VIEW v_unknown_items AS
SELECT w.item_code,
       max(w.item_name)                  AS item_name,
       max(w.category)                   AS source_category,
       count(*)                          AS lines,
       round(sum(w.net_weight)::numeric, 2)  AS total_kg,
       round(sum(w.total_price)::numeric, 2) AS total_baht,
       min(w.purchase_date)              AS first_date,
       max(w.purchase_date)              AS last_date
  FROM weight_query w
  LEFT JOIN materials m ON m.code_mat = w.item_code
 WHERE m.id IS NULL AND w.item_code IS NOT NULL
 GROUP BY w.item_code;

-- ── B1: สมาชิกรายคน — ความถี่ ยอด และวันที่หายไป ──────────────
-- ชื่อสมาชิกคือ key เดียวที่มี (weight_query ไม่มี id สมาชิก)
-- btrim ทุกจุด ไม่งั้นชื่อเดียวกันที่มีช่องว่างเกินกลายเป็นคนละคน
CREATE OR REPLACE VIEW v_member_activity AS
SELECT btrim(w.member_name)                       AS member_name,
       count(DISTINCT w.purchase_date)            AS visits,
       count(DISTINCT w.purchase_number)          AS bills,
       count(*)                                   AS lines,
       round(sum(w.net_weight)::numeric, 2)       AS total_kg,
       round(sum(w.total_price)::numeric, 2)      AS total_baht,
       min(w.purchase_date)                       AS first_date,
       max(w.purchase_date)                       AS last_date,
       count(DISTINCT w.driver_name)              AS drivers,
       count(DISTINCT date_trunc('month', w.purchase_date)) AS active_months
  FROM weight_query w
 WHERE w.member_name IS NOT NULL AND btrim(w.member_name) <> ''
 GROUP BY btrim(w.member_name);

-- RFM + สถานะการหายไป
--
-- เกณฑ์วันที่หาย นับจาก "วันล่าสุดที่ระบบมีข้อมูล" ไม่ใช่ CURRENT_DATE
-- เพราะข้อมูลตามหลังของจริงอยู่หลายสัปดาห์ ถ้าใช้วันนี้ทุกคนจะดูเหมือนหายหมด
--
-- R/F/M แบ่งเป็น 5 ชั้นด้วย ntile ไม่ใช่ค่าคงที่ที่ตั้งเอง
-- ธุรกิจนี้ยอดต่อคนต่างกันหลายพันเท่า (ครัวเรือนกับห้างสรรพสินค้า)
-- เกณฑ์ตายตัวจะกอง 90% ไว้ชั้นเดียว
CREATE OR REPLACE VIEW v_member_rfm AS
WITH bounds AS (
    SELECT max(purchase_date) AS data_date FROM weight_query
), scored AS (
    SELECT a.*,
           b.data_date,
           (b.data_date - a.last_date)  AS days_since,
           (a.last_date - a.first_date) AS lifespan_days,
           ntile(5) OVER (ORDER BY a.last_date)  AS r_score,
           ntile(5) OVER (ORDER BY a.visits)     AS f_score,
           ntile(5) OVER (ORDER BY a.total_baht) AS m_score
      FROM v_member_activity a CROSS JOIN bounds b
)
SELECT member_name,
       visits, bills, lines, total_kg, total_baht,
       first_date, last_date, data_date, days_since, lifespan_days,
       drivers, active_months,
       r_score, f_score, m_score,
       round(total_baht / NULLIF(visits, 0), 2)  AS baht_per_visit,
       round(total_kg  / NULLIF(visits, 0), 2)   AS kg_per_visit,
       -- ช่องว่างเฉลี่ยระหว่างครั้ง ใช้ตัดสินว่า "ช้ากว่าปกติของคนคนนี้" หรือยัง
       CASE WHEN visits > 1
            THEN round((last_date - first_date)::numeric / (visits - 1), 1)
       END                                       AS avg_gap_days,
       CASE
           WHEN visits = 1 AND days_since > 90                THEN 'มาครั้งเดียวแล้วหาย'
           WHEN visits = 1                                    THEN 'ลูกค้าใหม่'
           WHEN days_since > 180                              THEN 'หายแล้ว'
           WHEN days_since > 90                               THEN 'เสี่ยงหาย'
           WHEN visits >= 12 AND days_since <= 60             THEN 'ประจำ'
           ELSE 'ยังใช้งานอยู่'
       END                                       AS segment
  FROM scored;

-- ── B4: ผลงานรายคลัง ────────────────────────────────────────
-- คอลัมน์ station เพิ่งเริ่มเก็บ (re-import 2026-04 เป็นต้นไป)
-- view คืนช่วงวันที่ที่ใช้ได้มาด้วย หน้าเว็บต้องแสดงให้ชัด
-- ไม่งั้นคนอ่านจะนึกว่าคลังที่ตัวเลขน้อยคือคลังที่ทำงานน้อย
CREATE OR REPLACE VIEW v_station_coverage AS
SELECT min(purchase_date) AS first_date,
       max(purchase_date) AS last_date,
       count(*)           AS rows_with_station,
       (SELECT count(*) FROM weight_query) AS rows_total
  FROM weight_query WHERE station IS NOT NULL;

CREATE OR REPLACE VIEW v_station_performance AS
SELECT btrim(w.station)                            AS station,
       count(DISTINCT w.purchase_date)             AS work_days,
       count(DISTINCT w.purchase_number)           AS bills,
       count(*)                                    AS lines,
       count(DISTINCT btrim(w.driver_name))        AS drivers,
       count(DISTINCT btrim(w.member_name))        AS members,
       count(DISTINCT w.vehicle_number)            AS vehicles,
       round(sum(w.net_weight)::numeric, 2)        AS total_kg,
       round(sum(w.total_price)::numeric, 2)       AS total_baht,
       round(sum(w.ghg)::numeric, 2)               AS total_ghg,
       round(avg(w.total_price)::numeric, 2)       AS avg_line_baht,
       round((sum(w.total_price) / NULLIF(count(DISTINCT w.purchase_number), 0))::numeric, 2)
                                                   AS baht_per_bill,
       round((sum(w.net_weight) / NULLIF(count(DISTINCT w.purchase_date), 0))::numeric, 2)
                                                   AS kg_per_day,
       round((count(DISTINCT w.purchase_number)::numeric
              / NULLIF(count(DISTINCT w.purchase_date), 0)), 2)
                                                   AS bills_per_day,
       min(w.purchase_date)                        AS first_date,
       max(w.purchase_date)                        AS last_date
  FROM weight_query w
 WHERE w.station IS NOT NULL AND btrim(w.station) <> ''
 GROUP BY btrim(w.station);

-- สัดส่วนหมวดวัสดุของแต่ละคลัง — ใช้หมวดที่แก้แล้ว ไม่ใช่ช่องดิบ
CREATE OR REPLACE VIEW v_station_materials AS
SELECT btrim(w.station)                        AS station,
       COALESCE(c.category, w.category)        AS category,
       count(*)                                AS lines,
       round(sum(w.net_weight)::numeric, 2)    AS total_kg,
       round(sum(w.total_price)::numeric, 2)   AS total_baht
  FROM weight_query w
  LEFT JOIN v_item_category c ON c.item_code = w.item_code
 WHERE w.station IS NOT NULL AND btrim(w.station) <> ''
 GROUP BY 1, 2;

-- คลัง x เดือน ใช้ดูแนวโน้ม
CREATE OR REPLACE VIEW v_station_monthly AS
SELECT btrim(station)                          AS station,
       date_trunc('month', purchase_date)::date AS month,
       count(DISTINCT purchase_number)         AS bills,
       round(sum(net_weight)::numeric, 2)      AS total_kg,
       round(sum(total_price)::numeric, 2)     AS total_baht
  FROM weight_query
 WHERE station IS NOT NULL AND btrim(station) <> ''
 GROUP BY 1, 2;

-- ── C2/C4: บันทึกทุกครั้งที่เรียกโมเดล ───────────────────────
-- เก็บ prompt + คำตอบ ไม่ใช่เก็บแค่ผล เพราะเวลาโมเดลตอบแปลก
-- ต้องย้อนดูได้ว่าถามด้วยอะไร ด้วยโมเดลรุ่นไหน
CREATE TABLE IF NOT EXISTS ai_runs (
    id            serial PRIMARY KEY,
    task          text NOT NULL,          -- 'classify-items' | 'monthly-summary'
    model         text NOT NULL,
    prompt        text NOT NULL,
    response      text,
    input_summary text,                   -- ย่อว่าส่งอะไรไป ไว้อ่านเร็ว ๆ
    ok            boolean NOT NULL DEFAULT true,
    error         text,
    duration_ms   integer,
    created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_runs_task_idx ON ai_runs (task, created_at DESC);

-- สรุปรายเดือนที่โมเดลเขียน เก็บไว้ ไม่ต้องเรียกซ้ำทุกครั้งที่เปิดหน้า
CREATE TABLE IF NOT EXISTS ai_monthly_summary (
    month       date PRIMARY KEY,
    summary     text NOT NULL,
    facts       jsonb NOT NULL,           -- ตัวเลขที่ SQL คำนวณแล้วส่งให้โมเดล
    model       text NOT NULL,
    run_id      integer REFERENCES ai_runs(id) ON DELETE SET NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- ตัวเลขที่ใช้ป้อนให้โมเดลสรุป — ไม่มีชื่อ/เบอร์/ที่อยู่สมาชิกเลย
-- DROP ก่อน: CREATE OR REPLACE เปลี่ยนลำดับ/ชื่อคอลัมน์เดิมไม่ได้
-- (รอบก่อนมีแค่ cash_lines/credit_lines ตอนนี้แทรก transfer_lines เข้ากลาง)
DROP MATERIALIZED VIEW IF EXISTS mv_month_facts;
DROP VIEW IF EXISTS v_month_facts;
CREATE VIEW v_month_facts AS
SELECT date_trunc('month', w.purchase_date)::date   AS month,
       count(DISTINCT w.purchase_number)            AS bills,
       count(*)                                     AS lines,
       count(DISTINCT w.purchase_date)              AS work_days,
       count(DISTINCT btrim(w.member_name))         AS members,
       count(DISTINCT btrim(w.driver_name))         AS workers,
       round(sum(w.net_weight)::numeric, 2)         AS total_kg,
       round(sum(w.total_price)::numeric, 2)        AS total_baht,
       round(avg(w.total_price)::numeric, 2)        AS avg_line_baht,
       -- ต้องครบทุกวิธีชำระ ไม่งั้นผลรวมไม่เท่า lines แล้วคนอ่าน (รวมถึงโมเดล)
       -- จะสรุปว่าระบบบันทึกข้อมูลผิด ทั้งที่แค่นับไม่ครบ
       count(*) FILTER (WHERE w.payment_method = 'เงินสด')   AS cash_lines,
       count(*) FILTER (WHERE w.payment_method = 'เงินโอน')  AS transfer_lines,
       count(*) FILTER (WHERE w.payment_method = 'เงินเชื่อ') AS credit_lines,
       count(*) FILTER (WHERE w.payment_method = 'บริจาค')   AS donate_lines,
       count(*) FILTER (WHERE w.payment_method IS NULL
                           OR w.payment_method NOT IN
                              ('เงินสด','เงินโอน','เงินเชื่อ','บริจาค')) AS other_lines
  FROM weight_query w
 GROUP BY 1;

COMMIT;

-- ตรวจว่าครบ ไม่ใช่เชื่อว่า COMMIT ผ่านแล้วแปลว่าถูก
DO $check$
DECLARE missing text[];
BEGIN
    SELECT array_agg(want.name) INTO missing
      FROM (VALUES ('item_category_overrides'), ('v_item_category'),
                   ('v_orphan_categories'), ('v_unknown_items'),
                   ('v_member_activity'), ('v_member_rfm'),
                   ('v_station_performance'), ('v_station_materials'),
                   ('v_station_monthly'), ('v_station_coverage'),
                   ('ai_runs'), ('ai_monthly_summary'), ('v_month_facts')
           ) AS want(name)
     WHERE to_regclass('public.' || want.name) IS NULL;

    IF missing IS NOT NULL THEN
        RAISE EXCEPTION 'analysis_v2 ไม่ครบ ขาด: %', array_to_string(missing, ', ');
    END IF;
    RAISE NOTICE 'OK: analysis_v2 ครบทุกตาราง/view';
END
$check$;

-- ============================================================
-- ที่อยู่สมาชิกจากใบจองที่เข้ารับสำเร็จแล้ว
--
-- สมาชิก 12,416 คนไม่มีที่อยู่ในระบบเลย จัดเขตไม่ได้ ทำ zone analysis ไม่ได้
-- แต่ใบจองที่ "สำเร็จ" คือหลักฐานว่ารถไปถึงที่นั่นจริง — ที่อยู่ในใบจองจึงเชื่อได้
-- กว่าที่อยู่ที่กรอกไว้ตอนสมัครแล้วไม่เคยอัปเดต
--
-- ไม่เขียนทับ customers.address เพราะ automation โหลดตาราง customers ทับทุกรอบ
-- แก้ตรงนั้นเดี๋ยวก็หาย — ใช้ view ประกอบตอนอ่านแทน เหมือน item_category_overrides
-- ============================================================

BEGIN;

SET client_min_messages = warning;

DO $bq_idx$
BEGIN
    IF to_regclass('public.booking_queue') IS NOT NULL THEN
        CREATE INDEX IF NOT EXISTS booking_queue_member_idx
            ON booking_queue (btrim(member_name)) WHERE status = 'สำเร็จ';
    END IF;
END
$bq_idx$;

-- ที่อยู่ล่าสุดที่ยืนยันแล้วของแต่ละชื่อสมาชิก
--
-- '(LINE)' ไม่ใช่ที่อยู่ เป็นค่าที่ระบบใส่แทนตอนจองผ่าน LINE — ตัดทิ้ง
-- เลือกใบล่าสุดเพราะคนย้ายบ้านได้ ใบเก่าจึงไม่ใช่ของจริงเสมอไป
DO $guard_v_member_address_from_booking$
BEGIN
    IF to_regclass('public.booking_queue') IS NULL THEN
        RAISE NOTICE 'ยังไม่มี booking_queue — ที่อยู่จากใบจองจะว่างไว้ก่อน';
        EXECUTE $empty$
CREATE OR REPLACE VIEW v_member_address_from_booking AS
SELECT NULL::text AS member_name, NULL::text AS address, NULL::text AS district,
       NULL::text AS subdistrict, NULL::varchar(10) AS post_code,
       NULL::double precision AS lat, NULL::double precision AS lng,
       NULL::varchar(50) AS booking_code, NULL::date AS booking_date,
       NULL::bigint AS done_bookings
 WHERE false;
        $empty$;
        RETURN;
    END IF;
    EXECUTE $sql$
CREATE OR REPLACE VIEW v_member_address_from_booking AS
SELECT DISTINCT ON (btrim(b.member_name))
       btrim(b.member_name)              AS member_name,
       b.address,
       b.district,
       b.subdistrict,
       b.post_code,
       b.lat,
       b.lng,
       b.booking_code,
       b.booking_date,
       count(*) OVER (PARTITION BY btrim(b.member_name)) AS done_bookings
  FROM booking_queue b
 WHERE b.status = 'สำเร็จ'
   AND b.member_name IS NOT NULL AND btrim(b.member_name) <> ''
   AND b.address IS NOT NULL AND btrim(b.address) <> ''
   AND b.address NOT LIKE '%(LINE%'
 ORDER BY btrim(b.member_name), b.booking_date DESC NULLS LAST, b.id DESC;
    $sql$;
END
$guard_v_member_address_from_booking$;

-- ที่อยู่ที่ควรใช้ในรายงาน = ของในระบบถ้ามี ไม่มีก็เอาจากใบจองที่สำเร็จ
--
-- source บอกที่มาเสมอ ไม่ให้ปนกันจนแยกไม่ออกว่าอันไหนลูกค้ากรอกเอง
-- อันไหนระบบเดาให้จากใบจอง
-- ── ทะเบียนสมาชิกแบบยุบชื่อซ้ำแล้ว ─────────────────────────
-- ทุกที่ที่ต้องการเขต/กลุ่มของสมาชิกให้ join view นี้ ไม่ใช่ join customers ตรง ๆ
--
-- เหตุผล 2 ข้อ:
--   1. ชื่อซ้ำมีจริง (สมาชิก 493 คนชื่อ "LINE") join ตรง ๆ แถวจะบานเป็นทวีคูณ
--   2. customers เป็นข้อมูลส่วนบุคคล ไม่มากับ repo — เครื่องที่ยังไม่ได้กู้
--      ต้องเปิดหน้าเว็บได้ ไม่ใช่ 500 ทั้งหน้า
DO $directory$
BEGIN
    IF to_regclass('public.customers') IS NULL THEN
        EXECUTE $empty$
CREATE OR REPLACE VIEW v_customer_directory AS
SELECT NULL::text AS fullname, NULL::integer AS id_customer,
       NULL::integer AS id_tambons, NULL::integer AS id_amphures,
       NULL::integer AS id_provinces
 WHERE false;
        $empty$;
    ELSE
        EXECUTE $real$
CREATE OR REPLACE VIEW v_customer_directory AS
SELECT DISTINCT ON (fullname)
       fullname, id_customer, id_tambons, id_amphures, id_provinces
  FROM customers
 WHERE fullname IS NOT NULL AND btrim(fullname) <> ''
 ORDER BY fullname, id;
        $real$;
    END IF;
END
$directory$;

-- ทะเบียนสมาชิกเป็นข้อมูลส่วนบุคคล จึงไม่ได้อยู่ใน seed ที่มากับ repo
-- เครื่องที่ยังไม่ได้กู้ตารางนี้ต้องใช้ระบบต่อได้ — ถอยไปใช้ชื่อจากบิลแทน
-- (ได้รายชื่อสมาชิกครบเหมือนเดิม แค่ไม่มีที่อยู่กับเขต)
DO $member_address$
BEGIN
    IF to_regclass('public.customers') IS NULL THEN
        RAISE NOTICE 'ยังไม่มีตาราง customers — ที่อยู่และเขตของสมาชิกจะว่าง';
        EXECUTE $no_customers$
CREATE OR REPLACE VIEW v_member_address AS
SELECT DISTINCT btrim(w.member_name)              AS member_name,
       b.address,
       b.district,
       b.subdistrict,
       b.lat,
       b.lng,
       b.booking_code                             AS from_booking,
       b.booking_date                             AS booking_date,
       CASE WHEN b.address IS NOT NULL THEN 'ใบจองที่สำเร็จ'
            ELSE 'ไม่มีที่อยู่' END                 AS source
  FROM weight_query w
  LEFT JOIN v_member_address_from_booking b ON b.member_name = btrim(w.member_name)
 WHERE w.member_name IS NOT NULL AND btrim(w.member_name) <> '';
        $no_customers$;
        RETURN;
    END IF;

    EXECUTE $with_customers$
CREATE OR REPLACE VIEW v_member_address AS
SELECT c.name                                        AS member_name,
       COALESCE(NULLIF(btrim(c.address), ''), b.address)      AS address,
       COALESCE(c.amphure, b.district)               AS district,
       COALESCE(c.tambon, b.subdistrict)             AS subdistrict,
       b.lat,
       b.lng,
       b.booking_code                                AS from_booking,
       b.booking_date                                AS booking_date,
       CASE
           WHEN NULLIF(btrim(c.address), '') IS NOT NULL THEN 'ระบบสมาชิก'
           WHEN b.address IS NOT NULL                    THEN 'ใบจองที่สำเร็จ'
           ELSE 'ไม่มีที่อยู่'
       END                                           AS source
  FROM (
      -- ชื่อซ้ำใน customers มีจริง เอาแถว id ต่ำสุดพอ ไม่งั้น join บานเป็นทวีคูณ
      SELECT DISTINCT ON (btrim(fullname))
             btrim(cu.fullname) AS name,
             cu.address,
             a.name_th          AS amphure,
             t.name_th          AS tambon
        FROM customers cu
        LEFT JOIN thai_amphures a ON a.id = cu.id_amphures
        LEFT JOIN thai_tambons  t ON t.id = cu.id_tambons
       WHERE cu.fullname IS NOT NULL AND btrim(cu.fullname) <> ''
       ORDER BY btrim(cu.fullname), cu.id
  ) c
  LEFT JOIN v_member_address_from_booking b ON b.member_name = c.name;
    $with_customers$;
END
$member_address$;

-- สรุปว่าการเติมช่วยได้แค่ไหน ใช้โชว์บนหน้าเว็บ
CREATE OR REPLACE VIEW v_member_address_coverage AS
SELECT count(*)                                                   AS members,
       count(*) FILTER (WHERE source = 'ระบบสมาชิก')               AS from_system,
       count(*) FILTER (WHERE source = 'ใบจองที่สำเร็จ')            AS from_booking,
       count(*) FILTER (WHERE source = 'ไม่มีที่อยู่')              AS still_missing,
       count(*) FILTER (WHERE lat IS NOT NULL)                     AS with_pin
  FROM v_member_address;

COMMIT;

DO $check$
BEGIN
    IF to_regclass('public.v_member_address') IS NULL THEN
        RAISE EXCEPTION 'สร้าง v_member_address ไม่สำเร็จ';
    END IF;
    RAISE NOTICE 'OK: ที่อยู่สมาชิกจากใบจองพร้อมใช้';
END
$check$;

-- ============================================================
-- ออร์เดอร์ทั้งหมด = ใบจองที่ยังไม่จบ + บิลจริงของงานที่จบแล้ว
--
-- ปัญหา: หน้า Reservation ของระบบต้นทางดึงย้อนหลังได้จำกัด ใบจองเก่าจึงไม่ครบ
-- ถ้านับยอดจองจาก booking_queue ตรง ๆ เดือนเก่าจะดูเหมือนไม่มีงาน
--
-- ทางแก้: งานที่ "สำเร็จ" ไม่ต้องพึ่งใบจองเลย เพราะทุกงานที่รถไปรับจริง
-- ออกบิลเสมอ และบิลมีครบตั้งแต่ 2024-02 — เอาบิลมาเป็นออร์เดอร์ที่จบแล้วแทน
-- ส่วนใบจองใช้เฉพาะงานที่ยังไม่จบ (รอยืนยัน/กำลังเข้ารับ/ยกเลิก)
--
-- กันนับซ้ำ: ใบจองสถานะ 'สำเร็จ' ถูกตัดออกทั้งหมด เพราะจะมีบิลของมันอยู่แล้ว
--
-- เขตของบิลมาจาก v_member_address (ที่อยู่ในระบบ หรือจากใบจองที่สำเร็จ)
-- ================================================================
BEGIN;

SET client_min_messages = warning;

DO $guard_v_orders$
BEGIN
    IF to_regclass('public.booking_queue') IS NULL THEN
        RAISE NOTICE 'ยังไม่มี booking_queue — ออร์เดอร์จะนับจากบิลจริงอย่างเดียว';
        -- ยังคำนวณจากบิลได้ แค่ไม่มีงานที่ยังไม่จบมาเติม
        EXECUTE $only_bills$
CREATE OR REPLACE VIEW v_orders AS
SELECT w.purchase_date                          AS order_date,
       w.purchase_number                        AS order_code,
       btrim(w.member_name)                     AS member_name,
       a.district,
       btrim(w.driver_name)                     AS worker,
       w.station,
       'สำเร็จ'::text                            AS status,
       'บิลจริง'::text                           AS source,
       round(sum(w.net_weight)::numeric, 2)     AS total_kg,
       round(sum(w.total_price)::numeric, 2)    AS total_baht
  FROM weight_query w
  LEFT JOIN v_member_address a ON a.member_name = btrim(w.member_name)
 WHERE w.purchase_number IS NOT NULL
 GROUP BY w.purchase_date, w.purchase_number, btrim(w.member_name),
          a.district, btrim(w.driver_name), w.station;
        $only_bills$;
        RETURN;
    END IF;
    EXECUTE $sql$
CREATE OR REPLACE VIEW v_orders AS
-- (1) งานที่จบแล้ว — หนึ่งบิล = หนึ่งออร์เดอร์
SELECT w.purchase_date                          AS order_date,
       w.purchase_number                        AS order_code,
       btrim(w.member_name)                     AS member_name,
       a.district,
       btrim(w.driver_name)                     AS worker,
       w.station,
       'สำเร็จ'::text                            AS status,
       'บิลจริง'::text                           AS source,
       round(sum(w.net_weight)::numeric, 2)     AS total_kg,
       round(sum(w.total_price)::numeric, 2)    AS total_baht
  FROM weight_query w
  LEFT JOIN v_member_address a ON a.member_name = btrim(w.member_name)
 WHERE w.purchase_number IS NOT NULL
 GROUP BY w.purchase_date, w.purchase_number, btrim(w.member_name),
          a.district, btrim(w.driver_name), w.station

UNION ALL

-- (2) งานที่ยังไม่จบ — ยังไม่มีบิล ต้องอ่านจากใบจอง
SELECT b.booking_date                           AS order_date,
       b.booking_code                           AS order_code,
       btrim(b.member_name)                     AS member_name,
       b.district,
       btrim(b.vehicle)                         AS worker,
       NULL::text                               AS station,
       b.status,
       'ใบจอง'::text                            AS source,
       NULL::numeric                            AS total_kg,
       NULL::numeric                            AS total_baht
  FROM booking_queue b
 WHERE b.status <> 'สำเร็จ';
    $sql$;
END
$guard_v_orders$;

-- ยอดออร์เดอร์รายเขต ใช้แทนการนับ booking_queue ตรง ๆ
CREATE OR REPLACE VIEW v_orders_by_district AS
SELECT district,
       count(*)                                          AS orders,
       count(*) FILTER (WHERE status = 'สำเร็จ')          AS done,
       count(*) FILTER (WHERE status = 'ยกเลิก')         AS cancelled,
       count(*) FILTER (WHERE status = 'รอยืนยัน')        AS pending,
       count(*) FILTER (WHERE status LIKE 'อยู่ระหว่าง%'
                           OR status = 'ยืนยัน')          AS in_progress,
       min(order_date)                                   AS first_date,
       max(order_date)                                   AS last_date,
       round(sum(total_baht)::numeric, 2)                AS total_baht
  FROM v_orders
 WHERE district IS NOT NULL AND btrim(district) <> ''
 GROUP BY district;

-- ที่มาของตัวเลข ใช้บอกผู้ใช้บนหน้าเว็บว่าอะไรมาจากไหน
CREATE OR REPLACE VIEW v_orders_source AS
SELECT source,
       status,
       count(*)        AS orders,
       min(order_date) AS first_date,
       max(order_date) AS last_date
  FROM v_orders
 GROUP BY source, status;

COMMIT;

DO $check$
BEGIN
    IF to_regclass('public.v_orders') IS NULL THEN
        RAISE EXCEPTION 'สร้าง v_orders ไม่สำเร็จ';
    END IF;
    RAISE NOTICE 'OK: v_orders พร้อม — ใบจองที่ยังไม่จบ + บิลจริงของงานที่จบแล้ว';
END
$check$;
