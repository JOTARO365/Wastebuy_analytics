import express, { query } from "express";
import bodyParser from "body-parser";
import pg from "pg";
import fs from "fs";
import axios from "axios";
import xlsx from "xlsx";
import { promises } from "dns";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "module";
import { askGemini, geminiReady, geminiStatus, parseJsonReply } from "./function/gemini.js";
import { cacheState, refreshCache, startCacheWatcher } from "./function/cache.js";
const require = createRequire(import.meta.url);
const thailandDB = require('./node_modules/thai-address-database/database/raw_database/raw_database.json');
// import { SocketIo } from "socket.io";

// ต้องอ่านจาก env ได้ เพราะเครื่อง deploy ไม่ได้ใช้ค่าเดียวกับเครื่อง dev
// (ตั้งใน ecosystem.config.cjs ของ pm2 หรือ export ไว้ก่อนสั่ง pm2 start)
const db = new pg.Client({
	user: process.env.DB_USER || "postgres",
	host: process.env.DB_HOST || "localhost",
	database: process.env.DB_NAME || "wastebuy-analytics",
	password: process.env.DB_PASSWORD || "admin",
	port: parseInt(process.env.DB_PORT, 10) || 5432,
});

db.connect(err => {
	if (err) {
		// เดิม process.exit(1) เงียบ ๆ ทำให้ pm2 restart วนไม่จบและหน้าเว็บขึ้น 502
		// โดยไม่มีอะไรบอกว่าเป็นเรื่อง DB — พิมพ์ค่าที่ใช้ต่อ (ไม่รวมรหัสผ่าน) ก่อนตาย
		console.error(`Connection Failed: ${db.user}@${db.host}:${db.port}/${db.database}`);
		console.error(err.message);
		process.exit(1);
	}
	console.log(`Connection Success !! ${db.host}:${db.port}/${db.database}`);
});
const app = express();
const port = parseInt(process.env.API_PORT, 10) || 4000;

// server.js เรียกกลับไปที่ app.js — วงกลม แต่ต้องตั้ง host/port ได้เหมือนกัน
const WEB_URL = process.env.WEB_URL || `http://127.0.0.1:${process.env.PORT || 3000}/`;

// อ่านไฟล์ตาม path ของ repo ไม่ใช่ cwd — pm2 ไม่ได้ตั้ง cwd ให้เสมอ
const ROOT = path.dirname(fileURLToPath(import.meta.url));

// endpoint ของงานประจำรับ JSON — ไม่มีตัวนี้ req.body จะเป็น undefined
app.use(bodyParser.json({ limit: '1mb' }));

app.get('/customers', async (req, res) => {
	const sql = `
SELECT
    c.id,
    c.username,
    c.fullname,
    c.phone,
    cg.customer_group,
    g.gender,
    c.address,
    CASE
        WHEN t.name_th IS NOT NULL THEN t.name_th
        ELSE
            CASE
                WHEN c.address LIKE '%ตำบล%' THEN SUBSTRING(c.address FROM '%ตำบล%#"[ก-๙\s]+#"%' FOR '#')
                WHEN c.address LIKE '%แขวง%' THEN SUBSTRING(c.address FROM '%แขวง%#"[ก-๙\s]+#"%' FOR '#')
                ELSE NULL
            END
    END AS tambons,
    CASE
        WHEN am.name_th IS NOT NULL THEN am.name_th
        ELSE
            CASE
                WHEN c.address LIKE '%เขต%' THEN SUBSTRING(c.address FROM '%เขต%#"[ก-๙\s]+#"%' FOR '#')
                WHEN c.address LIKE '%อำเภอ%' THEN SUBSTRING(c.address FROM '%อำเภอ%#"[ก-๙\s]+#"%' FOR '#')
                ELSE NULL
            END
    END AS amphures,
    CASE
        WHEN p.name_th IS NOT NULL THEN p.name_th
        ELSE lp.province_name
    END AS provinces,
    s.status,
    c.regisdate
FROM
    customers c
LEFT JOIN customer_groups cg ON c.id_customer = cg.id
LEFT JOIN genders g ON c.id_gender = g.id
LEFT JOIN thai_provinces p ON c.id_provinces = p.id
LEFT JOIN thai_amphures am ON c.id_amphures = am.id
LEFT JOIN thai_tambons t ON c.id_tambons = t.id
LEFT JOIN status s ON c.id_status = s.id
-- ที่อยู่หนึ่งอันอาจตรง id_search ได้หลายแถว ทำให้ลูกค้าคนเดียวออกมาซ้ำ
-- (78,647 คน กลายเป็น 79,933 แถว) เอาแค่แถวแรกพอ
LEFT JOIN LATERAL (
    SELECT lp2.province_name
      FROM lookup_provinces lp2
     WHERE c.address LIKE '%' || lp2.id_search || '%'
     ORDER BY length(lp2.id_search) DESC
     LIMIT 1
) lp ON TRUE
ORDER BY c.id ASC;

    `;
	try {
		const result = await db.query(sql);
		res.json(result.rows);
	} catch (err) {
		console.error('Connection Failed', err);
		res.status(500).send('Conection Failed')
	}
});

app.get('/customers/:id', async (req, res) => {
	const customer_id = parseInt(req.params.id);
	const sql = `
    SELECT
        c.id,
        c.username,
        c.fullname AS full_name,
        c.phone,
        cg.customer_group,
        g.gender,
        c.address,
        CASE
            WHEN t.name_th IS NOT NULL THEN t.name_th
            ELSE
                CASE
                    WHEN c.address LIKE '%ตำบล%' THEN 'ตำบล'
                    WHEN c.address LIKE '%แขวง%' THEN 'แขวง'
                    ELSE NULL
                END
        END AS tambons,
        CASE
            WHEN am.name_th IS NOT NULL THEN am.name_th
            ELSE
                CASE
                    WHEN c.address LIKE '%เขต%' THEN 'เขต'
                    WHEN c.address LIKE '%อำเภอ%' THEN 'อำเภอ'
                    ELSE NULL
                END
        END AS amphures,
        CASE
            WHEN p.name_th IS NOT NULL THEN p.name_th
            ELSE lp.province_name
        END AS provinces,
        s.status,
        c.regisdate
    FROM
        customers c
    LEFT JOIN customer_groups cg ON c.id_customer = cg.id
    LEFT JOIN genders g ON c.id_gender = g.id
    LEFT JOIN thai_provinces p ON c.id_provinces = p.id
    LEFT JOIN thai_amphures am ON c.id_amphures = am.id
    LEFT JOIN thai_tambons t ON c.id_tambons = t.id
    LEFT JOIN status s ON c.id_status = s.id
    -- ที่อยู่เดียวตรง id_search ได้หลายแถว จะทำให้สมาชิกคนเดียวออกมาซ้ำ
    -- เอาชื่อจังหวัดที่ยาวที่สุดที่ตรง (เจาะจงที่สุด) แถวเดียวพอ — เหมือน /customers
    LEFT JOIN LATERAL (
        SELECT lp2.province_name
          FROM lookup_provinces lp2
         WHERE c.address LIKE '%' || lp2.id_search || '%'
         ORDER BY length(lp2.id_search) DESC
         LIMIT 1
    ) lp ON TRUE
    WHERE c.id = $1;
    `;
	try {
		const result = await db.query(sql, [customer_id]);
		if (result.rows.length === 0) {
			return res.status(404).send('No Customer found with ID');
		}
		res.json(result.rows[0]);
	} catch (err) {
		console.error('Query Failed', err);
		res.status(500).send('Query Failed');
	};
});



app.get('/employees', async (req, res) => {
	const sql = `
     SELECT
				e.id,
				e.employee_code,
                coalesce( e.fname, ' ') || ' ' || coalesce( e.lname, ' ' ) as full_name,
                e.phone,
                dg.department_group,
				e.birth_date,
                g.gender,
                em.email,
                e.address,
				t.name_th as tambons,
				am.name_th as amphures,
				p.name_th as provinces,
				cn.name_company,
                s.status
                FROM
                    employees e
                left join department_groups dg on e.id_department_group = dg.id
                left join genders g on e.id_gender = g.id
				left join emails em on e.id_email = em.id
				left join companies cn on e.id_company = cn.id
				left join thai_provinces p on e.id_provinces = p.id
				left join thai_amphures am on e.id_amphures = am.id
				left join thai_tambons t on e.id_tambons = t.id
				left join status s on e.id_status = s.id
				order by id asc;
    `;
	try {
		const result = await db.query(sql);
		res.json(result.rows);
	} catch (err) {
		console.error('Connection Failed', err);
		res.status(500).send('Connection Failed');
	};
});

app.get('/employees/:id', async (req, res) => {
	const employee_id = parseInt(req.params.id)
	const sql = `
    SELECT
				e.id,
				e.employee_code,
                coalesce( e.fname, ' ') || ' ' || coalesce( e.lname, ' ' ) as full_name,
                e.phone,
                dg.department_group,
				e.birth_date,
                g.gender,
                em.email,
                e.address,
				t.name_th as tambons,
				am.name_th as amphures,
				p.name_th as provinces,
				cn.name_company,
                s.status
                FROM
                    employees e
                left join department_groups dg on e.id_department_group = dg.id
                left join genders g on e.id_gender = g.id
				left join emails em on e.id_email = em.id
				left join companies cn on e.id_company = cn.id
				left join thai_provinces p on e.id_provinces = p.id
				left join thai_amphures am on e.id_amphures = am.id
				left join thai_tambons t on e.id_tambons = t.id
				left join status s on e.id_status = s.id
                where e.id = $1;
    `;
	try {
		const result = await db.query(sql, [employee_id]);
		if (result.rows.length === 0) {
			return res.status(404).send('No Customer found with ID');
		}
		res.json(result.rows[0]);
	} catch (err) {
		console.error('Query Failed', err);
		res.status(500).send('Query Failed');
	};
});

// รายชื่อกลุ่มสมาชิกพร้อมจำนวนสมาชิก — หน้าเว็บเอาไปทำตัวกรอง
// ต้องมาจาก DB ไม่ใช่ hardcode ในหน้า ไม่งั้นกลุ่มที่เพิ่มหรือถูกเปลี่ยนชื่อ
// จะกรองไม่ได้ และตัวเลือกที่ชื่อเก่าจะคืน 0 แถวโดยไม่มีอะไรบอก
// ช่วงวันที่ที่มีข้อมูลจริง — หน้าเว็บใช้ตั้งค่า default ของช่องวันที่
// ถ้า default เป็น "วันนี้" ทุกหน้าจะเปิดมาว่างเปล่าเมื่อข้อมูลตามหลังปฏิทิน
app.get('/data-range', async (req, res) => {
	try {
		const result = await db.query(`
SELECT min(purchase_date)::text AS min_date,
       max(purchase_date)::text AS max_date
  FROM weight_query`);
		res.json(result.rows[0] || { min_date: null, max_date: null });
	} catch (err) {
		console.error('DATA RANGE:', err.message);
		res.status(500).json({ error: 'ดึงช่วงวันที่ไม่สำเร็จ' });
	}
});

app.get('/customer-groups', async (req, res) => {
	try {
		const result = await db.query(`
SELECT cg.customer_group,
       count(c.id) AS members
  FROM customer_groups cg
  LEFT JOIN customers c ON c.id_customer = cg.id
 WHERE cg.customer_group IS NOT NULL AND btrim(cg.customer_group) <> ''
 GROUP BY cg.customer_group
 -- เรียงตามจำนวนสมาชิก กลุ่มที่ยังไม่มีใครเลย (ชื่อเป็นเบอร์โทรบ้าง) จะได้
 -- ไปอยู่ท้ายรายการ ไม่ใช่ลอยขึ้นบนสุดเพราะขึ้นต้นด้วยตัวเลข
 ORDER BY count(c.id) DESC, cg.customer_group`);
		res.json(result.rows);
	} catch (err) {
		console.error('CUSTOMER GROUPS:', err.message);
		res.status(500).json({ error: 'ดึงกลุ่มสมาชิกไม่สำเร็จ' });
	}
});

app.get('/materials', async (req, res) => {
	const sql = `
SELECT
    m.id,
    m.name_mat,
    u.unit_name,
    CASE
        WHEN m.code_mat LIKE 'PP%' THEN pp.material_group
        WHEN m.code_mat LIKE 'PRP%' THEN prp.material_group
		when m.code_mat like 'PT%' then pt.material_group
		when m.code_mat like 'GL%' then gl.material_group
		when m.code_mat like 'GG%' then gg.material_group
		when m.code_mat like 'ST%' then st.material_group
		when m.code_mat like 'OO%' then oo.material_group
		when m.code_mat like 'BB%' then bb.material_group
        ELSE mg.name_group
    END AS name_group,
    m.code_mat,
    m.price_delivery,
    m.price_station,
    m.price_factory,
    m.ghg,
    m.standard_weight,
    s.status
FROM
    materials m
    LEFT JOIN group_materials mg ON m.id_mat_group = mg.id
    LEFT JOIN units u ON m.id_unit = u.id
    LEFT JOIN status s ON m.id_status = s.id
    LEFT JOIN category_materials pp ON m.code_mat LIKE 'PP%' AND pp.category_code LIKE 'PP%'
    LEFT JOIN category_materials prp ON m.code_mat LIKE 'PRP%' AND prp.category_code LIKE 'PRP%'
    LEFT JOIN category_materials pt ON m.code_mat LIKE 'PT%' AND pt.category_code LIKE 'PT%'
    LEFT JOIN category_materials gl ON m.code_mat LIKE 'GL%' AND gl.category_code LIKE 'GL%'
    LEFT JOIN category_materials gg ON m.code_mat LIKE 'GG%' AND gg.category_code LIKE 'GG%'
    LEFT JOIN category_materials st ON m.code_mat LIKE 'ST%' AND st.category_code LIKE 'ST%'
    LEFT JOIN category_materials oo ON m.code_mat LIKE 'OO%' AND oo.category_code LIKE 'OO%'
    LEFT JOIN category_materials bb ON m.code_mat LIKE 'BB%' AND bb.category_code LIKE 'BB%'
    `;
	try {
		const result = await db.query(sql);
		res.json(result.rows);
	} catch (err) {
		console.error('Connection Failed :', err);
		res.status(500).send('Connection Failed');
	};
});

app.get('/weight_query', async (req, res) => {
	const sql = `
        SELECT
            min(wq.id) AS id,
            wq.purchase_date,
            wq.driver_name AS customer_name,
            wq.item_name,
            wq.category,
            SUM(wq.net_weight) AS total_price_per_kg,
            SUM(wq.total_price) AS total_price,
            wq.unit
        FROM
            weight_query wq
        GROUP BY
            wq.purchase_date,
            wq.driver_name,
            wq.item_name,
            wq.category,
            wq.unit
        ORDER BY
            wq.purchase_date,
            wq.driver_name,
        	id asc;

    `;
	try {
		const result = await db.query(sql);
		res.json(result.rows);
	} catch (err) {
		console.error('Connection Failed', err);
		res.status(500).send('Connection Failed');
	}
});

app.get('/weight_query/search', async (req, res) => {
	const { startDay, startMonth, startYear, endDay, endMonth, endYear } = req.query;

	// สร้างคำสั่ง SQL พื้นฐาน
	let sql = `
        SELECT
            min(wq.id) AS id,
            wq.purchase_date,
            wq.purchase_number,
            wq.driver_name AS customer_name,
            wq.member_name AS location,
            wq.item_name,
            wq.category,
            SUM(wq.net_weight) AS total_price_per_kg,
            SUM(wq.total_price) AS total_price,
            wq.unit
        FROM
            weight_query wq
            WHERE 1=1
    `;

	// เตรียมค่าพารามิเตอร์สำหรับการค้นหา
	const params = [];
	let paramIndex = 1;

	// ตรวจสอบพารามิเตอร์เริ่มต้นและสิ้นสุด
	if (startDay && startMonth && startYear && endDay && endMonth && endYear) {
		// ตรวจสอบความถูกต้องของปี
		if (startYear.length === 4 && endYear.length === 4 && !isNaN(startYear) && !isNaN(endYear) && startYear > 1900 && endYear > 1900) {
			// สร้างช่วงวันที่
			const startDate = `${startYear}-${startMonth.padStart(2, '0')}-${startDay.padStart(2, '0')}`;
			const endDate = `${endYear}-${endMonth.padStart(2, '0')}-${endDay.padStart(2, '0')}`;
			sql += ` AND purchase_date::date BETWEEN $${paramIndex++} AND $${paramIndex++}`;
			params.push(startDate, endDate);
		} else {
			res.status(400).send('Invalid year');
			return;
		}
	} else {
		res.status(400).send('Missing date parameters');
		return;
	}

	sql += `
        GROUP BY
            wq.member_name,
            wq.purchase_date,
            wq.purchase_number,
            wq.driver_name,
            wq.item_name,
            wq.category,
            wq.unit
        ORDER BY
            wq.purchase_date,
            wq.driver_name,
        	id asc;
    `;

	try {
		const result = await db.query(sql, params);
		res.json(result.rows);
	} catch (err) {
		console.error('Connection Failed :', err);
		res.status(500).send('Connection Failed');
	}
});


app.get('/get_weight_by_deli/search', async (req, res) => {
	const { startDate, endDate } = req.query;

	if (!startDate || !endDate) {
		return res.status(400).send('Missing purchase_date query parameter');
	}
	const sql = `
    select
    	wq.purchase_date,
		wq.purchase_number,
    	wq.item_name,
    	wq.category,
    	sum(wq.net_weight) as kg_delivery,
    	sum(wq.quantity_per_unit) as unit_delivery,
        sum(wq.total_price) as total_delivery
    from
    	weight_query wq
    	where wq.purchase_date between $1 and $2
    	group by
    		wq.purchase_date,
    		wq.item_name,
			wq.purchase_number,
    		wq.category
        order by purchase_date asc;
    `;
	try {
		const result = await db.query(sql, [startDate, endDate]);
		res.json(result.rows);
	} catch (err) {
		console.error('Connection Failed :', err);
		res.status(500).send('Connection Failed');
	}
})

app.get('/get_weight_by_station/search', async (req, res) => {
	const { startDate, endDate } = req.query;

	if (!startDate || !endDate) {
		return res.status(400).send('Missing purchase_date query parameter');
	}
	const sql = `
    select
    	wq.purchase_date,
    	-- ก่อน rename_columns.sql คอลัมน์ชุดนี้เลื่อนไป 1 ช่อง โค้ดเดิมจึงส่ง
    	-- "รหัสสินค้า" ออกไปในชื่อ item_name แล้วเอาไปจับคู่กับชื่อสินค้าฝั่ง
    	-- delivery ซึ่งไม่มีวันตรง — ช่อง Station บนหน้าจึงเป็น 0 มาตลอด
    	wq.item_name  AS item_name,
    	wq.category   AS item_category,
    	wq.item_code  AS item_code,
    	btrim(wq.station) AS station,
    	sum(wq.net_weight) as kg_station,
    	sum(wq.quantity_per_unit) as unit_station,
        sum(wq.total_price) as total_station
    from
    	weight_query_station wq
    	where wq.purchase_date between $1 and $2
    	group by
    		wq.purchase_date,
    		wq.item_name,
    		wq.category,
    		wq.item_code,
    		btrim(wq.station)
    `;
	try {
		const result = await db.query(sql, [startDate, endDate]);
		res.json(result.rows);
	} catch (err) {
		console.error('Connection Failed', err);
		res.status(500).send('Connection Failed');
	}
})


app.get('/get_carbon_cal/search', async (req, res) => {
	const { startDate, endDate } = req.query;
	// checkbox ตัวเดียว Express ส่งมาเป็น string ไม่ใช่ array — ต้องแปลงก่อน
	// ไม่งั้นการเทียบกลายเป็นหา substring ('7-11' อยู่ใน 'B2B-CP ALL (7-11)')
	const groups = [].concat(req.query.customer_group || []).filter(Boolean);
	const sql = `
SELECT
    wq.purchase_date,
	wq.purchase_number,
    wq.member_name AS location,
    wq.item_name,
    wq.category,
	c.id_customer,
	cg.customer_group,
    c.id_tambons,
    tm.name_th as tambons,
    c.id_amphures,
    am.name_th AS amphures,
    c.id_provinces,
    p.name_th AS provinces,
    SUM(wq.net_weight) AS kg_delivery,
    SUM(wq.quantity_per_unit) AS unit_delivery,
    SUM(wq.total_price) AS total_delivery
FROM
    weight_query wq
-- ชื่อไม่ใช่ key: มีสมาชิก 493 คนชื่อ "LINE" เหมือนกัน การ join ตรง ๆ กับ customers
-- จะโคลนแถวการซื้อ 493 เท่า แล้ว SUM ข้างล่างก็บวกซ้ำทั้งหมด (54.40 kg กลายเป็น 26,819.20 kg)
-- จึงยุบให้เหลือหนึ่งสมาชิกต่อหนึ่งชื่อก่อน เลือกตัว id น้อยสุดเพื่อให้ผลคงที่ทุกครั้ง
-- v_customer_directory ยุบชื่อซ้ำมาให้แล้ว และคืน view เปล่าถ้ายังไม่ได้กู้
-- ตาราง customers — หน้าเว็บจะได้ไม่ 500 ทั้งหน้าเพราะตารางเดียว
LEFT JOIN v_customer_directory c ON wq.member_name = c.fullname
LEFT JOIN thai_tambons tm on c.id_tambons = tm.id
LEFT JOIN thai_amphures am ON c.id_amphures = am.id
left join customer_groups cg on c.id_customer = cg.id
left join thai_provinces p on c.id_provinces = p.id
WHERE
    wq.purchase_date BETWEEN $1 AND $2
    -- เดิมรับ customer_group มาแล้วทิ้ง ผู้ใช้ติ๊กกลุ่มแล้วได้ข้อมูลทุกกลุ่มเหมือนเดิม
    AND ($3::text[] IS NULL OR cg.customer_group = ANY($3::text[]))
GROUP BY
    wq.purchase_date,
	wq.purchase_number,
    wq.member_name,
    wq.item_name,
    wq.category,
    c.id_tambons,
    c.id_amphures,
	c.id_customer,
    c.id_provinces,
	cg.customer_group,
    tm.name_th,
    am.name_th,
    p.name_th
ORDER BY
    wq.purchase_date ASC;

    `;
	try {
		const result = await db.query(sql, [startDate, endDate, groups.length ? groups : null]);

		res.json(result.rows);

	} catch (err) {
		console.error('Connnection Failed', err);
		res.status(500).send('Connnection Failed');
	}
})

app.get('/api-carbon-cal', async (req, res) => {
	const { startDate, endDate, limit, page, customer_group, amphures } = req.query;

	try {
		const result = await axios.get(WEB_URL + 'api/carbon-credit', {
			params: {
				startDate: startDate,
				endDate: endDate
			}
		});

		let calc = result.data.totals;

		// [].concat กันเคส checkbox ตัวเดียวที่ Express ส่งมาเป็น string
		// ถ้าไม่แปลง .includes จะกลายเป็นหา substring แล้วได้กลุ่มอื่นแถมมา
		const groups = [].concat(customer_group || []).filter(Boolean);
		const districts = [].concat(amphures || []).filter(Boolean);

		if (groups.length) {
			calc = calc.filter(item => groups.includes(item.customer_group));
		}

		if (districts.length) {
			calc = calc.filter(item => districts.includes(item.amphures));
		}

		const totalrecord = calc.length
		const totalpages = Math.ceil(totalrecord / limit);
		const startIndex = (page - 1) * limit;
		const endIndex = Math.min(startIndex + limit, totalrecord);
		const paginationData = calc.slice(startIndex, endIndex)


		res.json({
			data: paginationData,
			totalrecord: totalrecord,
			totalpages: totalpages,
			currentPage: parseInt(page, 10),
			limit: parseInt(limit, 10)
		});
	} catch (err) {
		console.error('Connection Failed', err);
		res.status(500).json({ message: 'Connection Failed', error: err.message });
	}
});

app.get('/api-carbon-cal-material', async (req, res) => {
	const { startDate, endDate, limit, page, customer_group } = req.query;
	try {
		const result = await axios.get(WEB_URL + 'api/carbon-credit-material', {
			params: {
				startDate: startDate,
				endDate: endDate
			}
		});

		let calc = result.data.totals;
		// [].concat กันเคส checkbox ตัวเดียวที่ Express ส่งมาเป็น string
		const groups = [].concat(customer_group || []).filter(Boolean);
		if (groups.length) {
			calc = calc.filter(item => groups.includes(item.customer_group));
		}
		const materialdata = result.data.mattotals
		const totalrecord = calc.length
		const totalpages = Math.ceil(totalrecord / limit);
		const startIndex = (page - 1) * limit;
		const endIndex = Math.min(startIndex + limit, totalrecord);
		const paginationData = calc.slice(startIndex, endIndex)

		res.json({
			matdata: materialdata,
			purchase_date: calc.purchase_date,
			data: paginationData,
			totalrecord: totalrecord,
			totalpages: totalpages,
			currentPage: parseInt(page, 10),
			limit: parseInt(limit, 10)
		});

	} catch (err) {
		console.error('Connection Failed', err);
		res.status(500).json({ message: 'Connection Failed', error: err.message });
	}
})


// path เดิมชี้ไปโฟลเดอร์ Downloads ของเครื่อง dev เครื่องเดียว เครื่อง deploy
// จึงพังเสมอ ตอนนี้ตั้งด้วย UPDATE_DATA_DIR และตอบให้ชัดว่ายังไม่ได้ตั้ง
app.get('/update-data', async (req, res) => {
	if (!process.env.UPDATE_DATA_DIR) {
		return res.status(503).json({
			error: 'ยังไม่ได้ตั้ง UPDATE_DATA_DIR',
			hint: 'ตั้ง env ให้ชี้ไปโฟลเดอร์ที่มี จัดการกลุ่มสมาชิก.csv และ จัดการสมาชิก.csv',
		});
	}
	try {
	const partFile = process.env.UPDATE_DATA_DIR.replace(/[\\/]*$/, '/');
	const partprovice = 'thai-province-data-master/xlsx/'
	const FileGroupCustomer = `${partFile}จัดการกลุ่มสมาชิก.csv`;
	const customerData = `${partFile}จัดการสมาชิก.csv`;
	const proviceFile = `${partFile}${partprovice}thai_provinces.xlsx`;
	const tambonsFile = `${partFile}${partprovice}thai_provinces.xlsx`;
	const amphuresFile = `${partFile}${partprovice}thai_provinces.xlsx`;

	const workbook_GC = xlsx.readFile(FileGroupCustomer)
	const sheetGC = workbook_GC.Sheets[workbook_GC.SheetNames[0]];
	const dataGC = xlsx.utils.sheet_to_json(sheetGC);

	const workbook_CD = xlsx.readFile(customerData);
	const sheetCD = workbook_CD.Sheets[workbook_CD.SheetNames[0]];
	const dataCD = xlsx.utils.sheet_to_json(sheetCD);

	const sqlProvice = 'SELECT * FROM thai_provinces'
	const sqlTambon = 'SELECT * FROM thai_tambons'
	const sqlAmphure = 'SELECT * FROM thai_amphures'

	let resultCustomerUpdate = new Map();

	const [provice, amphures, tambons] = await Promise.all([
		db.query(sqlProvice),
		db.query(sqlAmphure),
		db.query(sqlTambon)
	])

	const provinceMap = [...new Set(thailandDB.map(item => item.province))];
	const amphuresMap = [...new Set(thailandDB.map(item => item.amphoe))];;
	const districtMap = thailandDB.map(item => item.district);
	dataCD.forEach(item => {
		const key = item['กลุ่มสมาชิก'] || '';
		const cleanAddress = (item['ที่อยู่'] || '').trim();
		const foundProvince = provinceMap.find(p => cleanAddress.includes(p)) || ''
		const foundAmphures = amphuresMap.find(a => cleanAddress.includes(a)) || '';
		const districtCandidates = districtMap.filter(d => cleanAddress.includes(d)) || '';

		let currentDistrict = null;

		if (districtCandidates === 1)
			currentDistrict = districtCandidates[0];
		else if (districtCandidates.length > 1)	{
			currentDistrict = districtCandidates.find(d => d !== foundAmphures);
			if (!currentDistrict)
				currentDistrict = districtCandidates[0];
		}
		resultCustomerUpdate.set(key, {
			id: item['ลำดับ'],
			username: item['Username'],
			fullname: item['ชื่อ-นามสกุล'],
			phone: '0' + item['เบอร์โทรศัพท์'],
			id_gender: 3,
			id_customer: String(item['กลุ่มสมาชิก'] || '').trim(),
			address: item['ที่อยู่'] || '',
			id_tambons: districtCandidates,
			id_amphures: foundAmphures,
			id_provinces: foundProvince,
			id_status: item['สถานะใช้งาน'] === 'TRUE' ? 1 : 2,
			regisdate: item['วัน/เดือน/ปี เวลา ที่สมัคร']
		})
	})
	dataGC.forEach(item => {
		const IDkey = item['ลำดับที่'];
		const lookupKey = String(item['ชื่อกลุ่มสมาชิก'] || '').trim();
		if (lookupKey && resultCustomerUpdate.has(lookupKey)) {
			let currentData = resultCustomerUpdate.get(lookupKey);
			currentData.id_customer = IDkey
			resultCustomerUpdate.set(item.id_customer, currentData)
		}
	})
	console.log(resultCustomerUpdate)
	res.json({
		success: 'send data success !!'
	})
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: "❌ เกิดข้อผิดพลาดในการประมวลผล" });
	}
})

// วิเคราะห์โซน: station อยู่ตรงไหน เขตไหนขึ้นกับ station ไหน และยอดจองต่อวงแหวน
// ตาราง/view มาจาก tools/scripts/generate_zone_analysis_sql.py ในรีโป automation
app.get('/api-zone-coverage', async (req, res) => {
	const { startDate, endDate } = req.query;

	// อ่านจาก mv_orders ไม่ใช่ booking_queue ตรง ๆ
	//
	// หน้า Reservation ของระบบต้นทางดึงใบจองย้อนหลังได้จำกัด งานเก่าที่จบแล้ว
	// จึงไม่มีใบจองเหลืออยู่ — นับจาก booking_queue ทำให้เขตที่งานเก่าเยอะดูเงียบ
	// (สำเร็จตามใบจอง 60,174 เทียบบิลจริง 136,820 = ต่ำไป 2.3 เท่า)
	// mv_orders = ใบจองที่ยังไม่จบ + บิลจริงของงานที่จบแล้ว (ดู analysis_v2.sql)
	const ringSql = `
SELECT n.ring,
       n.ring_order,
       n.nearest_station,
       n.district,
       n.km,
       n.source_pins,
       c.lat,
       c.lng,
       count(*)                                   AS bookings,
       count(*) FILTER (WHERE o.status = 'สำเร็จ')  AS done,
       count(*) FILTER (WHERE o.status = 'ยกเลิก') AS cancelled,
       -- ใบที่ยังไม่จบแยกเป็น 2 ขั้น: รอยืนยัน = ยังไม่มีใครรับงาน
       -- อยู่ระหว่างเข้ารับสินค้า/ยืนยัน = รับงานแล้วแต่ยังไม่ปิด
       count(*) FILTER (WHERE o.status = 'รอยืนยัน') AS pending,
       count(*) FILTER (WHERE o.status LIKE 'อยู่ระหว่าง%'
                           OR o.status = 'ยืนยัน')  AS in_progress
  FROM mv_orders o
  JOIN v_district_nearest n ON n.district = o.district
  JOIN district_centroids c ON c.district = o.district
 WHERE ($1::date IS NULL OR o.order_date >= $1::date)
   AND ($2::date IS NULL OR o.order_date <= $2::date)
 GROUP BY n.ring, n.ring_order, n.nearest_station, n.district, n.km,
          n.source_pins, c.lat, c.lng
 ORDER BY count(*) DESC`;

	const vehicleSql = `
SELECT station_name, count(DISTINCT vehicle) AS vehicles, sum(trip_rows) AS trip_rows
  FROM vehicle_station_map
 GROUP BY station_name
 ORDER BY sum(trip_rows) DESC`;

	try {
		const [stations, rings, vehicles, subdistricts, dropped] = await Promise.all([
			// ส่งความแม่นยำของพิกัดมาด้วย หน้าเว็บจะได้เตือนเฉพาะคลังที่ยังเดา
			// ไม่ใช่เตือนเหมารวมทุกคลังทั้งที่บางจุดยืนยันแล้ว
			db.query(`
SELECT s.station_name, s.branch_code, s.lat, s.lng,
       COALESCE(s.coord_precision, 'unknown') AS coord_precision,
       s.coord_note,
       COALESCE(s.coord_precision, '') = 'gmaps_pin' AS coord_verified
  FROM stations s ORDER BY s.id`),
			db.query(ringSql, [startDate || null, endDate || null]),
			db.query(vehicleSql),
			db.query(`
SELECT station_name, district, subdistrict, km, ring, ring_order, bookings, cancelled
  FROM v_station_subdistricts
 ORDER BY station_name, bookings DESC`),
			// ออร์เดอร์ที่ตกจากตารางเพราะเขตไม่มีจุดกลาง (ต่างจังหวัด/ไม่ระบุเขต)
			// ตัวเลขบนหน้าจะได้ไม่ขัดกับยอดจริงโดยไม่มีคำอธิบาย
			db.query(`
SELECT count(*) FILTER (WHERE o.district IS NULL OR btrim(o.district) = '') AS no_district,
       count(*) FILTER (WHERE o.district IS NOT NULL AND btrim(o.district) <> ''
                          AND c.district IS NULL)                           AS outside_area,
       count(*)                                                             AS total
  FROM mv_orders o
  LEFT JOIN district_centroids c ON c.district = o.district
 WHERE ($1::date IS NULL OR o.order_date >= $1::date)
   AND ($2::date IS NULL OR o.order_date <= $2::date)`,
				[startDate || null, endDate || null]),
		]);
		res.json({
			stations: stations.rows,
			districts: rings.rows,
			vehiclesByStation: vehicles.rows,
			subdistricts: subdistricts.rows,
			dropped: dropped.rows[0] || null,
		});
	} catch (err) {
		// ตาราง zone ยังไม่ถูกโหลดเป็นเคสปกติ ไม่ใช่ระบบพัง — บอกให้ชัดว่าต้องทำอะไร
		if (err.code === '42P01') {
			return res.status(503).json({
				error: 'ยังไม่ได้โหลดข้อมูลโซน',
				hint: 'รัน data/sql/zone_analysis_*.sql ก่อน',
			});
		}
		console.error('ZONE COVERAGE:', err.message);
		res.status(500).json({ error: 'ดึงข้อมูลโซนไม่สำเร็จ' });
	}
});

// สมาชิกรายเขต: ใครอยู่เขตไหน ใกล้ station ไหน ใช้บริการจริงแค่ไหน
// แยก LINE ออกจากลูกค้าทั่วไปได้ (ดู v_member_zone ว่าตัดสินจากอะไร)
const MEMBER_LIST_LIMIT = 500;

app.get('/api-zone-members', async (req, res) => {
	const { district, channel, group, station, ring } = req.query;
	const activeOnly = req.query.active === '1';

	// อ่านจาก cache (mv_) ไม่ใช่ view สด — ดู database/analysis_cache.sql
	// เดิมยิงมัน 3 ครั้งต่อ 1 request (สรุป + facet เขต + facet กลุ่ม) = ~22 วินาที
	// จนหน้าเว็บตัดการเชื่อมต่อทิ้ง ตอนนี้ดึงครั้งเดียวแล้วกรอง/ทำ facet ใน JS
	// (ทั้งชุดมีไม่ถึงพันแถว เบากว่าการวิ่ง SQL ซ้ำมาก)
	const summarySql = `
SELECT district, district_label, channel, segment, customer_group,
       nearest_station, km, ring, ring_order,
       members, active_members, booking_members,
       bookings, purchases, total_kg, total_baht, last_purchase
  FROM mv_zone_member_summary`;

	const segment = req.query.segment || '';

	const matches = row =>
		(!district || row.district === district) &&
		(!channel || row.channel === channel) &&
		(!segment || row.segment === segment) &&
		(!group || row.customer_group === group) &&
		(!station || row.nearest_station === station) &&
		(!ring || row.ring === ring);

	try {
		const all = (await db.query(summarySql)).rows;

		// ยุบให้เหลือแถวละ (เขต, station, วงแหวน, ช่องทาง) — กลุ่มสมาชิกถูกรวมเข้าด้วยกัน
		const grouped = new Map();
		all.filter(matches).forEach(row => {
			const key = [row.district, row.nearest_station, row.ring,
			             row.channel, row.segment].join('|');
			const acc = grouped.get(key) || {
				district: row.district,
				district_label: row.district_label,
				nearest_station: row.nearest_station,
				km: row.km,
				ring: row.ring,
				ring_order: row.ring_order,
				channel: row.channel,
				segment: row.segment,
				members: 0, active_members: 0, booking_members: 0,
				bookings: 0, purchases: 0, total_kg: 0, total_baht: 0,
				last_purchase: null,
			};
			acc.members += Number(row.members);
			acc.active_members += Number(row.active_members);
			acc.booking_members += Number(row.booking_members);
			acc.bookings += Number(row.bookings);
			acc.purchases += Number(row.purchases);
			acc.total_kg += Number(row.total_kg);
			acc.total_baht += Number(row.total_baht);
			if (row.last_purchase && (!acc.last_purchase || row.last_purchase > acc.last_purchase)) {
				acc.last_purchase = row.last_purchase;
			}
			grouped.set(key, acc);
		});

		const summary = [...grouped.values()]
			.sort((a, b) => b.active_members - a.active_members || b.members - a.members);

		// facet มาจากชุดเต็มเสมอ ไม่ใช่ชุดที่กรองแล้ว ไม่งั้นเลือกเขตหนึ่งแล้ว
		// ตัวเลือกอื่นจะหายไปหมดจนเปลี่ยนตัวกรองไม่ได้
		// ยอดรวมรายกลุ่ม คิดจากชุดที่ผ่านตัวกรองอื่น ๆ แล้ว แต่ไม่กรองด้วย segment เอง
		// ไม่งั้นเลือก 'LINE' แล้วการ์ดอีกสองใบจะกลายเป็น 0 ทั้งที่อยากเห็นไว้เทียบ
		const segmentTotals = {};
		all.filter(row =>
			(!district || row.district === district) &&
			(!channel || row.channel === channel) &&
			(!group || row.customer_group === group) &&
			(!station || row.nearest_station === station) &&
			(!ring || row.ring === ring)
		).forEach(row => {
			const acc = segmentTotals[row.segment] ||= {
				segment: row.segment, members: 0, active: 0,
				bookings: 0, purchases: 0, kg: 0, baht: 0,
			};
			acc.members += Number(row.members);
			acc.active += Number(row.active_members);
			acc.bookings += Number(row.bookings);
			acc.purchases += Number(row.purchases);
			acc.kg += Number(row.total_kg);
			acc.baht += Number(row.total_baht);
		});

		const districtMap = new Map();
		const groupMap = new Map();
		all.forEach(row => {
			if (row.district) {
				districtMap.set(row.district, {
					district: row.district,
					district_label: row.district_label,
					nearest_station: row.nearest_station,
					ring: row.ring,
					ring_order: row.ring_order,
				});
			}
			if (row.customer_group) {
				groupMap.set(row.customer_group,
					(groupMap.get(row.customer_group) || 0) + Number(row.members));
			}
		});

		// รายชื่อสมาชิกโผล่เฉพาะตอนกรองเขตแล้ว — 78k แถวไม่มีใครอ่านไหว
		let members = [];
		if (district) {
			const where = ['district = $1'];
			const params = [district];
			const add = (sql, value) => {
				if (!value) return;
				params.push(value);
				where.push(sql.replace('$?', `$${params.length}`));
			};
			add('channel = $?', channel);
			add('segment = $?', segment);
			add('customer_group = $?', group);
			add('nearest_station = $?', station);
			add('ring = $?', ring);
			if (activeOnly) where.push('purchases > 0');

			members = (await db.query(`
SELECT fullname, customer_group, channel, segment, district_label, district_source,
       nearest_station, km, ring, bookings, purchases, total_kg, total_baht,
       last_purchase
  FROM v_member_zone_full
 WHERE ${where.join(' AND ')}
 ORDER BY total_baht DESC NULLS LAST, purchases DESC
 LIMIT ${MEMBER_LIST_LIMIT}`, params)).rows;
		}

		res.json({
			summary,
			members,
			segmentTotals,
			memberLimit: MEMBER_LIST_LIMIT,
			facets: {
				districts: [...districtMap.values()]
					.sort((a, b) => String(a.district_label || '')
						.localeCompare(String(b.district_label || ''))),
				groups: [...groupMap.entries()]
					.map(([customer_group, members]) => ({ customer_group, members }))
					.sort((a, b) => b.members - a.members),
			},
		});
	} catch (err) {
		if (err.code === '42P01') {
			return res.status(503).json({
				error: 'ยังไม่ได้โหลดข้อมูลโซน',
				hint: 'รัน data/sql/zone_analysis_*.sql ก่อน',
			});
		}
		console.error('ZONE MEMBERS:', err.message);
		res.status(500).json({ error: 'ดึงข้อมูลสมาชิกรายเขตไม่สำเร็จ' });
	}
});

// ผลงานคนขับ — สถิติทั้งหมดมาจาก view ใน database/driver_performance.sql
// view เหล่านั้นรวมยอดจาก weight_query 1.3M แถว ใช้เวลาราว 15 วินาที
// ฝั่ง app.js จึง cache ผลไว้ ไม่ยิงซ้ำทุกครั้งที่เปิดหน้า
app.get('/api-drivers', async (req, res) => {
	try {
		const [performance, monthly] = await Promise.all([
			db.query(`
SELECT * FROM mv_driver_performance
 ORDER BY bills DESC NULLS LAST`),
			db.query(`
SELECT driver, month::text AS month, bills, work_days, total_kg, total_baht
  FROM mv_driver_monthly
 ORDER BY driver, month`),
		]);

		res.json({ drivers: performance.rows, monthly: monthly.rows });
	} catch (err) {
		if (err.code === '42P01') {
			return res.status(503).json({
				error: 'ยังไม่ได้สร้าง view ผลงานคนขับ',
				hint: 'รัน database/driver_performance.sql ก่อน',
			});
		}
		console.error('DRIVERS:', err.message);
		res.status(500).json({ error: 'ดึงผลงานคนขับไม่สำเร็จ' });
	}
});

// ค้นหาสมาชิกสำหรับ dropdown เลือกเข้างานประจำ
// ไม่ส่งทั้ง 78k คน — ค้นทีละคำ จำกัดผลลัพธ์
app.get('/customers-search', async (req, res) => {
	const q = (req.query.q || '').trim();
	if (q.length < 2) return res.json([]);
	try {
		const rows = await db.query(`
SELECT DISTINCT ON (btrim(c.fullname))
       btrim(c.fullname) AS fullname,
       cg.customer_group
  FROM customers c
  LEFT JOIN customer_groups cg ON cg.id = c.id_customer
 WHERE c.fullname ILIKE '%' || $1 || '%'
   AND btrim(c.fullname) <> ''
 ORDER BY btrim(c.fullname), c.id
 LIMIT 50`, [q]);
		res.json(rows.rows);
	} catch (err) {
		console.error('CUSTOMER SEARCH:', err.message);
		res.status(500).json({ error: 'ค้นหาสมาชิกไม่สำเร็จ' });
	}
});

// ── งานประจำ ────────────────────────────────────────────────
// schema อยู่ที่ database/recurring_jobs.sql
// จุดที่ต้องระวัง: ประวัติต้องไม่เปลี่ยนตามการแก้งานประจำ ทุก endpoint ที่อ่าน
// ประวัติจึงอ่านจาก snapshot ในตารางนัด ไม่ join กลับไป recurring_jobs

function missingAnalysis(err, res) {
	if (err.code === '42P01') {
		res.status(503).json({
			error: 'ยังไม่ได้สร้างตารางวิเคราะห์',
			hint: 'รัน database/analysis_v2.sql แล้วตามด้วย database/analysis_cache.sql',
		});
		return true;
	}
	return false;
}

function missingRecurring(err, res) {
	if (err.code === '42P01') {
		res.status(503).json({
			error: 'ยังไม่ได้สร้างตารางงานประจำ',
			hint: 'รัน database/recurring_jobs.sql ก่อน',
		});
		return true;
	}
	return false;
}

app.get('/api-recurring-jobs', async (req, res) => {
	try {
		const jobs = await db.query(
			'SELECT * FROM v_recurring_jobs ORDER BY is_active DESC, job_name');
		res.json(jobs.rows);
	} catch (err) {
		if (missingRecurring(err, res)) return;
		console.error('RECURRING JOBS:', err.message);
		res.status(500).json({ error: 'ดึงงานประจำไม่สำเร็จ' });
	}
});

app.post('/api-recurring-jobs', async (req, res) => {
	const { job_name, note, members } = req.body || {};
	const name = (job_name || '').trim();
	const list = [...new Set((members || []).map(m => String(m).trim()).filter(Boolean))];

	if (!name) return res.status(400).json({ error: 'ต้องมีชื่องานประจำ' });
	if (!list.length) return res.status(400).json({ error: 'ต้องเลือกสมาชิกอย่างน้อย 1 คน' });

	try {
		await db.query('BEGIN');
		const job = await db.query(
			'INSERT INTO recurring_jobs (job_name, note) VALUES ($1, $2) RETURNING id',
			[name, note || null]);
		const id = job.rows[0].id;
		for (const member of list) {
			await db.query(
				'INSERT INTO recurring_job_members (job_id, member_name) VALUES ($1, $2)',
				[id, member]);
		}
		await db.query('COMMIT');
		res.json({ id, job_name: name, members: list });
	} catch (err) {
		await db.query('ROLLBACK').catch(() => {});
		if (missingRecurring(err, res)) return;
		if (err.code === '23505') {
			return res.status(409).json({ error: 'มีงานประจำชื่อนี้อยู่แล้ว' });
		}
		console.error('RECURRING CREATE:', err.message);
		res.status(500).json({ error: 'บันทึกงานประจำไม่สำเร็จ' });
	}
});

app.put('/api-recurring-jobs/:id', async (req, res) => {
	const id = parseInt(req.params.id, 10);
	const { job_name, note, members, is_active } = req.body || {};
	const name = (job_name || '').trim();
	const list = [...new Set((members || []).map(m => String(m).trim()).filter(Boolean))];

	if (!Number.isFinite(id)) return res.status(400).json({ error: 'id ไม่ถูกต้อง' });
	if (!name) return res.status(400).json({ error: 'ต้องมีชื่องานประจำ' });
	if (!list.length) return res.status(400).json({ error: 'ต้องเลือกสมาชิกอย่างน้อย 1 คน' });

	try {
		await db.query('BEGIN');
		// แก้ที่นี่ไม่แตะ recurring_schedule เลย — นัดเก่าถือ snapshot ของตัวเองไว้
		const updated = await db.query(`
UPDATE recurring_jobs
   SET job_name = $2, note = $3,
       is_active = COALESCE($4, is_active), updated_at = now()
 WHERE id = $1
 RETURNING id`, [id, name, note || null,
			typeof is_active === 'boolean' ? is_active : null]);

		if (!updated.rowCount) {
			await db.query('ROLLBACK');
			return res.status(404).json({ error: 'ไม่พบงานประจำนี้' });
		}

		await db.query('DELETE FROM recurring_job_members WHERE job_id = $1', [id]);
		for (const member of list) {
			await db.query(
				'INSERT INTO recurring_job_members (job_id, member_name) VALUES ($1, $2)',
				[id, member]);
		}
		await db.query('COMMIT');
		res.json({ id, job_name: name, members: list });
	} catch (err) {
		await db.query('ROLLBACK').catch(() => {});
		if (missingRecurring(err, res)) return;
		if (err.code === '23505') {
			return res.status(409).json({ error: 'มีงานประจำชื่อนี้อยู่แล้ว' });
		}
		console.error('RECURRING UPDATE:', err.message);
		res.status(500).json({ error: 'แก้ไขงานประจำไม่สำเร็จ' });
	}
});

app.delete('/api-recurring-jobs/:id', async (req, res) => {
	const id = parseInt(req.params.id, 10);
	if (!Number.isFinite(id)) return res.status(400).json({ error: 'id ไม่ถูกต้อง' });

	try {
		// ลบงานประจำ ไม่แตะ customers และไม่ลบนัดเก่า
		// recurring_schedule.job_id เป็น ON DELETE SET NULL นัดเก่าจึงอยู่ต่อ
		// พร้อม snapshot ชื่องาน+รายชื่อของมันเอง และชื่อเดิมกลับมาใช้ตั้งใหม่ได้
		const kept = await db.query(
			'SELECT count(*) AS n FROM recurring_schedule WHERE job_id = $1', [id]);
		const removed = await db.query(
			'DELETE FROM recurring_jobs WHERE id = $1 RETURNING job_name', [id]);

		if (!removed.rowCount) return res.status(404).json({ error: 'ไม่พบงานประจำนี้' });
		res.json({
			deleted: removed.rows[0].job_name,
			keptSchedules: Number(kept.rows[0].n),
		});
	} catch (err) {
		if (missingRecurring(err, res)) return;
		console.error('RECURRING DELETE:', err.message);
		res.status(500).json({ error: 'ลบงานประจำไม่สำเร็จ' });
	}
});

// ── ตารางนัด ────────────────────────────────────────────────
app.get('/api-recurring-schedule', async (req, res) => {
	const { from, to } = req.query;
	try {
		const rows = await db.query(`
SELECT s.id, s.job_id,
       -- ส่งเป็น text — driver pg แปลง date เป็น Date ของ JS แล้ว JSON.stringify
       -- เขียนออกเป็น UTC ทำให้วันเลื่อนไป 1 วันตาม timezone ของเครื่อง
       s.scheduled_date::text AS scheduled_date,
       s.job_name_snapshot, s.members_snapshot, s.driver,
       -- สถานะมาจากข้อมูลจริง ไม่ใช่ค่าที่คนกรอกไว้ (ดู v_recurring_status)
       st.status, s.status_manual, s.note,
       s.is_weekend, s.holiday_name, s.is_holiday, s.job_deleted,
       a.bills, a.lines, a.members_served, a.total_kg, a.total_baht, a.actual_drivers,
       st.booking_total, st.booking_done, st.booking_cancelled,
       st.booking_pending, st.booking_progress,
       -- ผลรายสมาชิก งานเดียวกันรวมเป็นก้อน แต่ยังแยกดูรายเจ้าได้
       COALESCE(mem.members, '[]'::json) AS member_breakdown
  FROM v_recurring_schedule s
  LEFT JOIN v_recurring_actuals a ON a.schedule_id = s.id
  LEFT JOIN v_recurring_status  st ON st.schedule_id = s.id
  LEFT JOIN LATERAL (
      SELECT json_agg(json_build_object(
                 'member_name', ma.member_name,
                 'bills',       ma.bills,
                 'total_kg',    ma.total_kg,
                 'total_baht',  ma.total_baht,
                 'drivers',     ma.drivers)
             ORDER BY ma.total_baht DESC NULLS LAST) AS members
        FROM v_recurring_member_actuals ma
       WHERE ma.schedule_id = s.id
  ) mem ON TRUE
 WHERE ($1::date IS NULL OR s.scheduled_date >= $1::date)
   AND ($2::date IS NULL OR s.scheduled_date <= $2::date)
 ORDER BY s.scheduled_date, s.job_name_snapshot`, [from || null, to || null]);

		const holidays = await db.query(`
SELECT holiday_date::text AS holiday_date, holiday_name, source
  FROM holidays
 WHERE ($1::date IS NULL OR holiday_date >= $1::date)
   AND ($2::date IS NULL OR holiday_date <= $2::date)
 ORDER BY holiday_date`, [from || null, to || null]);

		res.json({ schedule: rows.rows, holidays: holidays.rows });
	} catch (err) {
		if (missingRecurring(err, res)) return;
		console.error('RECURRING SCHEDULE:', err.message);
		res.status(500).json({ error: 'ดึงตารางนัดไม่สำเร็จ' });
	}
});

app.post('/api-recurring-schedule', async (req, res) => {
	// ไม่รับ status จากผู้ใช้ — คำนวณจากข้อมูลจริงตอนอ่าน (v_recurring_status)
	const { job_id, scheduled_date, driver, note } = req.body || {};
	const id = parseInt(job_id, 10);
	if (!Number.isFinite(id)) return res.status(400).json({ error: 'ต้องเลือกงานประจำ' });
	if (!scheduled_date) return res.status(400).json({ error: 'ต้องระบุวันที่' });

	try {
		// snapshot ชื่องานกับรายชื่อสมาชิก ณ ตอนสร้างนัด
		// แก้งานประจำทีหลังจะไม่ย้อนกลับมาเปลี่ยนนัดนี้
		const job = await db.query(
			'SELECT job_name, members FROM v_recurring_jobs WHERE id = $1', [id]);
		if (!job.rowCount) return res.status(404).json({ error: 'ไม่พบงานประจำนี้' });

		const inserted = await db.query(`
INSERT INTO recurring_schedule
       (job_id, scheduled_date, job_name_snapshot, members_snapshot, driver, note)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING id`,
			[id, scheduled_date, job.rows[0].job_name, job.rows[0].members,
			 driver || null, note || null]);

		res.json({ id: inserted.rows[0].id });
	} catch (err) {
		if (missingRecurring(err, res)) return;
		if (err.code === '23505') {
			return res.status(409).json({ error: 'งานนี้มีนัดในวันดังกล่าวแล้ว' });
		}
		console.error('SCHEDULE CREATE:', err.message);
		res.status(500).json({ error: 'บันทึกนัดไม่สำเร็จ' });
	}
});

app.put('/api-recurring-schedule/:id', async (req, res) => {
	const id = parseInt(req.params.id, 10);
	const { driver, note } = req.body || {};
	if (!Number.isFinite(id)) return res.status(400).json({ error: 'id ไม่ถูกต้อง' });

	try {
		// แก้ได้แค่คนขับกับหมายเหตุ
		// ชื่องานเป็น snapshot ห้ามแตะ ส่วนสถานะคำนวณจากข้อมูลจริง ไม่ให้กรอกเอง
		const updated = await db.query(`
UPDATE recurring_schedule
   SET driver = $2, note = $3, updated_at = now()
 WHERE id = $1
 RETURNING id`, [id, driver || null, note || null]);
		if (!updated.rowCount) return res.status(404).json({ error: 'ไม่พบนัดนี้' });
		res.json({ id });
	} catch (err) {
		if (missingRecurring(err, res)) return;
		console.error('SCHEDULE UPDATE:', err.message);
		res.status(500).json({ error: 'แก้ไขนัดไม่สำเร็จ' });
	}
});

app.delete('/api-recurring-schedule/:id', async (req, res) => {
	const id = parseInt(req.params.id, 10);
	if (!Number.isFinite(id)) return res.status(400).json({ error: 'id ไม่ถูกต้อง' });
	try {
		const removed = await db.query(
			'DELETE FROM recurring_schedule WHERE id = $1 RETURNING id', [id]);
		if (!removed.rowCount) return res.status(404).json({ error: 'ไม่พบนัดนี้' });
		res.json({ id });
	} catch (err) {
		if (missingRecurring(err, res)) return;
		console.error('SCHEDULE DELETE:', err.message);
		res.status(500).json({ error: 'ลบนัดไม่สำเร็จ' });
	}
});

// ── วันหยุด ────────────────────────────────────────────────
app.post('/api-holidays', async (req, res) => {
	const { holiday_date, holiday_name } = req.body || {};
	if (!holiday_date || !holiday_name) {
		return res.status(400).json({ error: 'ต้องมีวันที่และชื่อวันหยุด' });
	}
	try {
		await db.query(`
INSERT INTO holidays (holiday_date, holiday_name) VALUES ($1, $2)
ON CONFLICT (holiday_date) DO UPDATE SET holiday_name = EXCLUDED.holiday_name`,
			[holiday_date, holiday_name]);
		res.json({ holiday_date, holiday_name });
	} catch (err) {
		if (missingRecurring(err, res)) return;
		console.error('HOLIDAY:', err.message);
		res.status(500).json({ error: 'บันทึกวันหยุดไม่สำเร็จ' });
	}
});

// ── นัดที่แนะนำสำหรับเดือนถัดไป ──────────────────────────────
// งานประจำคือของที่เกิดซ้ำทุกเดือน เดือนใหม่จึงไม่ควรต้องกรอกใหม่ทั้งเดือน
// เอาแบบแผนของเดือนก่อนมาเป็นค่าตั้งต้น แล้วเลื่อนออกจากวันหยุด
//
// เป็นแค่ "ข้อเสนอ" ยังไม่บันทึกลงฐาน จนกว่าผู้ใช้จะกดรับ
// นัดที่มีอยู่แล้วในเดือนนั้นจะไม่ถูกเสนอซ้ำ
app.get('/api-recurring-suggest', async (req, res) => {
	const month = (req.query.month || '').trim();
	if (!/^\d{4}-\d{2}$/.test(month)) {
		return res.status(400).json({ error: 'ต้องระบุ month เป็น YYYY-MM' });
	}

	try {
		const rows = await db.query(`
WITH target AS (
    SELECT ($1 || '-01')::date                       AS month_start,
           (($1 || '-01')::date + INTERVAL '1 month'
            - INTERVAL '1 day')::date                AS month_end,
           (($1 || '-01')::date - INTERVAL '1 month')::date AS prev_start
),
prev AS (
    SELECT s.job_id,
           j.job_name,
           EXTRACT(DAY FROM s.scheduled_date)::int AS day_of_month,
           s.driver,
           max(s.scheduled_date)                   AS last_date
      FROM recurring_schedule s
      JOIN recurring_jobs j ON j.id = s.job_id AND j.is_active
     CROSS JOIN target t
     WHERE s.scheduled_date >= t.prev_start
       AND s.scheduled_date < t.month_start
      
     GROUP BY s.job_id, j.job_name, EXTRACT(DAY FROM s.scheduled_date), s.driver
),
mapped AS (
    SELECT p.job_id,
           p.job_name,
           p.driver,
           p.last_date,
           p.day_of_month,
           -- วันที่ 31 ของเดือนก่อนอาจไม่มีในเดือนนี้ ให้ตกที่วันสุดท้ายแทน
           LEAST(t.month_start + (p.day_of_month - 1),
                 t.month_end)                      AS planned_date
      FROM prev p CROSS JOIN target t
)
SELECT m.job_id,
       m.job_name,
       m.driver,
       m.last_date::text                           AS last_date,
       m.planned_date::text                        AS planned_date,
       next_working_day(m.planned_date)::text      AS suggested_date,
       (next_working_day(m.planned_date) <> m.planned_date) AS shifted,
       h.holiday_name                              AS planned_holiday
  FROM mapped m
  LEFT JOIN holidays h ON h.holiday_date = m.planned_date
 WHERE NOT EXISTS (
           SELECT 1 FROM recurring_schedule x
            WHERE x.job_id = m.job_id
              AND x.scheduled_date = next_working_day(m.planned_date))
 ORDER BY suggested_date, m.job_name`, [month]);

		res.json(rows.rows);
	} catch (err) {
		if (missingRecurring(err, res)) return;
		console.error('RECURRING SUGGEST:', err.message);
		res.status(500).json({ error: 'สร้างข้อเสนอนัดไม่สำเร็จ' });
	}
});

// รับข้อเสนอทั้งชุดในครั้งเดียว
app.post('/api-recurring-suggest', async (req, res) => {
	const items = Array.isArray(req.body?.items) ? req.body.items : [];
	if (!items.length) return res.status(400).json({ error: 'ไม่มีนัดให้บันทึก' });

	try {
		await db.query('BEGIN');
		let created = 0;
		let skipped = 0;
		for (const item of items) {
			const jobId = parseInt(item.job_id, 10);
			if (!Number.isFinite(jobId) || !item.suggested_date) { skipped++; continue; }

			const job = await db.query(
				'SELECT job_name, members FROM v_recurring_jobs WHERE id = $1', [jobId]);
			if (!job.rowCount) { skipped++; continue; }

			// ON CONFLICT DO NOTHING — กดรับซ้ำสองครั้งไม่ควรพัง
			const done = await db.query(`
INSERT INTO recurring_schedule
       (job_id, scheduled_date, job_name_snapshot, members_snapshot, driver)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (job_id, scheduled_date) WHERE job_id IS NOT NULL DO NOTHING
RETURNING id`,
				[jobId, item.suggested_date, job.rows[0].job_name,
				 job.rows[0].members, item.driver || null]);
			if (done.rowCount) created++; else skipped++;
		}
		await db.query('COMMIT');
		res.json({ created, skipped });
	} catch (err) {
		await db.query('ROLLBACK').catch(() => {});
		if (missingRecurring(err, res)) return;
		console.error('RECURRING ACCEPT:', err.message);
		res.status(500).json({ error: 'บันทึกนัดที่แนะนำไม่สำเร็จ' });
	}
});

// ── ดึงวันหยุดจากปฏิทินสาธารณะ ───────────────────────────────
// ใช้ปฏิทินวันหยุดไทยของ Google (iCal เปิดสาธารณะ ไม่ต้องมี API key)
// Nager.Date ที่เป็นตัวเลือกแรกไม่มีข้อมูลไทย (ตอบ 204 ว่าง)
//
// ดึงมาแล้วเก็บลงฐาน ไม่ใช่เรียกสดทุกครั้ง เพราะ:
//   - ปฏิทินจะทำงานได้แม้เน็ตล่ม
//   - บริษัทเพิ่มวันหยุดของตัวเองได้ ซึ่งไม่มีในปฏิทินสาธารณะ
// การ sync จะไม่ทับแถวที่ source = 'manual'
const THAI_HOLIDAY_ICS =
	'https://calendar.google.com/calendar/ical/' +
	'th.th%23holiday%40group.v.calendar.google.com/public/basic.ics';

app.post('/api-holidays/sync', async (req, res) => {
	const year = parseInt(req.body?.year, 10) || new Date().getFullYear();

	try {
		const { data } = await axios.get(THAI_HOLIDAY_ICS, {
			timeout: 30000,
			responseType: 'text',
			headers: { 'User-Agent': 'wastebuy-analytics' },
		});

		// iCal ไม่ใช่ JSON แกะเฉพาะคู่ DTSTART/SUMMARY ของ VEVENT
		const events = [];
		const pattern = /DTSTART;VALUE=DATE:(\d{8})[\s\S]*?SUMMARY:([^\r\n]+)/g;
		let match;
		while ((match = pattern.exec(data)) !== null) {
			const raw = match[1];
			if (!raw.startsWith(String(year))) continue;
			events.push({
				date: raw.slice(0, 4) + '-' + raw.slice(4, 6) + '-' + raw.slice(6),
				name: match[2].trim(),
			});
		}

		if (!events.length) {
			return res.status(502).json({
				error: 'ปฏิทินไม่มีวันหยุดของปี ' + year,
			});
		}

		let added = 0;
		let keptManual = 0;
		await db.query('BEGIN');
		for (const event of events) {
			const done = await db.query(`
INSERT INTO holidays (holiday_date, holiday_name, source, synced_at)
VALUES ($1, $2, 'google', now())
ON CONFLICT (holiday_date) DO UPDATE
   SET holiday_name = EXCLUDED.holiday_name,
       synced_at    = now()
 WHERE holidays.source <> 'manual'
RETURNING holiday_date`, [event.date, event.name]);
			if (done.rowCount) added++; else keptManual++;
		}
		await db.query('COMMIT');

		res.json({ year, found: events.length, added, keptManual });
	} catch (err) {
		await db.query('ROLLBACK').catch(() => {});
		if (missingRecurring(err, res)) return;
		console.error('HOLIDAY SYNC:', err.message);
		res.status(502).json({ error: 'ดึงวันหยุดจากปฏิทินไม่สำเร็จ' });
	}
});

// ── หน้าแรก: สรุปจากทุกการวิเคราะห์ ─────────────────────────
// อ่านจาก cache ทั้งหมด หน้าแรกต้องเปิดเร็ว ไม่งั้นคนเลิกใช้ตั้งแต่หน้าแรก
// ตัวไหนยังไม่ได้สร้าง (เช่นยังไม่โหลด zone) ให้ข้ามไป ไม่ใช่ทั้งหน้าพัง
app.get('/api-overview', async (req, res) => {
	// query ที่ล้มได้โดยไม่ทำให้ทั้งหน้าพัง — คืน [] แล้วบอกว่าส่วนไหนไม่มี
	const soft = async (key, sql, params) => {
		try {
			return { key, rows: (await db.query(sql, params)).rows };
		} catch (err) {
			if (err.code === '42P01') return { key, rows: [], missing: true };
			throw err;
		}
	};

	try {
		const results = await Promise.all([
			// เดือนล่าสุด 2 เดือนไว้เทียบกัน
			soft('months', `
SELECT month::text AS month, bills, lines, work_days, members, workers,
       total_kg, total_baht, avg_line_baht,
       cash_lines, transfer_lines, credit_lines, donate_lines, other_lines
  FROM mv_month_facts ORDER BY month DESC LIMIT 13`),

			soft('segments', `
SELECT segment,
       count(*)                           AS members,
       round(sum(total_baht)::numeric, 2) AS total_baht,
       round(avg(days_since)::numeric, 0) AS avg_days_since
  FROM v_member_rfm GROUP BY segment ORDER BY sum(total_baht) DESC NULLS LAST`),

			// รายชื่อที่ควรตามก่อน: เคยมาสม่ำเสมอ ยอดสูง แต่หายไปนานกว่าปกติของตัวเอง
			soft('atRisk', `
SELECT member_name, visits, days_since, avg_gap_days,
       total_baht, last_date::text AS last_date
  FROM v_member_rfm
 WHERE segment = 'เสี่ยงหาย'
   AND avg_gap_days IS NOT NULL
   AND days_since > avg_gap_days * 3
 ORDER BY total_baht DESC NULLS LAST
 LIMIT 8`),

			soft('stations', `
SELECT station, bills, total_kg, total_baht, bills_per_day, baht_per_bill,
       work_days, first_date::text AS first_date, last_date::text AS last_date
  FROM mv_station_performance ORDER BY total_kg DESC NULLS LAST`),

			soft('stationCoverage',
			     'SELECT first_date::text AS first_date, last_date::text AS last_date, '
			   + 'rows_with_station, rows_total FROM mv_station_coverage'),

			soft('drivers', `
SELECT driver, kind, bills, total_kg, total_baht, bills_per_day,
       success_pct, cancel_pct, price_drift_pct, work_days
  FROM mv_driver_performance
 WHERE kind = 'คนขับรถ' AND work_days >= 10
 ORDER BY bills DESC NULLS LAST
 LIMIT 5`),

			// คนขับที่ตัวเลขน่าห่วง เรียงจากอัตรายกเลิกสูงสุด
			soft('driverWatch', `
SELECT driver, bills, cancel_pct, price_drift_pct, work_days
  FROM mv_driver_performance
 WHERE kind = 'คนขับรถ' AND work_days >= 10 AND cancel_pct IS NOT NULL
 ORDER BY cancel_pct DESC NULLS LAST
 LIMIT 5`),

			soft('materials', `
SELECT COALESCE(c.category, w.category) AS category,
       round(sum(w.net_weight)::numeric, 2)  AS total_kg,
       round(sum(w.total_price)::numeric, 2) AS total_baht
  FROM weight_query w
  LEFT JOIN mv_item_category c ON c.item_code = w.item_code
 WHERE w.purchase_date >= (SELECT max(month) FROM mv_month_facts)
 GROUP BY 1 ORDER BY 2 DESC NULLS LAST LIMIT 8`),

			soft('dataIssues', `
SELECT count(*) FILTER (WHERE category IS NULL)      AS pending_items,
       count(*) FILTER (WHERE source = 'ai')          AS ai_items,
       (SELECT count(*) FROM v_orphan_categories)     AS orphan_categories
  FROM item_category_overrides`),

			soft('upcoming', `
SELECT s.scheduled_date::text AS scheduled_date, s.job_name_snapshot, s.driver,
       st.status
  FROM recurring_schedule s
  LEFT JOIN v_recurring_status st ON st.schedule_id = s.id
 WHERE s.scheduled_date >= CURRENT_DATE
 ORDER BY s.scheduled_date
 LIMIT 5`),

			soft('aiSummary', `
SELECT month::text AS month, summary, created_at, model
  FROM ai_monthly_summary ORDER BY month DESC LIMIT 1`),

			soft('cache',
			     'SELECT refreshed_at FROM analysis_cache_log ORDER BY id DESC LIMIT 1'),

			soft('bookings', `
SELECT status, count(*) AS bookings
  FROM booking_queue
 WHERE booking_date >= (SELECT max(month) FROM mv_month_facts)
 GROUP BY 1 ORDER BY 2 DESC`),
		]);

		const out = { missing: [] };
		for (const r of results) {
			out[r.key] = r.rows;
			if (r.missing) out.missing.push(r.key);
		}
		out.ai = geminiStatus();
		// บอกหน้าแรกว่าตัวเลขที่เห็นตรงกับข้อมูลล่าสุดหรือยัง
		const state = await cacheState(db).catch(() => null);
		out.cacheStale = Boolean(state && state.stale);
		res.json(out);
	} catch (err) {
		if (missingAnalysis(err, res)) return;
		console.error('OVERVIEW:', err.message);
		res.status(500).json({ error: 'ดึงภาพรวมไม่สำเร็จ' });
	}
});

// ── B1: สมาชิก RFM และคนที่กำลังหาย ─────────────────────────
// อ่านจาก v_member_rfm ซึ่งอ่านต่อจาก mv_member_activity (cache)
// ไม่แตะ weight_query 1.3M แถวตอน request
app.get('/api-member-rfm', async (req, res) => {
	const { segment, q, sort } = req.query;
	const limit = Math.min(parseInt(req.query.limit, 10) || 200, 1000);

	// ชื่อคอลัมน์มาจากตารางนี้เท่านั้น ห้ามเอาค่าจาก query ไปต่อ SQL ตรง ๆ
	const orderBy = {
		baht:   'total_baht DESC NULLS LAST',
		kg:     'total_kg DESC NULLS LAST',
		visits: 'visits DESC',
		recent: 'last_date DESC',
		stale:  'days_since DESC',
	}[sort] || 'total_baht DESC NULLS LAST';

	try {
		// การ์ดสรุปคิดจากทั้งชุดเสมอ ไม่ใช่จากหน้าที่กำลังดู
		// ไม่งั้นเลือกกลุ่มหนึ่งแล้วยอดรวมเปลี่ยนตามจนเทียบกันไม่ได้
		const summary = await db.query(`
SELECT segment,
       count(*)                               AS members,
       round(sum(total_baht)::numeric, 2)     AS total_baht,
       round(sum(total_kg)::numeric, 2)       AS total_kg,
       round(avg(days_since)::numeric, 0)     AS avg_days_since,
       round(avg(baht_per_visit)::numeric, 2) AS avg_baht_per_visit
  FROM v_member_rfm
 GROUP BY segment
 ORDER BY sum(total_baht) DESC NULLS LAST`);

		const rows = await db.query(`
SELECT member_name, segment, visits, bills, total_kg, total_baht,
       first_date::text AS first_date, last_date::text AS last_date,
       days_since, avg_gap_days, baht_per_visit, kg_per_visit,
       r_score, f_score, m_score, drivers, active_months
  FROM v_member_rfm
 WHERE ($1::text IS NULL OR segment = $1::text)
   AND ($2::text IS NULL OR member_name ILIKE '%' || $2::text || '%')
 ORDER BY ${orderBy}
 LIMIT ${limit}`, [segment || null, q || null]);

		const dataDate = await db.query('SELECT max(data_date)::text AS d FROM v_member_rfm');

		res.json({
			summary: summary.rows,
			members: rows.rows,
			dataDate: dataDate.rows[0] ? dataDate.rows[0].d : null,
			limit,
		});
	} catch (err) {
		if (missingAnalysis(err, res)) return;
		console.error('MEMBER RFM:', err.message);
		res.status(500).json({ error: 'ดึงข้อมูลสมาชิกไม่สำเร็จ' });
	}
});

// ── B4: เทียบผลงานคลัง ──────────────────────────────────────
app.get('/api-station-performance', async (req, res) => {
	try {
		const [perf, materials, monthly, coverage] = await Promise.all([
			db.query(`SELECT station, work_days, bills, lines, drivers, members, vehicles,
			                 total_kg, total_baht, total_ghg, avg_line_baht, baht_per_bill,
			                 kg_per_day, bills_per_day,
			                 first_date::text AS first_date, last_date::text AS last_date
			            FROM mv_station_performance ORDER BY total_kg DESC NULLS LAST`),
			db.query(`SELECT station, category, lines, total_kg, total_baht
			            FROM mv_station_materials ORDER BY station, total_kg DESC`),
			db.query(`SELECT station, month::text AS month, bills, total_kg, total_baht
			            FROM mv_station_monthly ORDER BY month, station`),
			// คอลัมน์ station เพิ่งเริ่มเก็บ ต้องบอกช่วงที่ใช้ได้ให้ชัด
			// ไม่งั้นคนอ่านจะนึกว่าคลังที่ตัวเลขน้อยคือคลังที่ทำงานน้อย
			db.query(`SELECT first_date::text AS first_date, last_date::text AS last_date,
			                 rows_with_station, rows_total FROM mv_station_coverage`),
		]);

		res.json({
			stations: perf.rows,
			materials: materials.rows,
			monthly: monthly.rows,
			coverage: coverage.rows[0] || null,
		});
	} catch (err) {
		if (missingAnalysis(err, res)) return;
		console.error('STATION PERF:', err.message);
		res.status(500).json({ error: 'ดึงผลงานคลังไม่สำเร็จ' });
	}
});

// ── A1: หมวดสินค้าที่ต้องตัดสิน ─────────────────────────────
app.get('/api-item-categories', async (req, res) => {
	try {
		const [rows, groups, orphans] = await Promise.all([
			db.query(`
SELECT o.item_code, o.item_name, o.project_name, o.source_value,
       o.category, o.source, o.confidence, o.note,
       o.confirmed_by, o.confirmed_at,
       COALESCE(u.lines, 0)      AS lines,
       COALESCE(u.total_kg, 0)   AS total_kg,
       COALESCE(u.total_baht, 0) AS total_baht
  FROM item_category_overrides o
  LEFT JOIN mv_unknown_items u ON u.item_code = o.item_code
 ORDER BY (o.category IS NULL) DESC, u.total_baht DESC NULLS LAST, o.item_code`),
			db.query('SELECT DISTINCT material_group FROM category_materials ORDER BY 1'),
			db.query(`SELECT category_code, material_group FROM v_orphan_categories
			           ORDER BY category_code`),
		]);
		res.json({
			items: rows.rows,
			groups: groups.rows.map(r => r.material_group),
			orphanCategories: orphans.rows,
			ai: geminiStatus(),
		});
	} catch (err) {
		if (missingAnalysis(err, res)) return;
		console.error('ITEM CATEGORIES:', err.message);
		res.status(500).json({ error: 'ดึงรายการหมวดสินค้าไม่สำเร็จ' });
	}
});

// คนยืนยันหมวดเอง — source='manual' แล้ว seed อัตโนมัติจะไม่เขียนทับอีก
app.put('/api-item-categories/:code', async (req, res) => {
	const { category, note, confirmed_by } = req.body || {};
	if (!category) return res.status(400).json({ error: 'ต้องระบุหมวด' });

	try {
		const updated = await db.query(`
UPDATE item_category_overrides
   SET category = $2, note = $3, source = 'manual',
       confirmed_by = $4, confirmed_at = now(), updated_at = now()
 WHERE item_code = $1
 RETURNING item_code, category`,
			[req.params.code, category, note || null, confirmed_by || null]);

		if (!updated.rowCount) return res.status(404).json({ error: 'ไม่พบรหัสสินค้านี้' });
		// หมวดเปลี่ยน = ยอดรายหมวดของทุกคลังเปลี่ยนตาม
		await db.query('REFRESH MATERIALIZED VIEW mv_item_category');
		res.json(updated.rows[0]);
	} catch (err) {
		if (missingAnalysis(err, res)) return;
		console.error('ITEM CATEGORY SAVE:', err.message);
		res.status(500).json({ error: 'บันทึกหมวดไม่สำเร็จ' });
	}
});

// ── C2: ให้ Gemini เดาหมวดของ SKU ที่จับคู่ไม่ได้ ────────────
// ส่งไปแค่ชื่อสินค้ากับรายชื่อหมวดที่มี ไม่มีข้อมูลส่วนบุคคล
// ผลที่ได้เป็นข้อเสนอ (source='ai') ต้องมีคนกดยืนยันก่อนถึงนับว่าตัดสินแล้ว
app.post('/api-item-categories/suggest', async (req, res) => {
	try {
		const pending = await db.query(`
SELECT item_code, item_name FROM item_category_overrides
 WHERE category IS NULL ORDER BY item_code LIMIT 60`);

		if (!pending.rowCount) return res.json({ suggested: 0, message: 'ไม่มีรายการค้าง' });

		const groups = (await db.query(
			'SELECT DISTINCT material_group FROM category_materials ORDER BY 1'
		)).rows.map(r => r.material_group);

		const prompt = [
			'จัดหมวดวัสดุรีไซเคิลให้สินค้าต่อไปนี้ จากชื่อสินค้าภาษาไทย',
			'',
			'เลือกได้เฉพาะหมวดในรายการนี้เท่านั้น:',
			groups.map(g => '- ' + g).join(String.fromCharCode(10)),
			'',
			'สินค้า:',
			pending.rows.map(r => r.item_code + ' | ' + r.item_name).join(String.fromCharCode(10)),
			'',
			'ตอบเป็น JSON array อย่างเดียว ไม่ต้องมีคำอธิบาย:',
			'[{"item_code":"...","category":"...","confidence":0.0-1.0,"reason":"สั้น ๆ"}]',
			'ไม่มั่นใจให้ใส่ confidence ต่ำ อย่าเดาหมวดที่ไม่มีในรายการ',
		].join(String.fromCharCode(10));

		const { text, runId } = await askGemini(db, {
			task: 'classify-items',
			prompt,
			inputSummary: pending.rowCount + ' SKU',
			json: true,
		});

		let parsed;
		try {
			parsed = parseJsonReply(text);
		} catch (parseErr) {
			return res.status(502).json({ error: 'โมเดลตอบไม่ใช่ JSON', runId });
		}

		// รับเฉพาะหมวดที่มีอยู่จริง โมเดลคิดหมวดใหม่ขึ้นมาเองได้เสมอ
		const valid = new Set(groups);
		let saved = 0;
		const rejected = [];
		for (const item of Array.isArray(parsed) ? parsed : []) {
			if (!item || !item.item_code || !valid.has(item.category)) {
				rejected.push(item && item.item_code ? item.item_code : '(ไม่มีรหัส)');
				continue;
			}
			const done = await db.query(`
UPDATE item_category_overrides
   SET category = $2, confidence = $3, note = $4, source = 'ai', updated_at = now()
 WHERE item_code = $1 AND source <> 'manual'
 RETURNING item_code`,
				[item.item_code, item.category,
				 Number(item.confidence) || null, item.reason || null]);
			saved += done.rowCount;
		}

		res.json({ suggested: saved, rejected, runId, total: pending.rowCount });
	} catch (err) {
		if (err.code === 'NO_KEY') return res.status(503).json(geminiStatus());
		if (missingAnalysis(err, res)) return;
		console.error('AI SUGGEST:', err.message);
		res.status(502).json({ error: err.message, runId: err.runId || null });
	}
});

// ── C4: สรุปภาพรวมรายเดือนเป็นภาษาไทย ───────────────────────
// ตัวเลขทั้งหมดคำนวณด้วย SQL ก่อน โมเดลได้แค่ตัวเลขสำเร็จรูป
// ไม่ให้โมเดลคำนวณเอง เพราะเลขที่ LLM บวกเองเชื่อไม่ได้
app.get('/api-month-summary', async (req, res) => {
	const month = req.query.month;
	try {
		const facts = await db.query(`
SELECT month::text AS month, bills, lines, work_days, members, workers,
       total_kg, total_baht, avg_line_baht,
       cash_lines, transfer_lines, credit_lines, donate_lines, other_lines
  FROM mv_month_facts
 WHERE ($1::date IS NULL OR month = $1::date)
 ORDER BY month DESC
 LIMIT 13`, [month ? month + '-01' : null]);

		const cached = month
			? await db.query(`SELECT summary, created_at, model FROM ai_monthly_summary
			                   WHERE month = $1`, [month + '-01'])
			: { rows: [] };

		res.json({
			facts: facts.rows,
			summary: cached.rows[0] || null,
			ai: geminiStatus(),
		});
	} catch (err) {
		if (missingAnalysis(err, res)) return;
		console.error('MONTH FACTS:', err.message);
		res.status(500).json({ error: 'ดึงตัวเลขรายเดือนไม่สำเร็จ' });
	}
});

app.post('/api-month-summary', async (req, res) => {
	const month = (req.body || {}).month;
	if (!month) return res.status(400).json({ error: 'ต้องระบุเดือน' });

	try {
		const facts = await db.query(`
SELECT month::text AS month, bills, lines, work_days, members, workers,
       total_kg, total_baht, avg_line_baht,
       cash_lines, transfer_lines, credit_lines, donate_lines, other_lines
  FROM mv_month_facts
 WHERE month <= $1::date
 ORDER BY month DESC
 LIMIT 4`, [month + '-01']);

		if (!facts.rowCount) return res.status(404).json({ error: 'ไม่มีข้อมูลเดือนนี้' });

		const target = facts.rows[0];
		const stations = await db.query(`
SELECT station, bills, total_kg, total_baht
  FROM mv_station_monthly WHERE month = $1::date
 ORDER BY total_kg DESC`, [month + '-01']);

		const prompt = [
			'เขียนสรุปภาพรวมธุรกิจรับซื้อของเก่าประจำเดือน เป็นภาษาไทย สำหรับผู้บริหารอ่าน',
			'',
			'ข้อกำหนด:',
			'- ใช้ได้เฉพาะตัวเลขที่ให้มา ห้ามคำนวณเลขใหม่หรือเดาตัวเลขที่ไม่มี',
			'- ชี้จุดที่เปลี่ยนไปจากเดือนก่อน และบอกว่าน่าจะเพราะอะไร',
			'- ถ้าเห็นอะไรผิดปกติให้บอกตรง ๆ',
			'- ความยาว 3-5 ย่อหน้าสั้น ๆ ไม่ต้องมีหัวข้อ',
			'',
			'เดือนที่ต้องสรุป: ' + target.month,
			'',
			'ตัวเลขรายเดือน (ใหม่ไปเก่า):',
			JSON.stringify(facts.rows, null, 1),
			'',
			'แยกตามคลังของเดือนนี้:',
			JSON.stringify(stations.rows, null, 1),
		].join(String.fromCharCode(10));

		const { text, runId, model } = await askGemini(db, {
			task: 'monthly-summary',
			prompt,
			inputSummary: 'เดือน ' + target.month,
		});

		await db.query(`
INSERT INTO ai_monthly_summary (month, summary, facts, model, run_id)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (month) DO UPDATE
   SET summary = EXCLUDED.summary, facts = EXCLUDED.facts,
       model = EXCLUDED.model, run_id = EXCLUDED.run_id, created_at = now()`,
			[month + '-01', text, JSON.stringify(facts.rows), model, runId]);

		res.json({ month: target.month, summary: text, runId });
	} catch (err) {
		if (err.code === 'NO_KEY') return res.status(503).json(geminiStatus());
		if (missingAnalysis(err, res)) return;
		console.error('MONTH SUMMARY:', err.message);
		res.status(502).json({ error: err.message, runId: err.runId || null });
	}
});

// ── สถานะ cache ─────────────────────────────────────────────
// หน้าเว็บต้องบอกได้ว่าตัวเลขที่เห็นคำนวณไว้เมื่อไร
app.get('/api-cache-status', async (req, res) => {
	try {
		const last = await db.query(
			'SELECT refreshed_at, detail FROM analysis_cache_log ORDER BY id DESC LIMIT 1');
		res.json({
			last: last.rows[0] || null,
			state: await cacheState(db),
			ai: geminiStatus(),
		});
	} catch (err) {
		if (missingAnalysis(err, res)) return;
		res.status(500).json({ error: 'อ่านสถานะ cache ไม่สำเร็จ' });
	}
});

app.post('/api-cache-refresh', async (req, res) => {
	try {
		res.json(await refreshCache(db, { reason: 'สั่งจากหน้าเว็บ' }));
	} catch (err) {
		if (missingAnalysis(err, res)) return;
		console.error('CACHE REFRESH:', err.message);
		res.status(500).json({ error: 'คำนวณใหม่ไม่สำเร็จ' });
	}
});

// ── วิเคราะห์ ───────────────────────────────────────────────
app.get('/api-recurring-analysis', async (req, res) => {
	const { from, to, job } = req.query;
	try {
		const byDate = await db.query(`
SELECT s.scheduled_date::text AS scheduled_date,
       s.job_name_snapshot,
       s.driver               AS assigned_driver,
       st.status,
       a.bills, a.total_kg, a.total_baht, a.members_served, a.actual_drivers,
       COALESCE(mem.members, '[]'::json) AS member_breakdown
  FROM v_recurring_schedule s
  LEFT JOIN v_recurring_actuals a ON a.schedule_id = s.id
  LEFT JOIN v_recurring_status  st ON st.schedule_id = s.id
  LEFT JOIN LATERAL (
      SELECT json_agg(json_build_object(
                 'member_name', ma.member_name,
                 'bills',       ma.bills,
                 'total_kg',    ma.total_kg,
                 'total_baht',  ma.total_baht)
             ORDER BY ma.total_baht DESC NULLS LAST) AS members
        FROM v_recurring_member_actuals ma
       WHERE ma.schedule_id = s.id
  ) mem ON TRUE
 WHERE ($1::date IS NULL OR s.scheduled_date >= $1::date)
   AND ($2::date IS NULL OR s.scheduled_date <= $2::date)
   AND ($3::text IS NULL OR s.job_name_snapshot = $3::text)
 ORDER BY s.scheduled_date DESC`, [from || null, to || null, job || null]);

		const materials = await db.query(`
SELECT category, item_name,
       sum(bills)      AS bills,
       sum(total_kg)   AS total_kg,
       sum(total_baht) AS total_baht
  FROM v_recurring_materials
 WHERE ($1::date IS NULL OR scheduled_date >= $1::date)
   AND ($2::date IS NULL OR scheduled_date <= $2::date)
   AND ($3::text IS NULL OR job_name_snapshot = $3::text)
 GROUP BY category, item_name
 ORDER BY sum(total_kg) DESC NULLS LAST`, [from || null, to || null, job || null]);

		// คนขับที่ไปรับจริง อ่านจาก weight_query ไม่ใช่ช่องที่กรอกไว้
		// คนที่ถูกมอบหมายกับคนที่ไปจริงไม่จำเป็นต้องเป็นคนเดียวกัน
		const drivers = await db.query(`
SELECT w.driver_name AS driver,
       count(DISTINCT s.id)                  AS jobs,
       count(DISTINCT w.purchase_number)     AS bills,
       round(sum(w.net_weight)::numeric, 2)  AS total_kg,
       round(sum(w.total_price)::numeric, 2)  AS total_baht
  FROM recurring_schedule s
  JOIN v_recurring_schedule_members sm ON sm.schedule_id = s.id
  JOIN weight_query w
    ON w.purchase_date = s.scheduled_date
   AND btrim(w.member_name) = ANY (sm.members)
 WHERE ($1::date IS NULL OR s.scheduled_date >= $1::date)
   AND ($2::date IS NULL OR s.scheduled_date <= $2::date)
   AND ($3::text IS NULL OR s.job_name_snapshot = $3::text)
   AND w.driver_name IS NOT NULL
 GROUP BY w.driver_name
 ORDER BY sum(w.total_price) DESC NULLS LAST`, [from || null, to || null, job || null]);

		res.json({
			byDate: byDate.rows,
			materials: materials.rows,
			drivers: drivers.rows,
		});
	} catch (err) {
		if (missingRecurring(err, res)) return;
		console.error('RECURRING ANALYSIS:', err.message);
		res.status(500).json({ error: 'วิเคราะห์งานประจำไม่สำเร็จ' });
	}
});

app.listen(port, () => {
	console.log(`listening on API: ${port}`);

	// ระบบดูแล cache ของตัวเอง — ไม่ต้องให้คนใช้สั่งสคริปต์เอง
	// เช็คว่าข้อมูลต้นทางเปลี่ยนไหม เปลี่ยนแล้วคำนวณใหม่เบื้องหลัง
	// (ปิดได้ด้วย CACHE_AUTO_REFRESH=0 ถ้าอยากคุมเองผ่าน scripts/refresh-cache.ps1)
	if (process.env.CACHE_AUTO_REFRESH !== '0') {
		const minutes = parseInt(process.env.CACHE_CHECK_MINUTES, 10) || 15;
		startCacheWatcher(db, { intervalMs: minutes * 60 * 1000 });
		console.log(`cache: ตรวจข้อมูลใหม่ทุก ${minutes} นาที`);
	}
})
