-- ============================================================
-- งานประจำ (recurring jobs) + ตารางนัดเข้ารับ
-- ------------------------------------------------------------
-- รันซ้ำได้ ไม่ลบข้อมูลที่มีอยู่
--     psql -v ON_ERROR_STOP=1 -f database/recurring_jobs.sql
--
-- หลักการสำคัญ: ประวัติต้องไม่เปลี่ยนตามการแก้งานประจำ
--
--   ตั้งงาน "ก" ไว้วันที่ 20 → ส่งสำเร็จ
--   เดือนถัดมาเปลี่ยนเป็นงาน "ข"
--   วันที่ 20 เดือนก่อนต้องยังเป็น "ก" อยู่
--
-- ชื่องานจึงถูก "แช่" ไว้ในแถวนัดตั้งแต่ตอนสร้าง
--
-- ส่วน "ตัวเลข" ไม่ต้องแช่ — ดึงจากธุรกรรมจริงของสมาชิกในงาน ณ วันที่นัด
-- (แก้รายชื่อแล้วประวัติจะถูกต้องขึ้นตามไปด้วย ซึ่งเป็นสิ่งที่ต้องการ)
-- ============================================================

BEGIN;

SET client_min_messages = warning;

-- ทุกนัดต้องค้น weight_query ด้วย (วันที่ + ชื่อสมาชิก) ถ้าไม่มี index
-- จะ scan 1.3M แถวต่อ 1 นัด — เดือนละ 20 นัดก็หมดเวลาก่อนตอบ
CREATE INDEX IF NOT EXISTS weight_query_date_location_idx
    ON weight_query (purchase_date, btrim(member_name));

-- ── งานประจำ ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recurring_jobs (
    id          serial PRIMARY KEY,
    job_name    text NOT NULL,
    note        text,
    is_active   boolean NOT NULL DEFAULT true,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS recurring_jobs_name_idx
    ON recurring_jobs (lower(btrim(job_name)));

-- ── สมาชิกในงานประจำ ────────────────────────────────────────
-- เก็บเป็นชื่อ ไม่ใช่ customers.id เพราะ customers ถูก full-refresh ทุกเดือน
-- (ดู generate_customers_from_excel_sql.py) id เปลี่ยนได้ทุกรอบ ชื่อไม่เปลี่ยน
CREATE TABLE IF NOT EXISTS recurring_job_members (
    job_id       integer NOT NULL REFERENCES recurring_jobs(id) ON DELETE CASCADE,
    member_name  text NOT NULL,
    PRIMARY KEY (job_id, member_name)
);

-- ── วันหยุด ────────────────────────────────────────────────
-- เสาร์-อาทิตย์ตรวจจากตัววันที่เอง ตารางนี้เก็บเฉพาะวันหยุดนักขัตฤกษ์
-- และวันที่บริษัทประกาศหยุดเอง
CREATE TABLE IF NOT EXISTS holidays (
    holiday_date  date PRIMARY KEY,
    holiday_name  text NOT NULL,
    note          text,
    -- 'manual' = คนกรอกเอง, 'google' = ดึงจากปฏิทินวันหยุดไทยของ Google
    -- การ sync จะไม่ทับของที่คนกรอกเอง เพราะวันหยุดบริษัทไม่มีในปฏิทินสาธารณะ
    source        text NOT NULL DEFAULT 'manual',
    synced_at     timestamptz
);

ALTER TABLE holidays ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';
ALTER TABLE holidays ADD COLUMN IF NOT EXISTS synced_at timestamptz;

-- ── ตารางนัดเข้ารับ ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recurring_schedule (
    id                 serial PRIMARY KEY,
    -- ลบงานประจำแล้วนัดเก่าต้องอยู่ต่อ จึงเป็น SET NULL ไม่ใช่ CASCADE
    job_id             integer REFERENCES recurring_jobs(id) ON DELETE SET NULL,
    scheduled_date     date NOT NULL,

    -- ชื่องาน ณ วันที่นัด — เป็นป้ายกำกับของนัดนั้น ไม่เปลี่ยนตามการแก้ชื่อภายหลัง
    job_name_snapshot  text NOT NULL,
    -- รายชื่อสำรอง ใช้เฉพาะตอนงานประจำถูกลบไปแล้ว (ปกติอ่านรายชื่อปัจจุบัน)
    members_snapshot   text[] NOT NULL DEFAULT '{}',

    driver             text,
    status             text NOT NULL DEFAULT 'วางแผน',
    note               text,
    created_at         timestamptz NOT NULL DEFAULT now(),
    updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS recurring_schedule_date_idx
    ON recurring_schedule (scheduled_date);
CREATE INDEX IF NOT EXISTS recurring_schedule_job_idx
    ON recurring_schedule (job_id);

-- งานเดียวกันห้ามซ้ำวันเดียวกัน
CREATE UNIQUE INDEX IF NOT EXISTS recurring_schedule_unique_idx
    ON recurring_schedule (job_id, scheduled_date)
 WHERE job_id IS NOT NULL;

-- ── งานประจำพร้อมรายชื่อสมาชิก ──────────────────────────────
CREATE OR REPLACE VIEW v_recurring_jobs AS
SELECT j.id,
       j.job_name,
       j.note,
       j.is_active,
       j.created_at,
       j.updated_at,
       COALESCE(array_agg(m.member_name ORDER BY m.member_name)
                FILTER (WHERE m.member_name IS NOT NULL), '{}') AS members,
       count(m.member_name)                                     AS member_count
  FROM recurring_jobs j
  LEFT JOIN recurring_job_members m ON m.job_id = j.id
 GROUP BY j.id;

-- ── นัด + สถานะวันหยุด ──────────────────────────────────────
-- DROP ก่อน เพราะ CREATE OR REPLACE เปลี่ยนชื่อคอลัมน์เดิมไม่ได้
DROP VIEW IF EXISTS v_recurring_schedule CASCADE;
CREATE VIEW v_recurring_schedule AS
SELECT s.id,
       s.job_id,
       s.scheduled_date,
       s.job_name_snapshot,
       s.members_snapshot,
       s.driver,
       -- สถานะที่คนกรอกไว้ยังเก็บอยู่เป็นบันทึกภายใน แต่ที่แสดงคือค่าที่คำนวณ
       s.status AS status_manual,
       s.note,
       -- ISO: 6 = เสาร์, 7 = อาทิตย์
       EXTRACT(ISODOW FROM s.scheduled_date) >= 6      AS is_weekend,
       h.holiday_name,
       (h.holiday_date IS NOT NULL
        OR EXTRACT(ISODOW FROM s.scheduled_date) >= 6) AS is_holiday,
       -- งานที่ถูกลบไปแล้ว นัดเก่ายังอยู่ ต้องบอกให้รู้ว่าแก้ต่อไม่ได้
       (s.job_id IS NULL)                              AS job_deleted
  FROM recurring_schedule s
  LEFT JOIN holidays h ON h.holiday_date = s.scheduled_date;

-- ── รายชื่อสมาชิกที่ใช้ดึงตัวเลขของแต่ละนัด ───────────────────
-- ใช้รายชื่อ "ปัจจุบัน" ของงานเป็นหลัก ไม่ใช่รายชื่อที่แช่ไว้ตอนสร้างนัด
-- เพราะตัวเลขต้องมาจากธุรกรรมจริงของสมาชิกในวันนั้น ถ้าเพิ่งรู้ว่าลืมใส่
-- สมาชิกคนหนึ่ง ประวัติเดือนก่อนควรถูกต้องขึ้นตามไปด้วย
--
-- members_snapshot เหลือไว้เป็นตัวสำรองกรณีเดียว: งานประจำถูกลบไปแล้ว
-- (job_id เป็น NULL) ซึ่งไม่มีรายชื่อปัจจุบันให้อ้างอีก
--
-- ส่วนชื่องาน (job_name_snapshot) ยังแช่ไว้เหมือนเดิม เพราะเป็นป้ายกำกับ
-- ของนัดนั้น เปลี่ยนชื่องานเดือนนี้ไม่ควรไปเขียนประวัติเดือนก่อนใหม่
CREATE OR REPLACE VIEW v_recurring_schedule_members AS
SELECT s.id AS schedule_id,
       COALESCE(
           (SELECT array_agg(m.member_name)
              FROM recurring_job_members m
             WHERE m.job_id = s.job_id),
           s.members_snapshot
       ) AS members
  FROM recurring_schedule s;

-- ── ผลงานจริงของแต่ละนัด ────────────────────────────────────
-- ตัวเลขมาจากธุรกรรมจริงของสมาชิกในงาน ณ วันที่นัด
CREATE OR REPLACE VIEW v_recurring_actuals AS
SELECT s.id                                   AS schedule_id,
       s.scheduled_date,
       s.job_name_snapshot,
       s.driver                               AS assigned_driver,
       count(DISTINCT w.purchase_number)      AS bills,
       count(w.id)                            AS lines,
       count(DISTINCT w.member_name)             AS members_served,
       -- net_weight = จำนวนน้ำหนักสุทธิ (ชื่อถูกแก้โดย rename_columns.sql)
       round(COALESCE(sum(w.net_weight), 0)::numeric, 2)  AS total_kg,
       round(COALESCE(sum(w.total_price), 0)::numeric, 2)   AS total_baht,
       array_agg(DISTINCT w.driver_name)
           FILTER (WHERE w.driver_name IS NOT NULL)        AS actual_drivers
  FROM recurring_schedule s
  JOIN v_recurring_schedule_members sm ON sm.schedule_id = s.id
  LEFT JOIN weight_query w
         ON w.purchase_date = s.scheduled_date
        AND btrim(w.member_name) = ANY (sm.members)
 GROUP BY s.id, s.scheduled_date, s.job_name_snapshot, s.driver;

-- ── วัสดุที่รับเข้าในแต่ละนัด ────────────────────────────────
CREATE OR REPLACE VIEW v_recurring_materials AS
SELECT s.id                                  AS schedule_id,
       s.scheduled_date,
       s.job_name_snapshot,
       w.category,
       w.item_name,
       count(DISTINCT w.purchase_number)     AS bills,
       round(sum(w.net_weight)::numeric, 2) AS total_kg,
       round(sum(w.total_price)::numeric, 2)  AS total_baht
  FROM recurring_schedule s
  JOIN v_recurring_schedule_members sm ON sm.schedule_id = s.id
  JOIN weight_query w
    ON w.purchase_date = s.scheduled_date
   AND btrim(w.member_name) = ANY (sm.members)
 GROUP BY s.id, s.scheduled_date, s.job_name_snapshot, w.category, w.item_name;

-- ── เลื่อนออกจากวันหยุด ─────────────────────────────────────
-- เลื่อนไปข้างหน้าจนเจอวันทำการ ไม่เลื่อนถอยหลัง เพราะนัดที่ถอยหลัง
-- อาจไปตกวันที่ผ่านมาแล้ว ซึ่งจัดรถไม่ทัน
-- จำกัด 14 วันกันวนไม่จบถ้ามีคนใส่วันหยุดยาวผิดปกติ
CREATE OR REPLACE FUNCTION next_working_day(d date) RETURNS date AS $fn$
DECLARE cur date := d;
BEGIN
    FOR i IN 1..14 LOOP
        IF EXTRACT(ISODOW FROM cur) < 6
           AND NOT EXISTS (SELECT 1 FROM holidays WHERE holiday_date = cur) THEN
            RETURN cur;
        END IF;
        cur := cur + 1;
    END LOOP;
    RETURN d;
END
$fn$ LANGUAGE plpgsql STABLE;

-- ── ผลรายสมาชิกของแต่ละนัด ──────────────────────────────────
-- งานประจำหนึ่งงานมีได้หลายสมาชิก ยอดรวมดูเป็นก้อนเดียว
-- แต่ต้องแยกดูรายเจ้าได้ว่าใครส่งของ ใครไม่ส่ง
CREATE OR REPLACE VIEW v_recurring_member_actuals AS
SELECT s.id                                    AS schedule_id,
       s.scheduled_date,
       s.job_name_snapshot,
       m.member_name,
       count(DISTINCT w.purchase_number)       AS bills,
       -- net_weight เก็บ "จำนวนน้ำหนักสุทธิ" ไม่ใช่ราคาต่อกิโล (docs/PLAN.md D1)
       round(COALESCE(sum(w.net_weight), 0)::numeric, 2) AS total_kg,
       round(COALESCE(sum(w.total_price), 0)::numeric, 2)  AS total_baht,
       array_agg(DISTINCT w.driver_name)
           FILTER (WHERE w.driver_name IS NOT NULL)      AS drivers
  FROM recurring_schedule s
  JOIN v_recurring_schedule_members sm ON sm.schedule_id = s.id
  CROSS JOIN LATERAL unnest(sm.members) AS m(member_name)
  LEFT JOIN weight_query w
         ON w.purchase_date = s.scheduled_date
        AND btrim(w.member_name) = m.member_name
 GROUP BY s.id, s.scheduled_date, s.job_name_snapshot, m.member_name;

-- ── สถานะที่คำนวณจากข้อมูลจริง ───────────────────────────────
-- ไม่ให้คนกดเลือกเอง เพราะสถานะที่พิมพ์ไว้กับสิ่งที่เกิดขึ้นจริงมักไม่ตรงกัน
--
-- ลำดับความน่าเชื่อถือ:
--   1. มีบิลรับซื้อจริงในวันนั้น            -> สำเร็จ   (หลักฐานแข็งที่สุด)
--   2. ไม่มีบิล แต่มีใบจองของสมาชิกในวันนั้น -> ตามสถานะใบจอง
--   3. ไม่มีทั้งคู่ และวันยังไม่ถึง          -> รอถึงกำหนด
--   4. ไม่มีทั้งคู่ และวันผ่านไปแล้ว         -> ไม่มีข้อมูล
--
-- booking_queue มาจาก zone_analysis_*.sql ซึ่งอาจยังไม่ได้โหลด
-- จึงสร้าง view สองแบบตามว่ามีตารางนั้นหรือไม่
DO $status$
DECLARE has_booking boolean := to_regclass('public.booking_queue') IS NOT NULL;
BEGIN
    IF has_booking THEN
        EXECUTE $sql$
CREATE OR REPLACE VIEW v_recurring_status AS
SELECT s.id AS schedule_id,
       a.bills,
       b.booking_total,
       b.booking_done,
       b.booking_cancelled,
       b.booking_pending,
       b.booking_progress,
       CASE
           WHEN a.bills > 0                       THEN 'สำเร็จ'
           WHEN b.booking_done > 0                THEN 'สำเร็จ'
           WHEN b.booking_cancelled > 0
                AND b.booking_cancelled = b.booking_total THEN 'ยกเลิก'
           WHEN b.booking_progress > 0            THEN 'ยืนยัน'
           WHEN b.booking_pending > 0             THEN 'รอยืนยัน'
           WHEN s.scheduled_date > CURRENT_DATE   THEN 'รอถึงกำหนด'
           -- ข้อมูลบิลเข้าเป็นรอบเดือน วันที่เลยวันล่าสุดในฐานยังตัดสินไม่ได้
           -- ถ้าตกเป็น 'ไม่มีข้อมูล' ทันที ผู้ใช้จะอ่านว่างานล่ม ทั้งที่แค่ข้อมูลยังไม่มา
           WHEN s.scheduled_date >
                (SELECT max(purchase_date) FROM weight_query) THEN 'รอข้อมูล'
           ELSE 'ไม่มีข้อมูล'
       END AS status
  FROM recurring_schedule s
  JOIN v_recurring_schedule_members sm ON sm.schedule_id = s.id
  LEFT JOIN v_recurring_actuals a ON a.schedule_id = s.id
  LEFT JOIN LATERAL (
      SELECT count(*)                                              AS booking_total,
             count(*) FILTER (WHERE q.status = 'สำเร็จ')            AS booking_done,
             count(*) FILTER (WHERE q.status = 'ยกเลิก')           AS booking_cancelled,
             count(*) FILTER (WHERE q.status = 'รอยืนยัน')          AS booking_pending,
             count(*) FILTER (WHERE q.status LIKE 'อยู่ระหว่าง%'
                                 OR q.status = 'ยืนยัน')            AS booking_progress
        FROM booking_queue q
       WHERE q.booking_date = s.scheduled_date
         AND btrim(q.member_name) = ANY (sm.members)
  ) b ON TRUE;
        $sql$;
    ELSE
        EXECUTE $sql$
CREATE OR REPLACE VIEW v_recurring_status AS
SELECT s.id AS schedule_id,
       a.bills,
       NULL::bigint AS booking_total,
       NULL::bigint AS booking_done,
       NULL::bigint AS booking_cancelled,
       NULL::bigint AS booking_pending,
       NULL::bigint AS booking_progress,
       CASE
           WHEN a.bills > 0                     THEN 'สำเร็จ'
           WHEN s.scheduled_date > CURRENT_DATE THEN 'รอถึงกำหนด'
           WHEN s.scheduled_date >
                (SELECT max(purchase_date) FROM weight_query) THEN 'รอข้อมูล'
           ELSE 'ไม่มีข้อมูล'
       END AS status
  FROM recurring_schedule s
  LEFT JOIN v_recurring_actuals a ON a.schedule_id = s.id;
        $sql$;
        RAISE NOTICE 'ไม่มีตาราง booking_queue — สถานะจะดูจากบิลรับซื้ออย่างเดียว';
    END IF;
END
$status$;

COMMIT;
