import express, { query } from "express";
import bodyParser from "body-parser";
import pg from "pg";
import fs from "fs";
import axios from "axios";
import xlsx from "xlsx";
import csvParser from "csv-parser";
import { extractlocation, SerialToDateBE } from "./function/scripts.js";
// import { SocketIo } from "socket.io";

const db = new pg.Client({
	user: "postgres",
	host: "localhost",
	database: "wastebuy-analytics",
	password: "admin",
	port: 5432,
});

db.connect(err => {
	if (err) {
		console.error('Connection Failed: ', err);
		process.exit(1);
	}
	console.log('Connection Success !!')
});
const app = express();
const port = 4000;

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
LEFT JOIN lookup_provinces lp ON c.address LIKE '%' || id_search ||'%'
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
        COALESCE(c.fname, ' ') || ' ' || COALESCE(c.lname, ' ') AS full_name,
        c.phone,
        cg.customer_group,
        g.gender,
        em.email,
        c.address,
        c.id_company,
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
        c.regis_date
    FROM
        customers c
    LEFT JOIN customer_groups cg ON c.id_customer = cg.id
    LEFT JOIN genders g ON c.id_gender = g.id
    LEFT JOIN emails em ON c.id_email = em.id
    LEFT JOIN companies cm ON c.id_company = cm.id
    LEFT JOIN thai_provinces p ON c.id_provinces = p.id
    LEFT JOIN thai_amphures am ON c.id_amphures = am.id
    LEFT JOIN thai_tambons t ON c.id_tambons = t.id
    LEFT JOIN status s ON c.id_status = s.id
    LEFT JOIN lookup_provinces lp ON c.address LIKE '%' || lp.id_search || '%'
    WHERE c.id = $1;
    `;
	try {
		const result = await db.query(sql, [customer_id]);
		if (result.rows.length === 0) {
			return res.status(404).send('No Customer found with ID', err);
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
            wq.customer_name,
            wq.item_name,
            wq.category,
            SUM(wq.price_per_kg) AS total_price_per_kg,
            SUM(wq.total_price) AS total_price,
            wq.unit
        FROM
            weight_query wq
        GROUP BY
            wq.purchase_date,
            wq.customer_name,
            wq.item_name,
            wq.category,
            wq.unit
        ORDER BY
            wq.purchase_date,
            wq.customer_name,
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
            wq.customer_name,
            wq.location,
            wq.item_name,
            wq.category,
            SUM(wq.price_per_kg) AS total_price_per_kg,
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
            wq.location,
            wq.purchase_date,
            wq.purchase_number,
            wq.customer_name,
            wq.item_name,
            wq.category,
            wq.unit
        ORDER BY
            wq.purchase_date,
            wq.customer_name,
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
    	sum(wq.price_per_kg) as kg_delivery,
    	sum(wq.gross_weight) as unit_delivery,
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
    	wq.item_name,
    	wq.item_category,
    	sum(wq.quantity_kg) as kg_station,
    	sum(wq.quantity_per_unit) as unit_station,
        sum(wq.quantity_price) as total_station
    from
    	weight_query_station wq
    	where wq.purchase_date between $1 and $2
    	group by
    		wq.purchase_date,
    		wq.item_name,
    		wq.item_category
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
	const { startDate, endDate, customer_group } = req.query;
	const sql = `
SELECT
    wq.purchase_date,
	wq.purchase_number,
    wq.location,
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
    SUM(wq.price_per_kg) AS kg_delivery,
    SUM(wq.gross_weight) AS unit_delivery,
    SUM(wq.total_price) AS total_delivery
FROM
    weight_query wq
LEFT JOIN customers c ON wq.location = c.fullname
LEFT JOIN thai_tambons tm on c.id_tambons = tm.id
LEFT JOIN thai_amphures am ON c.id_amphures = am.id
left join customer_groups cg on c.id_customer = cg.id
left join thai_provinces p on c.id_provinces = p.id
WHERE
    wq.purchase_date BETWEEN $1 AND $2
GROUP BY
    wq.purchase_date,
	wq.purchase_number,
    wq.location,
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
		const result = await db.query(sql, [startDate, endDate]);

		res.json(result.rows);

	} catch (err) {
		console.error('Connnection Failed', err);
		res.status(500).send('Connnection Failed');
	}
})

app.get('/api-carbon-cal', async (req, res) => {
	const { startDate, endDate, limit, page, customer_group, amphures } = req.query;

	try {
		const result = await axios.get('http://localhost:3000/api/carbon-credit', {
			params: {
				startDate: startDate,
				endDate: endDate
			}
		});

		let calc = result.data.totals;

		if (customer_group && customer_group.length > 0) {
			calc = calc.filter(item => customer_group.includes(item.customer_group));
		}

		if (amphures && amphures.length > 0) {
			calc = calc.filter(item => amphures.includes(item.amphures));
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
		const result = await axios.get('http://localhost:3000/api/carbon-credit-material', {
			params: {
				startDate: startDate,
				endDate: endDate
			}
		});

		let calc = result.data.totals;
		if (customer_group && customer_group.length > 0) {
			calc = calc.filter(item => customer_group.includes(item.customer_group));
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

async function resolveShortlink(url) {
	try {
		const response = await axios.get(url, {
			maxRedirects: 5,
			timeout: 10000,
			validateStatus: status => status >= 200 && status < 400,
		});

		const finalUrl = response.request.res.responseUrl;
		const match =
			finalUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) ||
			finalUrl.match(/q=(-?\d+\.\d+),(-?\d+\.\d+)/);

		if (match) {
			return {
				lat: parseFloat(match[1]),
				lng: parseFloat(match[2])
			};
		} else {
			return { lat: null, lng: null, error: 'พิกัดไม่พบใน URL' };
		}
	} catch (error) {
		return { lat: null, lng: null, error: error.message };
	}
}

app.get('/api-location-customer', async (req, res) => {
	const inputFile = 'จัดการการจองคิวขาย.csv';
	const outputFile = 'locations.xlsx';

	const result = [];
	const promises = [];

	try {
		await new Promise((resolve, reject) => {
			fs.createReadStream(inputFile)
				.pipe(csvParser())
				.on('data', (row) => {
					const promise = resolveShortlink(row['แผนที่(ปักหมุด)']).then(({ lat, lng }) => {
						result.push({
							'ชื่อสมาชิก': row['ชื่อสมาชิก'],
							'เลขที่การจอง': row['เลขที่การจอง'],
							'ช่วงเวลา': row['ช่วงเวลา'],
							'รถ Waste buy': row['รถ Waste buy'],
							'วันที่บันทึก': row['วันที่บันทึก'],
							'วันที่จอง': row['วันที่จอง'],
							'อำเภอ/เขต': row['อำเภอ/เขต'],
							'แผนที่(ปักหมุด)': row['แผนที่(ปักหมุด)'],
							// lat,
							// lng,
							'สถานะ': row['สถานะ']
						});
					}).catch(err => {
						result.push({
							'ชื่อสมาชิก': row['ชื่อสมาชิก'],
							'เลขที่การจอง': row['เลขที่การจอง'],
							'แผนที่(ปักหมุด)': row['แผนที่(ปักหมุด)'],
							// lat: null,
							// lng: null,
							error: err.message
						});
					});
					promises.push(promise);
				}).on('end', async () => {
					try {
						await Promise.all(promises);
						const ws = xlsx.utils.json_to_sheet(result);
						const wb = xlsx.utils.book_new();
						xlsx.utils.book_append_sheet(wb, ws, 'Mapped Data');
						xlsx.writeFile(wb, outputFile);
						// console.log(`Saved: ${outputFile} success !!`);
						resolve();
					} catch (err) {
						reject(err);
					}
				})
				.on('error', reject);
		});

		const workbook = xlsx.readFile(outputFile, { raw: false });
		const sheet = workbook.Sheets[workbook.SheetNames[0]];
		let data = xlsx.utils.sheet_to_json(sheet);

		data = data.map(row => {
			if (typeof row["วันที่บันทึก"] === "number") {
				row["วันที่บันทึก"] = SerialToDateBE(row["วันที่บันทึก"]);
			}
			if (typeof row["วันที่จอง"] === "number") {
				row["วันที่จอง"] = SerialToDateBE(row["วันที่จอง"]);
			}
			return row;
		});
		res.json(data);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: "❌ เกิดข้อผิดพลาดในการประมวลผล" });
	}
});

app.listen(port, () => {
	console.log(`listening on API: ${port}`);
})

