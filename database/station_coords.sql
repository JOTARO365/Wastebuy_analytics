-- ============================================================
-- station_coords.sql — บอกว่าพิกัดคลังไหน "ยืนยันแล้ว" คลังไหน "ยังเดา"
--
-- ที่มา: tools/config/stations.csv ของ repo automation
-- (คอลัมน์ coord_precision / coord_note ที่ผู้ใช้กรอกไว้)
--
-- ทำไมต้องแยก: ระยะทาง วงแหวน และเส้นทางบนหน้า Zone คำนวณจากพิกัดพวกนี้
-- และแสดงทศนิยม 0.1 กม. — ถ้าไม่บอกว่าจุดไหนยังเดา ตัวเลขจะดูแม่นเท่ากันหมด
-- เดิมหน้าเว็บเตือนเหมารวมว่า "ทุกจุดยังไม่ยืนยัน" ซึ่งก็ไม่จริงเหมือนกัน
--
-- ตาราง stations ถูกสร้างใหม่ทุกครั้งที่รัน zone_analysis_*.sql (DROP CASCADE)
-- ไฟล์นี้จึงต้องรันซ้ำหลังจากนั้นเสมอ — ไม่งั้นคอลัมน์ที่เพิ่มหายไป
-- ทางแก้ระยะยาว: ให้ generator ฝั่ง automation ใส่สองคอลัมน์นี้มาเอง
-- (ดู docs/PROMPT_data_pipeline.md งานที่ 3)
--
-- Run: psql -v ON_ERROR_STOP=1 -f database/station_coords.sql
-- ============================================================

SET client_encoding = 'UTF8';

BEGIN;

SET client_min_messages = warning;

DO $stations$
BEGIN
    IF to_regclass('public.stations') IS NULL THEN
        RAISE NOTICE 'ยังไม่มีตาราง stations — ข้ามไฟล์นี้ (รัน zone_analysis ก่อน)';
        RETURN;
    END IF;

    -- gmaps_pin  = หมุดจริงจาก Google Maps ผู้ใช้ยืนยันแล้ว
    -- subdistrict = ได้แค่จุดกลางแขวง เพราะที่อยู่ใน admin เป็นที่อยู่สำนักงานใหญ่
    -- road        = เดาจากชื่อคลัง ยังไม่มีที่อยู่จริง
    ALTER TABLE stations ADD COLUMN IF NOT EXISTS coord_precision text;
    ALTER TABLE stations ADD COLUMN IF NOT EXISTS coord_note      text;

    -- อัปเดตตาม branch_code ไม่ใช่ชื่อ — ชื่อคลังเปลี่ยนได้ รหัสสาขาไม่เปลี่ยน
    -- ไม่แตะ lat/lng เลย ค่าพิกัดมาจาก zone_analysis ตามเดิม
    UPDATE stations s
       SET coord_precision = v.precision,
           coord_note      = v.note
      FROM (VALUES
        ('WB0001', 'subdistrict',
         'ที่อยู่ใน admin เป็นที่อยู่สำนักงานใหญ่ (4/15 ม.6 แขวงลำผักชี เขตหนองจอก) — ได้แค่จุดกลางแขวง'),
        ('WB0002', 'gmaps_pin',
         'หมุด Google Maps "Wastebuy delivery" ยืนยันโดยผู้ใช้ 2026-08-30'),
        ('WB0003', 'gmaps_pin',
         'หมุด Google Maps "Wastebuy Delivery Bangbon Station" ยืนยันโดยผู้ใช้ 2026-08-30'),
        ('WB0004', 'gmaps_pin',
         'หมุด Google Maps "Wastebuy Delivery Watcharapol Station" ยืนยันโดยผู้ใช้ 2026-08-30 (ที่อยู่ใน admin ผิด เป็นที่อยู่สำนักงานใหญ่)'),
        ('WB0006', 'road',
         'ไม่มีที่อยู่จริงในระบบ (admin ลง 4/14 ม.6) เดาจากชื่อคลัง = ถ.ฉลองกรุง เขตลาดกระบัง')
      ) AS v(branch_code, precision, note)
     WHERE s.branch_code = v.branch_code;

    -- คลังที่ยังไม่มีใครระบุความแม่นยำ ถือว่ายังเดา ไม่ใช่ยืนยันแล้ว
    UPDATE stations SET coord_precision = 'unknown'
     WHERE coord_precision IS NULL;
END
$stations$;

-- ใช้บนหน้าเว็บ: บอกว่าเหลือคลังไหนที่ยังต้องยืนยัน
CREATE OR REPLACE VIEW v_station_coord_status AS
SELECT station_name,
       branch_code,
       lat,
       lng,
       COALESCE(coord_precision, 'unknown')            AS coord_precision,
       coord_note,
       COALESCE(coord_precision, '') = 'gmaps_pin'     AS verified
  FROM stations;

COMMIT;

DO $check$
DECLARE n_verified int; n_total int;
BEGIN
    IF to_regclass('public.v_station_coord_status') IS NULL THEN
        RAISE NOTICE 'ข้าม — ยังไม่มีตาราง stations';
        RETURN;
    END IF;
    SELECT count(*) FILTER (WHERE s.verified), count(*)
      INTO n_verified, n_total FROM v_station_coord_status s;
    RAISE NOTICE 'OK: พิกัดยืนยันแล้ว % จาก % คลัง', n_verified, n_total;
END
$check$;
