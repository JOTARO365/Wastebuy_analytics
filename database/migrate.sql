-- ============================================================
-- migrate.sql — ไฟล์เดียวที่ทำให้ฐานข้อมูลพร้อมใช้งาน
--
-- รันตัวนี้ตัวเดียวจบ ไม่ต้องไล่รันทีละไฟล์ และรันซ้ำได้เสมอ
-- (scripts/setup.ps1 เรียกไฟล์นี้ให้อยู่แล้ว — สั่งเองเมื่ออยากอัปเดตเฉพาะฐาน)
--
--     psql -v ON_ERROR_STOP=1 -d wastebuy-analytics -f database/migrate.sql
--
-- ── ลำดับสำคัญ ห้ามสลับ ────────────────────────────────────
--  1. rename_columns          ชื่อคอลัมน์ต้องถูกก่อน ไม่งั้น view ทุกตัวอ้างผิด
--  2. add_weight_query_columns  เพิ่ม 4 คอลัมน์ที่ import รอบใหม่จะเติมค่า
--  3. driver_performance      view ผลงานคนขับ + ราคากลาง (materialized)
--  4. recurring_jobs          ตารางงานประจำ วันหยุด และ view สถานะ
--  5. analysis_v2             หมวดสินค้า ที่อยู่สมาชิก ออร์เดอร์ RFM คลัง
--  6. station_coords          ความแม่นยำของพิกัดคลัง
--  7. analysis_cache          materialized view ทั้งชุด — ต้องเป็นตัวสุดท้าย
--                             เพราะมันคัดลอกผลของทุกไฟล์ข้างบน
--
-- ── ของที่ไฟล์นี้ไม่ได้สร้าง ───────────────────────────────
-- ตาราง stations / district_centroids / booking_queue / vehicle_station_map
-- มาจาก zone_analysis_*.sql ของ repo automation ถ้ายังไม่มี ไฟล์นี้ยังรันผ่าน
-- แต่ส่วนที่ต้องใช้ตารางพวกนั้นจะสร้างเป็น view เปล่าไว้ก่อน แล้วขึ้น NOTICE บอก
-- โหลด zone เมื่อไรให้รันไฟล์นี้ซ้ำ ทุกอย่างจะเต็มเอง
--
-- zone_analysis ขึ้นต้นด้วย DROP TABLE ... CASCADE ซึ่งลบ view ของไฟล์ 3-7 ทิ้ง
-- **โหลด zone แล้วต้องรัน migrate.sql ซ้ำเสมอ**
-- ============================================================

\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';

\echo ''
\echo '=== 1/7  ตั้งชื่อคอลัมน์ weight_query ให้ตรงความหมาย'
\ir rename_columns.sql

\echo ''
\echo '=== 2/7  เพิ่มคอลัมน์ที่เคยถูกทิ้งตอน import'
\ir add_weight_query_columns.sql

\echo ''
\echo '=== 3/7  view ผลงานคนขับ'
\ir driver_performance.sql

\echo ''
\echo '=== 4/7  ตารางงานประจำ + วันหยุด'
\ir recurring_jobs.sql

\echo ''
\echo '=== 5/7  view วิเคราะห์ (หมวดสินค้า ที่อยู่ ออร์เดอร์ สมาชิก คลัง)'
\ir analysis_v2.sql

\echo ''
\echo '=== 6/7  ความแม่นยำพิกัดคลัง'
\ir station_coords.sql

\echo ''
\echo '=== 7/7  ชั้น cache (materialized view)'
\ir analysis_cache.sql

-- ── สรุปว่าอะไรพร้อม อะไรยังขาด ─────────────────────────────
-- พิมพ์ผลให้คนอ่านตัดสินใจได้เอง ไม่ใช่เงียบแล้วปล่อยให้ไปเจอบนหน้าเว็บ
\echo ''
\echo '=== ตรวจความพร้อม'

-- ไฟล์ที่ include ไปตั้ง client_min_messages = warning ไว้ (กัน NOTICE ของ
-- IF NOT EXISTS ท่วมจอ) ค่านั้นค้างอยู่ทั้ง session — ต้องเปิดกลับ ไม่งั้น
-- สรุปข้างล่างนี้ถูกกลืนหายไปเงียบ ๆ
SET client_min_messages = notice;

DO $summary$
DECLARE
    missing_required text[] := '{}';
    missing_zone     text[] := '{}';
    obj              text;
    n_matviews       int;
BEGIN
    -- ตารางที่ระบบขาดไม่ได้
    FOREACH obj IN ARRAY ARRAY['weight_query', 'customers', 'materials',
                               'thai_amphures', 'recurring_jobs', 'holidays',
                               'item_category_overrides', 'ai_runs',
                               'analysis_cache_log']
    LOOP
        IF to_regclass('public.' || obj) IS NULL THEN
            missing_required := missing_required || obj;
        END IF;
    END LOOP;

    -- ตารางฝั่ง zone — ไม่มีก็ยังใช้ระบบได้ แค่หน้า Zone ว่าง
    FOREACH obj IN ARRAY ARRAY['stations', 'district_centroids',
                               'booking_queue', 'vehicle_station_map']
    LOOP
        IF to_regclass('public.' || obj) IS NULL THEN
            missing_zone := missing_zone || obj;
        END IF;
    END LOOP;

    SELECT count(*) INTO n_matviews
      FROM pg_matviews WHERE schemaname = 'public';

    RAISE NOTICE 'materialized view ที่สร้างแล้ว: % ตัว', n_matviews;

    IF array_length(missing_zone, 1) > 0 THEN
        RAISE NOTICE 'ยังไม่มีข้อมูลโซน (%) — หน้า Zone Coverage/Members จะว่าง',
                     array_to_string(missing_zone, ', ');
        RAISE NOTICE 'โหลด zone_analysis_*.sql จาก repo automation แล้วรันไฟล์นี้ซ้ำ';
    END IF;

    IF array_length(missing_required, 1) > 0 THEN
        RAISE EXCEPTION 'ยังขาดของจำเป็น: %', array_to_string(missing_required, ', ');
    END IF;

    RAISE NOTICE 'ฐานข้อมูลพร้อมใช้งาน';
END
$summary$;

\echo ''
\echo '    เสร็จ — cache คำนวณครั้งแรกไว้แล้ว'
\echo '    หลังจากนี้ระบบตรวจข้อมูลใหม่และคำนวณให้เองทุก 15 นาที'
\echo ''
