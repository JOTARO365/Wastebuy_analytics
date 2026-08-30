-- ============================================================
-- analysis_cache.sql — ชั้น cache ของ view วิเคราะห์
--
-- ปัญหา: view ทุกตัวอ่าน weight_query 1.3M แถวสดทุกครั้งที่เปิดหน้า
-- วัดจริงก่อนทำไฟล์นี้ (เครื่อง dev, PostgreSQL 15):
--
--     v_driver_performance     53.8 s
--     v_month_facts            18.7 s
--     v_zone_member_summary    18.4 s
--     v_member_rfm             13.8 s
--     v_station_performance     4.8 s
--
-- ข้อมูลเข้าเดือนละครั้ง แต่คนเปิดหน้าวันละหลายสิบครั้ง — คำนวณซ้ำทุกครั้งจึงเปล่าประโยชน์
-- ไฟล์นี้ทำ materialized view ทับของเดิม แล้วให้ backend อ่านตัว mv_ แทน
--
-- ต้องรันหลัง: rename_columns.sql · zone_analysis_*.sql · driver_performance.sql
--              · recurring_jobs.sql · analysis_v2.sql
-- และต้องรันซ้ำทุกครั้งหลังโหลดข้อมูลเดือนใหม่ (หรือเรียก refresh_analysis_cache())
--
-- Run: psql -v ON_ERROR_STOP=1 -f database/analysis_cache.sql
-- ============================================================

SET client_encoding = 'UTF8';

BEGIN;

SET client_min_messages = warning;

-- ── index ที่ view พวกนี้ต้องใช้ ─────────────────────────────
-- ไม่มี index พวกนี้ ต่อให้ทำ cache การ refresh ก็ยังนาน
CREATE INDEX IF NOT EXISTS weight_query_purchase_date_idx
    ON weight_query (purchase_date);

CREATE INDEX IF NOT EXISTS weight_query_item_code_idx
    ON weight_query (item_code);

-- partial: มีแค่ 19% ของแถวที่มี station (เพิ่งเริ่มเก็บ 2026-04)
-- index เต็มตารางจะใหญ่กว่าที่ต้องใช้ 5 เท่าโดยไม่ได้อะไรเพิ่ม
CREATE INDEX IF NOT EXISTS weight_query_station_idx
    ON weight_query (btrim(station)) WHERE station IS NOT NULL;

-- ── cache ของแต่ละ view ─────────────────────────────────────
-- ตั้งชื่อ mv_<ชื่อ view เดิม> เพื่อให้ตามได้ว่ามาจากไหน
-- แต่ละตัวต้องมี unique index ถึงจะ REFRESH CONCURRENTLY ได้
-- (CONCURRENTLY = คนเปิดหน้าอยู่ยังอ่านของเก่าได้ระหว่าง refresh ไม่ค้าง)

DROP MATERIALIZED VIEW IF EXISTS mv_member_activity CASCADE;
CREATE MATERIALIZED VIEW mv_member_activity AS SELECT * FROM v_member_activity;
CREATE UNIQUE INDEX mv_member_activity_pk ON mv_member_activity (member_name);

-- RFM คำนวณจาก cache ของ member_activity ไม่ใช่จาก weight_query
-- window function บน 29,567 แถวเร็วอยู่แล้ว ไม่ต้อง cache ซ้ำอีกชั้น
CREATE OR REPLACE VIEW v_member_rfm AS
WITH bounds AS (
    SELECT max(last_date) AS data_date FROM mv_member_activity
), scored AS (
    SELECT a.*,
           b.data_date,
           (b.data_date - a.last_date)  AS days_since,
           (a.last_date - a.first_date) AS lifespan_days,
           ntile(5) OVER (ORDER BY a.last_date)  AS r_score,
           ntile(5) OVER (ORDER BY a.visits)     AS f_score,
           ntile(5) OVER (ORDER BY a.total_baht) AS m_score
      FROM mv_member_activity a CROSS JOIN bounds b
)
SELECT member_name,
       visits, bills, lines, total_kg, total_baht,
       first_date, last_date, data_date, days_since, lifespan_days,
       drivers, active_months,
       r_score, f_score, m_score,
       round(total_baht / NULLIF(visits, 0), 2)  AS baht_per_visit,
       round(total_kg  / NULLIF(visits, 0), 2)   AS kg_per_visit,
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

DROP MATERIALIZED VIEW IF EXISTS mv_station_performance CASCADE;
CREATE MATERIALIZED VIEW mv_station_performance AS SELECT * FROM v_station_performance;
CREATE UNIQUE INDEX mv_station_performance_pk ON mv_station_performance (station);

DROP MATERIALIZED VIEW IF EXISTS mv_station_materials CASCADE;
CREATE MATERIALIZED VIEW mv_station_materials AS SELECT * FROM v_station_materials;
CREATE UNIQUE INDEX mv_station_materials_pk ON mv_station_materials (station, category);

DROP MATERIALIZED VIEW IF EXISTS mv_station_monthly CASCADE;
CREATE MATERIALIZED VIEW mv_station_monthly AS SELECT * FROM v_station_monthly;
CREATE UNIQUE INDEX mv_station_monthly_pk ON mv_station_monthly (station, month);

-- ที่อยู่สมาชิก: join customers x ใบจองที่สำเร็จ 76k แถว อ่านสดทุกครั้งไม่ไหว
DROP MATERIALIZED VIEW IF EXISTS mv_member_address CASCADE;
CREATE MATERIALIZED VIEW mv_member_address AS SELECT * FROM v_member_address;
CREATE UNIQUE INDEX mv_member_address_pk ON mv_member_address (member_name);

-- ออร์เดอร์รวม: บิลจริง 157k + ใบจองที่ยังไม่จบ 29k
-- อ่านสด 23 วินาที ทุกครั้งที่เปิดหน้าโซน
DROP MATERIALIZED VIEW IF EXISTS mv_orders CASCADE;
CREATE MATERIALIZED VIEW mv_orders AS SELECT * FROM v_orders;
CREATE UNIQUE INDEX mv_orders_pk ON mv_orders (order_code, order_date, member_name);
CREATE INDEX mv_orders_district_idx ON mv_orders (district);
CREATE INDEX mv_orders_date_idx ON mv_orders (order_date);

DROP MATERIALIZED VIEW IF EXISTS mv_orders_by_district CASCADE;
CREATE MATERIALIZED VIEW mv_orders_by_district AS SELECT * FROM v_orders_by_district;
CREATE UNIQUE INDEX mv_orders_by_district_pk ON mv_orders_by_district (district);

DROP MATERIALIZED VIEW IF EXISTS mv_station_coverage CASCADE;
CREATE MATERIALIZED VIEW mv_station_coverage AS SELECT * FROM v_station_coverage;
CREATE UNIQUE INDEX mv_station_coverage_pk ON mv_station_coverage (first_date);

DROP MATERIALIZED VIEW IF EXISTS mv_month_facts CASCADE;
CREATE MATERIALIZED VIEW mv_month_facts AS SELECT * FROM v_month_facts;
CREATE UNIQUE INDEX mv_month_facts_pk ON mv_month_facts (month);

DROP MATERIALIZED VIEW IF EXISTS mv_item_category CASCADE;
CREATE MATERIALIZED VIEW mv_item_category AS SELECT * FROM v_item_category;
CREATE UNIQUE INDEX mv_item_category_pk ON mv_item_category (item_code);

DROP MATERIALIZED VIEW IF EXISTS mv_unknown_items CASCADE;
CREATE MATERIALIZED VIEW mv_unknown_items AS SELECT * FROM v_unknown_items;
CREATE UNIQUE INDEX mv_unknown_items_pk ON mv_unknown_items (item_code);

-- ── cache ของ view ที่มาจากไฟล์อื่น ─────────────────────────
-- สร้างเฉพาะเมื่อ view ต้นทางมีอยู่ ไฟล์นี้จึงรันได้แม้ยังไม่ได้โหลด zone
DO $cache$
DECLARE
    src  record;
    made int := 0;
BEGIN
    FOR src IN
        SELECT * FROM (VALUES
            ('v_driver_performance',  'mv_driver_performance',  'driver'),
            ('v_driver_monthly',      'mv_driver_monthly',      'driver, month'),
            ('v_zone_member_summary', 'mv_zone_member_summary',
             'district, channel, segment, customer_group, nearest_station'),
            ('v_booking_by_ring',     'mv_booking_by_ring',
             'nearest_station, district, ring')
        ) AS x(source, target, keys)
    LOOP
        IF to_regclass('public.' || src.source) IS NULL THEN
            RAISE NOTICE 'ข้าม % — ยังไม่มี view ต้นทาง', src.target;
            CONTINUE;
        END IF;

        EXECUTE format('DROP MATERIALIZED VIEW IF EXISTS %I CASCADE', src.target);
        EXECUTE format('CREATE MATERIALIZED VIEW %I AS SELECT * FROM %I',
                       src.target, src.source);
        EXECUTE format('CREATE UNIQUE INDEX %I ON %I (%s)',
                       src.target || '_pk', src.target, src.keys);
        made := made + 1;
    END LOOP;

    RAISE NOTICE 'สร้าง cache จาก view ภายนอก % ตัว', made;
END
$cache$;

-- ── refresh ทั้งชุด ─────────────────────────────────────────
-- ลำดับสำคัญ: mv_item_category ต้องมาก่อน mv_station_materials
-- เพราะ view ต้นทางของ station_materials อ่านหมวดที่แก้แล้ว
--
-- ใช้ REFRESH ธรรมดา ไม่ใช่ CONCURRENTLY เพราะ CONCURRENTLY รันใน
-- ทรานแซกชันไม่ได้ และ plpgsql ทั้งฟังก์ชันคือทรานแซกชันเดียว
-- ตัวที่อยากได้ CONCURRENTLY ให้เรียกทีละตัวจากข้างนอกแทน (ดู scripts/refresh-cache.ps1)
CREATE OR REPLACE FUNCTION refresh_analysis_cache()
RETURNS TABLE (view_name text, ms integer) AS $fn$
DECLARE
    t     text;
    t0    timestamptz;
    -- v_item_price_benchmark ต้องมาก่อน mv_driver_performance
    -- เพราะส่วนต่างราคาของคนขับเทียบกับราคากลางในตัวนั้น
    -- refresh ทีหลัง = คนขับถูกวัดด้วยราคากลางของรอบก่อน
    order_list text[] := ARRAY[
        'v_item_price_benchmark',
        'mv_item_category',
        'mv_unknown_items',
        -- ที่อยู่ต้องมาก่อนออร์เดอร์ เพราะเขตของบิลมาจากที่อยู่สมาชิก
        'mv_member_address',
        'mv_orders',
        'mv_orders_by_district',
        'mv_member_activity',
        'mv_station_performance',
        'mv_station_materials',
        'mv_station_monthly',
        'mv_station_coverage',
        'mv_month_facts',
        'mv_driver_performance',
        'mv_driver_monthly',
        'mv_zone_member_summary',
        'mv_booking_by_ring'
    ];
BEGIN
    FOREACH t IN ARRAY order_list LOOP
        IF to_regclass('public.' || t) IS NULL THEN
            CONTINUE;
        END IF;
        t0 := clock_timestamp();
        EXECUTE format('REFRESH MATERIALIZED VIEW %I', t);
        view_name := t;
        ms := (EXTRACT(EPOCH FROM (clock_timestamp() - t0)) * 1000)::int;
        RETURN NEXT;
    END LOOP;
END
$fn$ LANGUAGE plpgsql;

COMMENT ON FUNCTION refresh_analysis_cache() IS
    'refresh cache ทุกตัวตามลำดับ dependency — เรียกหลังโหลดข้อมูลเดือนใหม่ทุกครั้ง';

-- บอกว่า cache อัปเดตล่าสุดเมื่อไร ให้หน้าเว็บแสดงได้ว่าข้อมูลเก่าแค่ไหน
CREATE TABLE IF NOT EXISTS analysis_cache_log (
    id           serial PRIMARY KEY,
    refreshed_at timestamptz NOT NULL DEFAULT now(),
    detail       jsonb
);

COMMIT;

DO $check$
DECLARE missing text[];
BEGIN
    SELECT array_agg(want.name) INTO missing
      FROM (VALUES ('mv_member_activity'), ('mv_station_performance'),
                   ('mv_member_address'), ('mv_orders'),
                   ('mv_station_coverage'),
                   ('mv_station_materials'), ('mv_station_monthly'),
                   ('mv_month_facts'), ('mv_item_category'), ('mv_unknown_items'),
                   ('analysis_cache_log')
           ) AS want(name)
     WHERE to_regclass('public.' || want.name) IS NULL;
    IF missing IS NOT NULL THEN
        RAISE EXCEPTION 'analysis_cache ไม่ครบ ขาด: %', array_to_string(missing, ', ');
    END IF;
    RAISE NOTICE 'OK: analysis_cache พร้อม — เรียก SELECT * FROM refresh_analysis_cache(); หลังโหลดข้อมูลใหม่';
END
$check$;
