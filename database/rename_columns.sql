-- rename_columns.sql — ตั้งชื่อคอลัมน์ weight_query / weight_query_station ให้ตรงกับค่าที่เก็บจริง
--
-- ที่มา: ตอน import ครั้งแรก ชื่อคอลัมน์เลื่อนจากค่าจริงไป 1 ช่อง ค่าถูกทุกแถวแต่ชื่อโกหก
-- พิสูจน์ด้วยแถวจริง POWB690701-0001 ของ weight_query:
--     price_per_kg(10.1) × price_per_unit(0.4) = total_price(4.04)
-- แปลว่า price_per_kg เก็บ "จำนวนน้ำหนักสุทธิ" ไม่ใช่ราคาต่อกิโล
--
-- ไฟล์นี้ไม่แตะข้อมูลเลย — ALTER TABLE ... RENAME COLUMN อย่างเดียว
-- รันซ้ำได้: ตารางที่เปลี่ยนชื่อครบแล้วจะถูกข้ามทั้งตาราง ไม่ error
--
-- ⚠️  รันไฟล์นี้แล้ว query เดิมใน server.js / *.sql ที่ใช้ชื่อเก่าจะพังทันที
--     ต้อง deploy พร้อมกับการแก้ query ฝั่ง dashboard (PLAN.md M0-1 + M0-3)
--
-- Run: psql -v ON_ERROR_STOP=1 -f database/rename_columns.sql

SET client_encoding = 'UTF8';

BEGIN;

DO $$
DECLARE
    t           record;
    m           record;
    cols        text[];
    has_old     boolean;
    has_new     boolean;
    n_renamed   int := 0;
BEGIN
    -- ตัดสินทีละ "ตาราง" ไม่ใช่ทีละคอลัมน์: หลายคู่เป็นลูกโซ่ (tare_weight → gross_weight)
    -- พอ rename ครบแล้ว ชื่อเก่าอย่าง gross_weight จะกลับมามีอยู่ในความหมายใหม่
    -- เช็คทีละคอลัมน์จึงแยกไม่ออกว่า "ยังไม่ทำ" หรือ "ทำไปแล้ว"
    FOR t IN
        SELECT * FROM (VALUES
            ('weight_query',
             ARRAY['customer_name','location','gross_weight',
                   'tare_weight','net_weight','price_per_kg'],
             ARRAY['driver_name','member_name','quantity_per_unit',
                   'gross_weight','deduct_weight','net_weight']),
            ('weight_query_station',
             ARRAY['item_code','item_name','item_category','driver_code','employee_name',
                   'customer_name','quantity_weight','quntity_net','quantity_kg',
                   'quantity_price','pay_by','time_recorder','status'],
             ARRAY['station','item_code','item_name','category','vehicle_number',
                   'driver_name','gross_weight','deduct_weight','net_weight',
                   'total_price','payment_method','purchase_time','payment_status'])
        ) AS x(tbl, before_cols, after_cols)
    LOOP
        SELECT array_agg(column_name) INTO cols
          FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = t.tbl;

        IF cols IS NULL THEN
            RAISE EXCEPTION 'ไม่พบตาราง public.%', t.tbl;
        END IF;

        IF cols @> t.after_cols THEN
            RAISE NOTICE 'ข้าม % — ชื่อใหม่ครบแล้ว', t.tbl;
            CONTINUE;
        END IF;

        IF NOT (cols @> t.before_cols) THEN
            -- ไม่ใช่ทั้งสถานะก่อนและหลัง = เคยรันค้างกลางคัน หรือ schema ไม่ตรงกับที่คาด
            RAISE EXCEPTION '% ไม่อยู่ในสถานะก่อนหรือหลัง rename — ตรวจ schema ก่อน (มี: %)',
                            t.tbl, array_to_string(cols, ', ');
        END IF;

        -- ลำดับสำคัญ: gross_weight เดิมต้องกลายเป็น quantity_per_unit ก่อน
        -- tare_weight ถึงจะมาเป็น gross_weight ได้ จึงต้อง ORDER BY step
        -- ห้ามพึ่งลำดับของ VALUES เอง
        FOR m IN
            SELECT step, old_name, new_name FROM (VALUES
                -- weight_query: CSV "รายงานยอดซื้อ ตามรถ Waste Buy แบบแจกแจง"
                ( 1, 'weight_query',         'customer_name',   'driver_name'),       -- พนักงานขับ
                ( 2, 'weight_query',         'location',        'member_name'),       -- ผู้จำหน่าย/สมาชิก
                ( 3, 'weight_query',         'gross_weight',    'quantity_per_unit'), -- จำนวน/หน่วย
                ( 4, 'weight_query',         'tare_weight',     'gross_weight'),      -- จำนวนน้ำหนัก
                ( 5, 'weight_query',         'net_weight',      'deduct_weight'),     -- จำนวนน้ำหนักหัก
                ( 6, 'weight_query',         'price_per_kg',    'net_weight'),        -- จำนวนน้ำหนักสุทธิ

                -- weight_query_station: CSV "รายงานสรุปการรับชื้อสินค้า ตาม จุดรับชื้อ(Station)"
                (11, 'weight_query_station', 'item_code',       'station'),           -- จุดรับชื้อ
                (12, 'weight_query_station', 'item_name',       'item_code'),         -- รหัสสินค้า
                (13, 'weight_query_station', 'item_category',   'item_name'),         -- ชื่อสินค้า
                (14, 'weight_query_station', 'driver_code',     'category'),          -- หมวดสินค้า
                (15, 'weight_query_station', 'employee_name',   'vehicle_number'),    -- รถ Waste Buy
                (16, 'weight_query_station', 'customer_name',   'driver_name'),       -- พนักงานขับ
                (17, 'weight_query_station', 'quantity_weight', 'gross_weight'),      -- จำนวนน้ำหนัก
                (18, 'weight_query_station', 'quntity_net',     'deduct_weight'),     -- จำนวนน้ำหนักหัก
                (19, 'weight_query_station', 'quantity_kg',     'net_weight'),        -- จำนวนน้ำหนักสุทธิ
                (20, 'weight_query_station', 'quantity_price',  'total_price'),       -- ราคาสุทธิ
                (21, 'weight_query_station', 'pay_by',          'payment_method'),    -- ชำระโดย
                (22, 'weight_query_station', 'time_recorder',   'purchase_time'),     -- เวลา
                (23, 'weight_query_station', 'status',          'payment_status')     -- สถานะ
            ) AS p(step, tbl, old_name, new_name)
            WHERE p.tbl = t.tbl
            ORDER BY step
        LOOP
            SELECT EXISTS (SELECT 1 FROM information_schema.columns
                            WHERE table_schema = 'public'
                              AND table_name   = t.tbl
                              AND column_name  = m.old_name),
                   EXISTS (SELECT 1 FROM information_schema.columns
                            WHERE table_schema = 'public'
                              AND table_name   = t.tbl
                              AND column_name  = m.new_name)
              INTO has_old, has_new;

            IF NOT has_old OR has_new THEN
                RAISE EXCEPTION 'ลำดับ rename ผิด: %.% -> % (มีชื่อเดิม=% มีชื่อใหม่=%)',
                                t.tbl, m.old_name, m.new_name, has_old, has_new;
            END IF;

            EXECUTE format('ALTER TABLE public.%I RENAME COLUMN %I TO %I',
                           t.tbl, m.old_name, m.new_name);
            n_renamed := n_renamed + 1;
            RAISE NOTICE 'renamed  %.% -> %', t.tbl, m.old_name, m.new_name;
        END LOOP;
    END LOOP;

    RAISE NOTICE 'rename_columns: เปลี่ยนชื่อ % คอลัมน์', n_renamed;
END $$;

-- ตรวจว่าชื่อใหม่ครบทุกตัวก่อน COMMIT — ขาดตัวไหน transaction ตกทั้งไฟล์
DO $$
DECLARE missing text[];
BEGIN
    SELECT array_agg(want.tbl || '.' || want.col)
      INTO missing
      FROM (VALUES
            ('weight_query',         'driver_name'),
            ('weight_query',         'member_name'),
            ('weight_query',         'quantity_per_unit'),
            ('weight_query',         'gross_weight'),
            ('weight_query',         'deduct_weight'),
            ('weight_query',         'net_weight'),
            ('weight_query_station', 'station'),
            ('weight_query_station', 'item_code'),
            ('weight_query_station', 'item_name'),
            ('weight_query_station', 'category'),
            ('weight_query_station', 'vehicle_number'),
            ('weight_query_station', 'driver_name'),
            ('weight_query_station', 'gross_weight'),
            ('weight_query_station', 'deduct_weight'),
            ('weight_query_station', 'net_weight'),
            ('weight_query_station', 'total_price'),
            ('weight_query_station', 'payment_method'),
            ('weight_query_station', 'purchase_time'),
            ('weight_query_station', 'payment_status')
           ) AS want(tbl, col)
     WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns c
                        WHERE c.table_schema = 'public'
                          AND c.table_name   = want.tbl
                          AND c.column_name  = want.col);

    IF missing IS NOT NULL THEN
        RAISE EXCEPTION 'rename ไม่ครบ ขาด: %', array_to_string(missing, ', ');
    END IF;
    RAISE NOTICE 'OK: ชื่อคอลัมน์ใหม่ครบทั้ง 2 ตาราง';
END $$;

COMMIT;
