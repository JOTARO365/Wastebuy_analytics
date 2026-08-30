-- add_weight_query_columns.sql — เก็บ 4 คอลัมน์ของรายงานตามรถที่เคยถูกทิ้งตอน import
--
-- รายงาน "ยอดชื้อ ตามรถ Waste Buy แบบแจกแจง" มี 24 คอลัมน์ (นับ No. ด้วย)
-- แต่ weight_query เก็บแค่ 19 ที่ทิ้งไป 4 ตัว:
--
--   กลุ่มสมาชิก        -> customer_group  หน้า Customer Details / Zone Members กรอง
--                                         ทั่วไป / LINE / สมาชิก ต้อง join customers ทุกครั้ง
--   จุดรับซื้อ(Station) -> station         ตัวเดียวที่บอกว่ารถคันไหนวิ่งเข้าคลังไหน
--                                         26/59 คันวิ่งมากกว่า 1 station -> เก็บระดับ transaction
--   ก๊าชเรือนกระจก      -> ghg             kgCO2e ของบรรทัดนั้น
--   ปลูกต้นไม้(ต้น)     -> trees           จำนวนต้นไม้เทียบเท่า
--
-- ไฟล์นี้เพิ่มคอลัมน์เปล่าอย่างเดียว ค่าจะเข้ามาตอน re-import
-- (tools/sql/reimport_weight_query_YYYYMM.sql ของ repo automation)
--
-- รันซ้ำได้ · ไม่มี DEFAULT จึงไม่ rewrite ตาราง 1.3M แถว
--
-- Run: psql -v ON_ERROR_STOP=1 -f database/add_weight_query_columns.sql

SET client_encoding = 'UTF8';

BEGIN;

ALTER TABLE weight_query ADD COLUMN IF NOT EXISTS customer_group text;
ALTER TABLE weight_query ADD COLUMN IF NOT EXISTS station        text;
ALTER TABLE weight_query ADD COLUMN IF NOT EXISTS ghg            numeric;
ALTER TABLE weight_query ADD COLUMN IF NOT EXISTS trees          numeric;

COMMENT ON COLUMN weight_query.customer_group IS 'กลุ่มสมาชิก (CSV: กลุ่มสมาชิก)';
COMMENT ON COLUMN weight_query.station         IS 'คลัง/จุดรับซื้อของบรรทัดนี้ (CSV: จุดรับซื้อ(Station))';
COMMENT ON COLUMN weight_query.ghg             IS 'ก๊าซเรือนกระจก kgCO2e (CSV: ก๊าชเรือนกระจก)';
COMMENT ON COLUMN weight_query.trees           IS 'ปลูกต้นไม้เทียบเท่า ต้น (CSV: ปลูกต้นไม้(ต้น))';

DO $$
DECLARE missing text[];
BEGIN
    SELECT array_agg(c.col)
      INTO missing
      FROM (VALUES ('customer_group'), ('station'), ('ghg'), ('trees')) AS c(col)
     WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns
                        WHERE table_schema = 'public'
                          AND table_name   = 'weight_query'
                          AND column_name  = c.col);
    IF missing IS NOT NULL THEN
        RAISE EXCEPTION 'เพิ่มคอลัมน์ไม่ครบ ขาด: %', array_to_string(missing, ', ');
    END IF;
    RAISE NOTICE 'OK: weight_query มี customer_group / station / ghg / trees ครบแล้ว';
END $$;

COMMIT;
