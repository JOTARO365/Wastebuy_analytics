import express from "express";
import axios, { all, Axios } from "axios";
import { FormatDate, InEndDate, InStartDate, showDate } from "./function/scripts.js";
import { carbonCalc, setCarbonOverrides, unknownMaterials, toIsoDate, normalizeMaterialName } from "./function/scripts.js";
import { resolve } from "chart.js/helpers";

import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));

// app.js คุยกับ server.js ผ่าน HTTP — ทั้งสอง port ต้องตั้งได้จาก env
// ไม่งั้น deploy ที่ใช้ port อื่นจะยิงไปที่ 4000 ที่ไม่มีอะไรฟังอยู่
const api = process.env.API_URL || `http://127.0.0.1:${process.env.API_PORT || 4000}/`;
const app = express();
const port = parseInt(process.env.PORT, 10) || 3000;

// pm2 ตั้ง cwd เป็นอะไรก็ได้ ถ้าอ้าง path แบบสัมพัทธ์ static กับ views จะ 404
app.set("views", path.join(ROOT, "views"));
app.set("view engine", "ejs");

// ?limit= และ ?page= มาจาก query string ตรง ๆ ไม่เคยถูกตรวจ
// limit=99999999 จึงสั่งให้ประกอบทั้งชุดเป็น HTML ก้อนเดียวได้
// (หน้ารายละเอียดลูกค้าที่ค่า default ก็ตอบ 22 MB อยู่แล้ว)
const MAX_LIMIT = 20000;

function readLimit(value, fallback) {
	const n = parseInt(value, 10);
	if (!Number.isFinite(n) || n < 1) return fallback;
	return Math.min(n, MAX_LIMIT);
}

function readPage(value) {
	const n = parseInt(value, 10);
	return Number.isFinite(n) && n > 0 ? n : 1;
}

app.use(express.static(path.join(ROOT, 'public')))

// เบราว์เซอร์ cache ไฟล์ใน public/ ไว้ แก้สคริปต์แล้วผู้ใช้ยังได้ตัวเดิม
// จนกว่าจะ hard-reload — ต่อท้ายด้วยเวลาที่ server เริ่ม ทุก deploy จึงได้ตัวใหม่
const ASSET_VERSION = Date.now().toString(36);

// ค่า GHG ที่ตั้งไว้ในระบบ admin (materials.GHG) ต้องชนะตารางที่ฝังในโค้ด
// ดึงครั้งเดียวตอนเริ่ม ถ้า API ยังไม่ขึ้นก็ใช้ตารางในโค้ดไปก่อน ไม่ทำให้เว็บล่ม
async function loadCarbonOverrides() {
	try {
		const { data } = await axios.get(api + 'materials', { timeout: 10000 });
		const n = setCarbonOverrides(data.map(m => ({ name_mat: m.name_mat, ghg: m.ghg })));
		console.log(`carbon factor override จาก materials: ${n} รายการ`);
	} catch (err) {
		console.warn(`โหลด materials ไม่ได้ ใช้แฟกเตอร์ในโค้ดแทน: ${err.message}`);
	}
}


// ช่วงวันที่ที่มีข้อมูลจริง ใช้เป็นค่าเริ่มต้นของทุกหน้ารายงาน
// ข้อมูลตามหลังปฏิทินอยู่เสมอ (โหลดเป็นรอบเดือน) ถ้า default เป็น "วันนี้"
// ทุกหน้าจะเปิดมาว่างจนกว่าผู้ใช้จะเดาเองว่าข้อมูลถึงวันไหน
let dataRange = { min_date: null, max_date: null, fetchedAt: 0 };
const DATA_RANGE_TTL_MS = 5 * 60 * 1000;

async function latestDataDate() {
	const now = Date.now();
	if (dataRange.max_date && now - dataRange.fetchedAt < DATA_RANGE_TTL_MS) {
		return dataRange.max_date;
	}
	try {
		const { data } = await axios.get(api + 'data-range', { timeout: 15000 });
		dataRange = { ...data, fetchedAt: now };
	} catch (err) {
		// อัปเดตเวลาไว้ด้วยแม้พลาด ไม่งั้นตอน API ล่มจะยิงซ้ำทุก request
		dataRange = { ...dataRange, fetchedAt: now };
		console.warn(`อ่านช่วงวันที่ของข้อมูลไม่ได้ ใช้วันนี้แทน: ${err.message}`);
	}
	return dataRange.max_date || showDate();
}

// ข้อมูลโหลดเป็นรอบเดือน ระหว่างรอบถัดไปตัวเลขบนหน้าจอจึงไม่ใช่ของเดือนปัจจุบัน
// ถ้าไม่บอก คนอ่านจะเข้าใจว่ายอดเดือนนี้ตกฮวบ ทั้งที่ยังไม่ได้โหลดเข้ามา
const STALE_AFTER_DAYS = 7;

async function dataFreshness() {
	const maxDate = await latestDataDate();
	const today = showDate();
	const daysBehind = Math.round(
		(new Date(today + 'T00:00:00') - new Date(maxDate + 'T00:00:00')) / 86400000);
	return {
		maxDate,
		minDate: dataRange.min_date,
		today,
		daysBehind,
		stale: daysBehind > STALE_AFTER_DAYS,
	};
}

// เมนู + ชื่อหน้า อยู่ที่เดียว เพิ่ม module ใหม่ = เพิ่มบรรทัดเดียวตรงนี้
// (เดิมทุกหน้าเขียนหัวเรื่องซ้ำเอง แถบข้างจึงไม่รู้ว่าตัวเองอยู่หน้าไหน)
const NAV = [
	{ group: 'รายงาน', items: [
		{ path: '/material-information', icon: 'fa-boxes-stacked',
		  title: 'Material Information', subtitle: 'รายงานรับซื้อวัสดุ' },
		{ path: '/report-50-Districts', icon: 'fa-map-location-dot',
		  title: 'Report 50 Districts', subtitle: 'รายงานน้ำหนัก 50 เขต' },
		{ path: '/report-carbon-credit', icon: 'fa-leaf',
		  title: 'Carbon Credit', subtitle: 'ยอดคาร์บอนเครดิตตามสมาชิก' },
		{ path: '/report-customer-details-materials', icon: 'fa-users-rectangle',
		  title: 'Customer Details', subtitle: 'รับซื้อวัสดุ และ กลุ่มสมาชิก' },
	] },
	{ group: 'ปฏิบัติการ', items: [
		{ path: '/report-recurring-jobs', icon: 'fa-calendar-days',
		  title: 'Recurring Jobs', subtitle: 'งานประจำ และ ตารางเข้ารับ' },
	] },
	{ group: 'ผลงานทีม', items: [
		{ path: '/report-driver-performance', icon: 'fa-id-card-clip',
		  title: 'Driver Performance', subtitle: 'ผลงานและโปรไฟล์คนขับ' },
	] },
	{ group: 'วิเคราะห์ธุรกิจ', items: [
		{ path: '/report-month-summary', icon: 'fa-chart-line',
		  title: 'Month Summary', subtitle: 'ภาพรวมรายเดือน และ สรุปจาก AI' },
		{ path: '/report-member-insight', icon: 'fa-user-clock',
		  title: 'Member Insight', subtitle: 'ความถี่สมาชิก และ คนที่กำลังหาย' },
		{ path: '/report-station-compare', icon: 'fa-warehouse',
		  title: 'Station Compare', subtitle: 'เทียบผลงานแต่ละคลัง' },
	] },
	{ group: 'ข้อมูล', items: [
		{ path: '/report-data-quality', icon: 'fa-clipboard-check',
		  title: 'Data Quality', subtitle: 'หมวดสินค้าที่ต้องตัดสิน' },
	] },
	{ group: 'วิเคราะห์โซน', items: [
		{ path: '/report-zone-coverage', icon: 'fa-circle-nodes',
		  title: 'Zone Coverage', subtitle: 'โซนวิ่งรถ และ รัศมีรอบ Station' },
		{ path: '/report-zone-members', icon: 'fa-user-group',
		  title: 'Zone Members', subtitle: 'สมาชิกรายเขต และ Station ใกล้สุด' },
	] },
];

const NAV_INDEX = new Map(
	NAV.flatMap(section => section.items).map(item => [item.path.toLowerCase(), item]));

app.use((req, res, next) => {
	const current = NAV_INDEX.get(req.path.toLowerCase());
	res.locals.nav = NAV;
	res.locals.currentPath = req.path;
	res.locals.pageTitle = current ? current.title : 'Wastebuy Automate';
	res.locals.pageSubtitle = current ? current.subtitle : '';
	// ทุกหน้าใช้ตัวนี้เติม value ให้ <input type="date">
	res.locals.isoValue = toIsoDate;
	res.locals.assetVersion = ASSET_VERSION;
	res.locals.dataFreshness = null;
	// ไม่ต้องไปถาม API สำหรับ static / health — เอาเฉพาะหน้าที่ render จริง
	if (!NAV_INDEX.has(req.path.toLowerCase()) && req.path !== '/') return next();
	dataFreshness()
		.then(info => { res.locals.dataFreshness = info; })
		.catch(() => {})
		.finally(next);
});

// nginx ยิง /health มาเช็คได้ว่า node ตายหรือ DB ตาย โดยไม่ต้องรอหน้ารายงาน
app.get('/health', async (req, res) => {
	try {
		await axios.get(api + 'materials', { timeout: 5000 });
		res.json({ web: 'ok', api: api, upstream: 'ok' });
	} catch (err) {
		res.status(503).json({ web: 'ok', api: api, upstream: err.message });
	}
})


// ── หน้าแรก: สรุปจากทุกการวิเคราะห์ ─────────────────────────
// รวมทุกอย่างมาจาก /api-overview ครั้งเดียว ไม่ยิงหลาย endpoint
// หน้าแรกที่โหลดช้าคือหน้าที่คนเลิกใช้
app.get('/', async (req, res) => {
	const empty = {
		months: [], segments: [], atRisk: [], stations: [], stationCoverage: null,
		drivers: [], watch: [], materials: [], upcoming: [], aiSummary: null,
		current: null, delta: { baht: null, kg: null },
		risk: { members: 0, baht: 0 }, lost: { members: 0, pct: 0 },
		issues: { pending: 0, ai: 0, orphan: 0 },
		cacheAt: null, cacheStale: false, err: null,
	};

	try {
		const { data } = await axios.get(api + 'api-overview', { timeout: 60000 });

		const months = data.months || [];
		const current = months[0] || null;
		const prev = months[1] || null;

		// เทียบกับเดือนก่อนหน้าเท่านั้น ไม่ใช่ค่าเฉลี่ยทั้งชุด
		const pct = (now, before) => (before && Number(before) !== 0)
			? Math.round((Number(now) - Number(before)) / Number(before) * 100)
			: null;

		const segments = data.segments || [];
		const find = name => segments.find(x => x.segment === name);
		const risky = find('เสี่ยงหาย');
		const once = find('มาครั้งเดียวแล้วหาย');
		const totalMembers = segments.reduce((n, x) => n + Number(x.members), 0);

		const issues = (data.dataIssues || [])[0] || {};

		res.render('Overview.ejs', {
			...empty,
			months,
			current,
			delta: prev
				? { baht: pct(current.total_baht, prev.total_baht),
				    kg: pct(current.total_kg, prev.total_kg) }
				: { baht: null, kg: null },
			segments,
			atRisk: data.atRisk || [],
			stations: data.stations || [],
			stationCoverage: (data.stationCoverage || [])[0] || null,
			drivers: data.drivers || [],
			watch: data.driverWatch || [],
			materials: data.materials || [],
			upcoming: data.upcoming || [],
			aiSummary: (data.aiSummary || [])[0] || null,
			risk: risky
				? { members: Number(risky.members), baht: Number(risky.total_baht) }
				: { members: 0, baht: 0 },
			lost: once
				? { members: Number(once.members),
				    pct: totalMembers ? Math.round(Number(once.members) / totalMembers * 100) : 0 }
				: { members: 0, pct: 0 },
			issues: {
				pending: Number(issues.pending_items || 0),
				ai: Number(issues.ai_items || 0),
				orphan: Number(issues.orphan_categories || 0),
			},
			cacheAt: (data.cache || [])[0]
				? new Date(data.cache[0].refreshed_at).toLocaleString('th-TH')
				: null,
			cacheStale: Boolean(data.cacheStale),
		});
	} catch (err) {
		const hint = err.response && err.response.data ? err.response.data.hint : null;
		console.error('OVERVIEW:', err.message);
		// หน้าแรกพังไม่ควรทำให้เข้าเมนูอื่นไม่ได้ — ยังแสดงตัวเรียกรายงานตามเดิม
		res.render('Overview.ejs', {
			...empty,
			err: hint || 'ดึงภาพรวมไม่สำเร็จ — เปิดรายงานแต่ละหน้าจากเมนูด้านซ้ายได้ตามปกติ',
		});
	}
});


// หมวดที่ material-information.ejs มีบล็อกตารางรองรับจริง
// ต้องตรงกับลำดับบล็อกในไฟล์ view ถ้าเพิ่มบล็อกใหม่ต้องเพิ่มที่นี่ด้วย
const RENDERED_MATERIAL_CATEGORIES = [
	'กระดาษ', 'แก้ว', 'น้ำมัน', 'เบ็ตเตล็ด', 'พลาสติก', 'โลหะมีค่า', 'เหล็ก',
];

app.get('/material-information', async (req, res) => {
	const latest = await latestDataDate();
	const startDate = req.query.startDate || latest;
	const endDate = req.query.endDate || latest;


	try {
		const [mat_wg, mat_st, price] = await Promise.all([
			axios.get(api + 'get_weight_by_deli/search', { params: { startDate: startDate, endDate: endDate } }),
			axios.get(api + 'get_weight_by_station/search', { params: { startDate: startDate, endDate: endDate } }),
			axios.get(api + 'materials')
		]);

		const weightByDeli = mat_wg.data;
		const weightByStation = mat_st.data;
		const priceData = price.data;
		const combinedMaterials = {};
		weightByDeli.forEach(mat => {
			const key = mat.item_name;
			if (!combinedMaterials[key]) {
				combinedMaterials[key] = {
					item_name: mat.item_name,
					category: mat.category,
					kg_delivery: parseFloat(mat.kg_delivery) || 0,
					unit_delivery: parseFloat(mat.unit_delivery) || 0,
					kg_station: 0,
					unit_station: 0,
					// น้ำหนักแยกตามคลัง — เดิมรวมเป็นช่องเดียวชื่อ S11
					// ซึ่งเป็นชื่อคลังเก่า ไม่ใช่ประเภทของตัวเลข
					kg_by_station: {},
					price_delivery: 0,
					price_station: 0,
					price_factory: 0,
					quantity_delivery: parseFloat(mat.total_delivery) || 0,
					quantity_station: 0,
					categoryFrom: 'delivery'
				};
			} else {
				combinedMaterials[key].kg_delivery += parseFloat(mat.kg_delivery) || 0;
				combinedMaterials[key].unit_delivery += parseFloat(mat.unit_delivery) || 0;
				combinedMaterials[key].quantity_delivery = (parseFloat(combinedMaterials[key].quantity_delivery) + (parseFloat(mat.total_delivery) || 0))
			}
		});

		weightByStation.forEach(item => {
			const key = item.item_name;
			if (!combinedMaterials[key]) {
				combinedMaterials[key] = {
					item_name: item.item_name,
					category: item.item_category,
					kg_delivery: 0,
					unit_delivery: 0,
					kg_station: parseFloat(item.kg_station) || 0,
					unit_station: parseFloat(item.unit_station) || 0,
					kg_by_station: item.station
						? { [item.station]: parseFloat(item.kg_station) || 0 }
						: {},
					price_delivery: 0,
					price_station: 0,
					price_factory: 0,
					quantity_delivery: 0,
					quantity_station: parseFloat(item.total_station) || 0,
					// หลัง rename_columns.sql ฝั่ง station ส่งหมวดจริงมาแล้ว
					// แต่ยังต้องรู้ว่าแถวไหนมาจากไหน เพราะฝั่งนี้ไม่มียอด delivery
					categoryFrom: 'station'
				};
			} else {
				combinedMaterials[key].kg_station += parseFloat(item.kg_station) || 0;
				combinedMaterials[key].unit_station += parseFloat(item.unit_station) || 0;
				combinedMaterials[key].quantity_station = (parseFloat(combinedMaterials[key].quantity_station) + (parseFloat(item.total_station) || 0))
			}
			if (item.station) {
				const bucket = combinedMaterials[key].kg_by_station || (combinedMaterials[key].kg_by_station = {});
				bucket[item.station] = (bucket[item.station] || 0) + (parseFloat(item.kg_station) || 0);
			}
		});

		// จับคู่ราคาด้วยชื่อที่ normalize แล้ว ไม่ใช่ชื่อดิบ
		// materials สะกดต่างจากรายงาน ('PET ใส' vs 'PETใส') 39 ชื่อ / 157,332 กก.
		// จึงไม่มีราคา แล้ว Profit/Loss ติดลบเต็มยอดโดยไม่มีใครรู้
		priceData.forEach(price => {
			const key = price.name_mat;
			if (!combinedMaterials[key]) {
				combinedMaterials[key] = {
					item_name: price.name_mat,
					category: price.name_group,
					kg_delivery: 0,
					unit_delivery: 0,
					kg_station: 0,
					unit_station: 0,
					price_delivery: parseFloat(price.price_delivery) || 0,
					price_station: parseFloat(price.price_station) || 0,
					price_factory: parseFloat(price.price_factory) || 0,
					kg_by_station: {},
					quantity_delivery: 0,
					quantity_station: 0
				};
			} else {
				// ราคาเป็น "ราคาต่อหน่วย" ไม่ใช่ยอดสะสม — ต้องทับ ไม่ใช่บวก
				// materials มีสินค้าชื่อซ้ำ (เช่น ถุงรวมสะอาด 2 แถว) การบวกทำให้
				// ราคาบนหน้าจอเป็นสองเท่า
				combinedMaterials[key].price_delivery = parseFloat(price.price_delivery) || 0;
				combinedMaterials[key].price_station = parseFloat(price.price_station) || 0;
				combinedMaterials[key].price_factory = parseFloat(price.price_factory) || 0;

			}
		});

		// เก็บตกสินค้าที่ชื่อสะกดต่างจนจับคู่ตรงตัวไม่ได้
		const priceByNorm = new Map();
		priceData.forEach(price => {
			const k = normalizeMaterialName(price.name_mat);
			if (!priceByNorm.has(k)) priceByNorm.set(k, price);
		});
		Object.values(combinedMaterials).forEach(mat => {
			if (mat.price_delivery || mat.price_station || mat.price_factory) return;
			const hit = priceByNorm.get(normalizeMaterialName(mat.item_name));
			if (!hit) return;
			mat.price_delivery = parseFloat(hit.price_delivery) || 0;
			mat.price_station = parseFloat(hit.price_station) || 0;
			mat.price_factory = parseFloat(hit.price_factory) || 0;
		});
		const materials = Object.values(combinedMaterials);

		// หน้านี้เขียนบล็อกตารางแยกไว้ทีละหมวดแบบตายตัว 7 หมวด สินค้าที่อยู่
		// หมวดอื่นจึงไม่เคยขึ้นหน้าเลย และไม่มีอะไรบอกด้วย
		// (ในฐานมี 11 หมวด ที่เกินมา 4 หมวด = 7,876 แถว)
		// การรวมยอดกับ export Excel ผูกกับคลาสรายหมวด (.itemPaper / .kg_deli1..7)
		// การทำเป็นลูปจึงต้องแก้ทั้งสามส่วนพร้อมกัน — ดู docs/PLAN.md M2
		// ระหว่างนี้อย่างน้อยต้องบอกให้รู้ว่าอะไรตกหล่น
		// ต้องกรองด้วยเงื่อนไขเดียวกับที่ view ใช้ (quantity_delivery != 0)
		// ไม่งั้นจะนับสินค้าที่มีแต่ราคา ไม่มียอดในช่วงวันที่ ซึ่ง view ข้ามอยู่แล้ว
		// แล้วคำเตือนจะยาวเป็นร้อยรายการจนไม่มีใครอ่าน
		const shown = new Set(RENDERED_MATERIAL_CATEGORIES);
		const hiddenCategories = [...materials.reduce((acc, m) => {
			const active = Number(m.quantity_delivery) || Number(m.quantity_station);
			if (m.categoryFrom !== 'delivery') return acc;
			if (!m.category || !active || shown.has(m.category)) return acc;
			acc.set(m.category, (acc.get(m.category) || 0) + 1);
			return acc;
		}, new Map())].map(([category, items]) => ({ category, items }))
			.sort((a, b) => b.items - a.items);

		// รายชื่อคลังมาจากข้อมูลจริงของช่วงที่เลือก ไม่ได้ fix ไว้ในโค้ด
		// เปิดคลังใหม่แล้วคอลัมน์โผล่เอง ปิดคลังแล้วก็หายเอง
		const stationNames = [...new Set(
			materials.flatMap(m => Object.keys(m.kg_by_station || {}))
		)].sort();

		res.render('material-information.ejs', {
			counter: 1,
			materials: materials,
			stationNames,
			hiddenCategories,
			startDate: startDate,
			endDate: endDate
		});
	} catch (err) {
		console.error('Error fetching data from API:', err);
		res.status(500).send('Error fetching data from API:');
	}
});


app.get('/report-50-Districts', async (req, res) => {
	const latest = await latestDataDate();
	const startDate = req.query.startDate || latest;
	const endDate = req.query.endDate || latest;


	try {
		const ghg = await axios.get(api + 'get_carbon_cal/search', {
			params: {
				startDate: startDate,
				endDate: endDate
			}
		});


		const ghgcalc = ghg.data;
		const ghgTotal = {};
		let PubcustomerSum = {
			kg_delivery: 0,
			total_delivery: 0,
			ghg: 0
		};
		let Linesum = {
			kg_delivery: 0,
			total_delivery: 0,
			ghg: 0
		};

		// ทุกแถวต้องลงถังเดียวเท่านั้น และต้องมีถังรับเสมอ
		//
		// ของเดิมแยกเป็น 3 ลูปที่เงื่อนไขไม่ exclusive แถวเดียวจึงถูกบวกได้หลายที่
		// (เขต∩ทั่วไป 55,963 กก. · เขต∩LINE 27,638 กก.) ส่วนแถวที่ไม่เข้าเงื่อนไข
		// ไหนเลยก็หายจากรายงานทั้งใบ (1,480,563 กก. = 7.6% ของทั้งหมด)
		//
		// ลำดับ: มีเขต -> เข้าแถวเขต · ไม่มีเขตแต่ชื่อมี LINE -> แถว LINE
		//        ไม่มีเขต -> แถวลูกค้าทั่วไป/ไม่ทราบกลุ่ม
		ghgcalc.forEach(entry => {
			const kg = parseFloat(entry.kg_delivery) || 0;
			const baht = parseFloat(entry.total_delivery) || 0;
			const ghgValue = parseFloat(carbonCalc(entry, 'item_name', 'kg_delivery')) || 0;

			if (entry.amphures) {
				const key = entry.amphures;
				if (!ghgTotal[key]) {
					ghgTotal[key] = {
						purchase_date: entry.purchase_date,
						amphures: entry.amphures,
						provinces: entry.provinces || 0,
						kg_delivery: kg,
						ghg: ghgValue,
						total_delivery: baht
					};
				} else {
					ghgTotal[key].kg_delivery += kg;
					ghgTotal[key].ghg += ghgValue;
					ghgTotal[key].total_delivery += baht;
				}
			} else if (entry.location && entry.location.toUpperCase().includes('LINE')) {
				Linesum.kg_delivery += kg;
				Linesum.total_delivery += baht;
				Linesum.ghg += ghgValue;
			} else {
				// รวมทุกแถวที่เหลือ: ลูกค้าเดินเข้าร้าน กลุ่มที่ไม่มีในทะเบียน
				// และชื่อที่จับคู่สมาชิกไม่ได้ (10,867 แถว / 229,316 กก.)
				PubcustomerSum.kg_delivery += kg;
				PubcustomerSum.total_delivery += baht;
				PubcustomerSum.ghg += ghgValue;
			}
		});

		const easternDis = [
			"เขตคลองสามวา",
			"เขตคันนายาว",
			"เขตบางกะปิ",
			"เขตบึงกุ่ม",
			"เขตประเวศ",
			"เขตมีนบุรี",
			"เขตลาดกระบัง",
			"เขตสะพานสูง",
			"เขตหนองจอก"
		]
		const northDis = [
			"เขตจตุจักร",
			"เขตดอนเมือง",
			"เขตบางซื่อ",
			"เขตบางเขน",
			"เขตลาดพร้าว",
			"เขตสายไหม",
			"เขตหลักสี่"
		]

		const centralDis = [
			"เขตดินแดง",
			"เขตดุสิต",
			"เขตป้อมปราบศัตรูพ่าย",
			"เขตพญาไท",
			"เขตพระนคร",
			"เขตราชเทวี",
			"เขตวังทองหลาง",
			"เขตห้วยขวาง",
			"เขตสัมพันธวงศ์"
		]

		const southDis = [
			"เขตคลองเตย",
			"เขตบางคอแหลม",
			"เขตบางนา",
			"เขตบางรัก",
			"เขตปทุมวัน",
			"เขตพระโขนง",
			"เขตยานนาวา",
			"เขตวัฒนา",
			"เขตสวนหลวง",
			"เขตสาทร"
		]
		const northTon = [
			"เขตคลองสาน",
			"เขตจอมทอง",
			"เขตตลิ่งชัน",
			"เขตทวีวัฒนา",
			"เขตธนบุรี",
			"เขตบางกอกน้อย",
			"เขตบางกอกใหญ่",
			"เขตบางพลัด"
		]

		const southTon = [
			"เขตทุ่งครุ",
			"เขตบางขุนเทียน",
			"เขตบางบอน",
			"เขตบางแค",
			"เขตภาษีเจริญ",
			"เขตราษฎร์บูรณะ",
			"เขตหนองแขม"
		]

		const total = Object.values(ghgTotal);
		total.sort((a, b) => {
			const order = [
				...northDis,
				...centralDis,
				...southDis,
				...easternDis,
				...northTon,
				...southTon
			];
			const indexA = order.indexOf(a.amphures);
			const indexB = order.indexOf(b.amphures);

			if (indexA === -1) return 1;
			if (indexB === -1) return -1;

			return indexA - indexB;
		});
		res.render('Report-50-Districts.ejs', {
			count: 1,
			unknownMaterials: unknownMaterials(),
			total: total,
			startDate: startDate,
			endDate: endDate,
			easternDis: easternDis,
			northDis: northDis,
			centralDis: centralDis,
			southDis: southDis,
			northTon: northTon,
			southTon: southTon,
			PublicSum: PubcustomerSum,
			Linesum: Linesum
		});


	} catch (err) {
		console.error('Error fetching data from API:', err);
		res.status(500).send('Error fetching data from API: ' + err.message);
	}
});


// SENT TO SERVER
app.get('/api/carbon-credit', async (req, res) => {
	const latest = await latestDataDate();
	const startDate = req.query.startDate || latest;
	const endDate = req.query.endDate || latest;


	try {
		const result = await axios.get(api + 'get_carbon_cal/search',
			{
				params: {
					startDate: startDate,
					endDate: endDate
				}
			});
		const carbonCal = result.data
		const combined = {};
		carbonCal.forEach(cal => {
			const key = cal.location;
			const date = new Date(cal.purchase_date);

			if (!combined[key]) {
				combined[key] = {
					purchase_date: date.toLocaleDateString('th-TH', {
						day: "numeric",
						month: "short",
						year: "numeric"
					}),
					customer_group: cal.customer_group,
					location: cal.location,
					tambons: cal.tambons,
					amphures: cal.amphures,
					provinces: cal.provinces,
					kg_delivery: parseFloat(cal.kg_delivery) || 0,
					total_delivery: parseFloat(cal.total_delivery) || 0,
					ghg: carbonCalc(cal, 'item_name', 'kg_delivery') || 0,
				}
			} else {
				combined[key].kg_delivery += parseFloat(cal.kg_delivery) || 0;
				combined[key].total_delivery += parseFloat(cal.total_delivery) || 0;
				combined[key].ghg += carbonCalc(cal, 'item_name', 'kg_delivery') || 0;
			}
		});

		const totals = Object.values(combined);
		res.send(JSON.stringify({
			totals: totals,
			startDate: startDate,
			endDate: endDate
		}));
	} catch (err) {
		console.error('Error fetching data from API:', err);
		res.status(500).send('Error fetching data from API: ' + err.message);
	};

});


// SENT TO SERVER
app.get('/api/carbon-credit-material', async (req, res) => {
	const latest = await latestDataDate();
	const startDate = req.query.startDate || latest;
	const endDate = req.query.endDate || latest;

	try {
		const result = await axios.get(api + 'get_carbon_cal/search', {
			params: {
				startDate: startDate,
				endDate: endDate
			}
		});

		const carbonCal = result.data;
		const combined = {};
		carbonCal.forEach(cal => {
			const key = `${cal.location}_${cal.purchase_number}`;
			const date = new Date(cal.purchase_date);

			if (!combined[key]) {
				combined[key] = {
					purchase_date: date.toLocaleDateString('th-TH', {
						day: "numeric",
						month: "short",
						year: "numeric"
					}),
					purchase_number: cal.purchase_number,
					customer_group: cal.customer_group,
					location: cal.location,
					category: cal.category,
					item_name: cal.item_name,
					amphures: cal.amphures,
					provinces: cal.provinces,
					kg_delivery: parseFloat(cal.kg_delivery) || 0,
					total_delivery: parseFloat(cal.total_delivery) || 0,
					ghg: parseFloat(carbonCalc(cal, 'item_name', 'kg_delivery')) || 0,
				};
			} else {
				combined[key].kg_delivery += parseFloat(cal.kg_delivery) || 0;
				combined[key].total_delivery += parseFloat(cal.total_delivery) || 0;
				combined[key].ghg += parseFloat(carbonCalc(cal, 'item_name', 'kg_delivery')) || 0;
			}
		});

		const totals = Object.values(combined);

		// สรุปแยกรายวัสดุ ต้องใช้ accumulator ของตัวเอง
		// เดิมเขียนทับลงใน combined ตัวเดิม mattotals จึงได้ทั้งชุดที่ key ด้วย location
		// และชุดที่ key ด้วย customer_group+item_name ปนกัน = นับซ้ำสองเท่า
		// (kg รวม 208,137 ทั้งที่ของจริง 104,068)
		const combinedMaterial = {};
		carbonCal.forEach(cal => {
			const key = `${cal.customer_group}_${cal.item_name}_${cal.purchase_number}`;
			const date = new Date(cal.purchase_date);

			if (!combinedMaterial[key]) {
				combinedMaterial[key] = {
					purchase_date: date.toLocaleDateString('th-TH', {
						day: "numeric",
						month: "short",
						year: "numeric"
					}),
					purchase_number: cal.purchase_number,
					customer_group: cal.customer_group,
					location: cal.location,
					item_name: cal.item_name,
					amphures: cal.amphures,
					provinces: cal.provinces,
					kg_delivery: parseFloat(cal.kg_delivery) || 0,
					total_delivery: parseFloat(cal.total_delivery) || 0,
					ghg: parseFloat(carbonCalc(cal, 'item_name', 'kg_delivery')) || 0,
				};
			} else {
				combinedMaterial[key].kg_delivery += parseFloat(cal.kg_delivery) || 0;
				combinedMaterial[key].total_delivery += parseFloat(cal.total_delivery) || 0;
				combinedMaterial[key].ghg += parseFloat(carbonCalc(cal, 'item_name', 'kg_delivery')) || 0;
			}
		});
		const mattotals = Object.values(combinedMaterial);
		res.json({
			mattotals: mattotals,
			totals: totals,
			startDate: startDate,
			endDate: endDate
		});
	} catch (err) {
		console.error('Error fetching data from API:', err);
		res.status(500).send('Error fetching data from API: ' + err.message);
	}
});


// CLIENT TO INTERFACE
app.get('/report-carbon-credit', async (req, res) => {
	const latest = await latestDataDate();
	const startDate = req.query.startDate || latest;
	const endDate = req.query.endDate || latest;
	const limit = readLimit(req.query.limit, 10000);
	const page = readPage(req.query.page);
	const amphures = req.query.amphures || [];
	try {
		const result = await axios.get(api + 'api-carbon-cal', {
			params: {
				startDate: startDate,
				endDate: endDate,
				limit: limit,
				page: page,
				amphures: amphures
			}
		});


		const pageData = result.data.data;
		const totalindex = result.data.totalrecord
		const totalpage = Math.ceil(totalindex / limit)
		res.render('Report-Carbon-Credit.ejs', {
			count: (page - 1) * limit + 1,
			unknownMaterials: unknownMaterials(),
			totals: pageData,
			startDate: startDate,
			endDate: endDate,
			limit: limit,
			currentPage: page,
			totalPage: totalpage,
			amphures: amphures
		});
	} catch (err) {
		console.error('Error fetching data from API:', err);
		res.status(500).send('Error fetching data from API: ' + err.message);
	}

});

app.get('/report-customer-details-materials', async (req, res) => {
	// หน้านี้เดิมต้องเลือกวันเองก่อนถึงจะแสดงอะไร เปิดมาครั้งแรกเลยว่างเปล่า
	// ตั้งเป็นวันล่าสุดที่มีข้อมูลให้เลย จะได้เห็นตัวอย่างทันที
	const latest = await latestDataDate();
	const startDate = req.query.startDate || latest;
	const endDate = req.query.endDate || latest;
	const limit = readLimit(req.query.limit, 5000);
	const page = readPage(req.query.page);
	const customerGroup = req.query.customer_group || [];

	// รายการกลุ่มต้องมาจาก DB — หน้าเดิม hardcode ไว้ 29 กลุ่ม ทั้งที่มี 167 กลุ่ม
	// และ 7 ในนั้นถูกเปลี่ยนชื่อไปแล้ว ติ๊กแล้วได้ 0 แถวโดยไม่มีอะไรบอก
	let customerGroups = [];
	try {
		customerGroups = (await axios.get(api + 'customer-groups', { timeout: 15000 })).data;
	} catch (err) {
		console.error('CUSTOMER GROUPS:', err.message);
	}

	const emptyRender = {
		count: 1, count_sub: 1,
		modalMaterial: [], matDetailGroup: [], groupMat: [],
		totalGroup: [], totals: [], materialCal: [], matDetail: [],
		startDate: startDate || '', endDate: endDate,
		limit, currentPage: page, totalPage: 0, customer_group: customerGroup,
		customerGroups
	};

	if (!startDate) {
		return res.render('Report-Customer-Details-materials.ejs', emptyRender);
	}

	try {
		const [result, material] = await Promise.all([
			axios.get(api + 'get_carbon_cal/search', { params: { startDate: startDate, endDate: endDate, customer_group: customerGroup } }),
			axios.get(api + 'api-carbon-cal-material', { params: { startDate: startDate, endDate: endDate, limit: limit, page: page, customer_group: customerGroup } })
		]);

		const carbonCal = result.data;
		const materialCal = material.data.data;


		// CUSTOMER DATA
		const combined = {};
		carbonCal.forEach(cal => {
			const key = `${cal.customer_group}`;
			const date = new Date(cal.purchase_date);
			if (!combined[key]) {
				combined[key] = {
					purchase_date: date.toLocaleDateString('th-TH', {
						day: "numeric",
						month: "short",
						year: "numeric"
					}),
					purchase_number: cal.purchase_number,
					customer_group: cal.customer_group,
					location: cal.location,
					amphures: cal.amphures,
					provinces: cal.provinces,
					kg_delivery: parseFloat(cal.kg_delivery) || 0,
					total_delivery: parseFloat(cal.total_delivery) || 0,
					ghg: parseFloat(carbonCalc(cal, 'item_name', 'kg_delivery')) || 0,
				};
			} else {
				combined[key].kg_delivery += parseFloat(cal.kg_delivery) || 0;
				combined[key].total_delivery += parseFloat(cal.total_delivery) || 0;
				combined[key].ghg += parseFloat(carbonCalc(cal, 'item_name', 'kg_delivery')) || 0;
			}
		});
		const totals = Object.values(combined);

		// SENT TO MODAL MATERIALS AND 4 CHART
		const combinedModal = {};
		carbonCal.forEach(cal => {
			const key = `${cal.customer_group} ${cal.location}`;
			const date = new Date(cal.purchase_date);
			const paper = cal.category === 'กระดาษ' ? parseFloat(cal.kg_delivery) || 0 : 0;
			const glass = cal.category === 'แก้ว' ? parseFloat(cal.kg_delivery) || 0 : 0;
			const plastic = cal.category === 'พลาสติก' ? parseFloat(cal.kg_delivery) || 0 : 0;
			const metal1 = cal.category === 'เหล็ก' ? parseFloat(cal.kg_delivery) || 0 : 0;
			const metal2 = cal.category === 'โลหะมีค่า' ? parseFloat(cal.kg_delivery) || 0 : 0;
			const oil = cal.category === 'น้ำมัน' ? parseFloat(cal.kg_delivery) || 0 : 0;
			const other = cal.category === 'เบ็ตเตล็ด' ? parseFloat(cal.kg_delivery) || 0 : 0;

			if (!combinedModal[key]) {
				combinedModal[key] = {
					purchase_date: date.toLocaleDateString('th-TH', {
						day: "numeric",
						month: "short",
						year: "numeric"
					}),
					purchase_number: cal.purchase_number,
					customer_group: cal.customer_group,
					location: cal.location,
					paper: paper,
					glass: glass,
					plastic: plastic,
					metal1: metal1,
					metal2: metal2,
					oil: oil,
					other: other,
					amphures: cal.amphures,
					provinces: cal.provinces,
					kg_delivery: parseFloat(cal.kg_delivery) || 0,
					total_delivery: parseFloat(cal.total_delivery) || 0,
					ghg: parseFloat(carbonCalc(cal, 'item_name', 'kg_delivery')) || 0,
				};
			} else {
				combinedModal[key].kg_delivery += parseFloat(cal.kg_delivery) || 0;
				combinedModal[key].total_delivery += parseFloat(cal.total_delivery) || 0;
				combinedModal[key].ghg += parseFloat(carbonCalc(cal, 'item_name', 'kg_delivery')) || 0;
				combinedModal[key].paper += paper;
				combinedModal[key].glass += glass;
				combinedModal[key].metal1 += metal1;
				combinedModal[key].metal2 += metal2;
				combinedModal[key].plastic += plastic;
				combinedModal[key].oil += oil;
				combinedModal[key].other += other;
			}
		});

		const modalMaterial = Object.values(combinedModal);

		// GROUP CUSTOMERS DATA
		const combinedGroup = {};
		carbonCal.forEach(cal => {
			const key = `${cal.location}_${cal.customer_group}`;
			const date = new Date(cal.purchase_date);
			if (!combinedGroup[key]) {
				combinedGroup[key] = {
					purchase_date: date.toLocaleDateString('th-TH', {
						day: "numeric",
						month: "short",
						year: "numeric"
					}),
					location: cal.location,
					customer_group: cal.customer_group,
					category: cal.category,
					item_name: cal.item_name,
					kg_delivery: parseFloat(cal.kg_delivery) || 0,
					total_delivery: parseFloat(cal.total_delivery) || 0,
					ghg: parseFloat(carbonCalc(cal, 'item_name', 'kg_delivery')) || 0
				}
			} else {
				combinedGroup[key].kg_delivery += parseFloat(cal.kg_delivery) || 0;
				combinedGroup[key].total_delivery += parseFloat(cal.total_delivery) || 0;
				combinedGroup[key].ghg += parseFloat(carbonCalc(cal, 'item_name', 'kg_delivery')) || 0;
			}
		});

		const totalGroup = Object.values(combinedGroup);

		// GROUP MATERIALS
		const combinedGroupMat = {};
		carbonCal.forEach(cal => {
			const key = `${cal.category}_${cal.customer_group}`;
			const date = new Date(cal.purchase_date);
			if (!combinedGroupMat[key]) {
				combinedGroupMat[key] = {
					purchase_date: date.toLocaleDateString('th-TH', {
						day: "numeric",
						month: "short",
						year: "numeric"
					}),
					location: cal.location,
					customer_group: cal.customer_group,
					category: cal.category,
					item_name: cal.item_name,
					kg_delivery: parseFloat(cal.kg_delivery) || 0,
					total_delivery: parseFloat(cal.total_delivery) || 0,
					ghg: parseFloat(carbonCalc(cal, 'item_name', 'kg_delivery')) || 0
				}
			} else {
				combinedGroupMat[key].kg_delivery += parseFloat(cal.kg_delivery) || 0;
				combinedGroupMat[key].total_delivery += parseFloat(cal.total_delivery) || 0;
				combinedGroupMat[key].ghg += parseFloat(carbonCalc(cal, 'item_name', 'kg_delivery')) || 0;
			}
		});

		const groupMat = Object.values(combinedGroupMat);

		// Group Customer Detail
		const combinedDetail = {};
		carbonCal.forEach(cal => {
			const key = `${cal.category}`;
			const date = new Date(cal.purchase_date);
			if (!combinedDetail[key]) {
				combinedDetail[key] = {
					purchase_date: date.toLocaleDateString('th-TH', {
						day: "numeric",
						month: "short",
						year: "numeric"
					}),
					location: cal.location,
					customer_group: cal.customer_group,
					category: cal.category,
					item_name: cal.item_name,
					kg_delivery: parseFloat(cal.kg_delivery) || 0,
					total_delivery: parseFloat(cal.total_delivery) || 0,
					ghg: parseFloat(carbonCalc(cal, 'item_name', 'kg_delivery')) || 0
				}
			} else {
				combinedDetail[key].kg_delivery += parseFloat(cal.kg_delivery) || 0;
				combinedDetail[key].total_delivery += parseFloat(cal.total_delivery) || 0;
				combinedDetail[key].ghg += parseFloat(carbonCalc(cal, 'item_name', 'kg_delivery')) || 0;
			}
		});

		const matDetailGroup = Object.values(combinedDetail);

		// ชุดนี้ถูก JSON.stringify ลงหน้าเว็บทั้งก้อน ฝั่ง client ใช้แค่ 6 field
		// (สรุปรายเดือน 3 กราฟ + ค้นด้วย purchase_number ตอนกดเปิดรายละเอียด)
		// ส่งทุก field ทำให้หน้าโตถึง 10 MB โดยที่ location/customer_group/
		// amphures/provinces ไม่เคยถูกอ่านเลย
		const matDetail = material.data.matdata.map(row => ({
			purchase_date: row.purchase_date,
			purchase_number: row.purchase_number,
			item_name: row.item_name,
			kg_delivery: row.kg_delivery,
			total_delivery: row.total_delivery,
			ghg: row.ghg
		}));
		const totalindex = material.data.totalrecord
		const totalpage = Math.ceil(totalindex / limit)


		res.render('Report-Customer-Details-materials.ejs', {
			count: 1,
			count_sub: (page - 1) * limit + 1,
			modalMaterial: modalMaterial,
			matDetailGroup: matDetailGroup,
			groupMat: groupMat,
			totalGroup: totalGroup,
			totals: totals,
			materialCal: materialCal,
			matDetail: matDetail,
			startDate: startDate,
			endDate: endDate,
			limit: limit,
			currentPage: page,
			totalPage: totalpage,
			customer_group: customerGroup,
			customerGroups
		});
	} catch (err) {
		console.error('Error fetching data from API:', err);
		res.status(500).send('Error fetching data from API: ' + err.message);
	};

});

//##############################  EXPORT FUATHER #####################################
// PDF
app.get('/report-zone-coverage', async (req, res) => {
	const startDate = FormatDate(req.query.startDate);
	const endDate = FormatDate(req.query.endDate);
	const filters = {
		station: req.query.station || '',
		ring: req.query.ring || '',
		sort: req.query.sort || 'bookings',
	};

	const empty = {
		stations: [], districts: [], allDistricts: [], vehiclesByStation: [],
		subdistricts: [], subdistrictsByDistrict: {},
		rings: [], stationNames: [], ringNames: [], dropped: null,
		startDate, endDate, filters, err: null,
	};

	try {
		const { data } = await axios.get(api + 'api-zone-coverage', {
			params: { startDate: startDate || undefined, endDate: endDate || undefined },
			timeout: 120000,
		});

		// รวมยอดต่อวงแหวนไว้ที่นี่ครั้งเดียว — view จะได้ไม่ต้องวนซ้ำเพื่อหายอดรวม
		const byRing = new Map();
		data.districts.forEach(d => {
			const row = byRing.get(d.ring) || {
				ring: d.ring, ring_order: d.ring_order,
				districts: 0, bookings: 0, done: 0, cancelled: 0,
			};
			row.districts += 1;
			row.bookings += Number(d.bookings);
			row.done += Number(d.done);
			row.cancelled += Number(d.cancelled);
			byRing.set(d.ring, row);
		});

		// ตัวเลือกในแถบกรองต้องมาจากชุดเต็มเสมอ ไม่ใช่ชุดที่กรองแล้ว
		// ไม่งั้นเลือก station หนึ่งแล้วเปลี่ยนไป station อื่นไม่ได้
		const stationNames = [...new Set(data.districts
			.map(d => d.nearest_station).filter(Boolean))].sort();
		const ringNames = [...new Map(data.districts
			.filter(d => d.ring).map(d => [d.ring, d.ring_order])).entries()]
			.sort((a, b) => a[1] - b[1]).map(([ring]) => ring);

		// เขตที่มีใบจองไม่กี่ใบทำให้ % แกว่งจนไร้ความหมาย (ยกเลิก 1 จาก 1 = 100%)
		// จึงดันกลุ่มนั้นไปท้ายรายการแทนที่จะให้ขึ้นมาบังเขตที่มีปริมาณจริง
		const MIN_FOR_RATE = 10;
		const rate = d => Number(d.cancelled) / Math.max(Number(d.bookings), 1);

		const SORTERS = {
			bookings: (a, b) => Number(b.bookings) - Number(a.bookings),
			cancelled: (a, b) => Number(b.cancelled) - Number(a.cancelled),
			cancel_rate: (a, b) => {
				const enough = d => (Number(d.bookings) >= MIN_FOR_RATE ? 1 : 0);
				return enough(b) - enough(a)
					|| rate(b) - rate(a)
					|| Number(b.bookings) - Number(a.bookings);
			},
			km: (a, b) => Number(a.km) - Number(b.km),
		};

		const cards = data.districts
			.filter(d => !filters.station || d.nearest_station === filters.station)
			.filter(d => !filters.ring || d.ring === filters.ring)
			.sort(SORTERS[filters.sort] || SORTERS.bookings);

		// แขวงต่อเขต ให้การ์ดกางดูได้ครบ ไม่ต้องถูกตัดเหมือนใน popup ของแผนที่
		const subdistrictsByDistrict = {};
		(data.subdistricts || []).forEach(row => {
			(subdistrictsByDistrict[row.district] ||= []).push(row);
		});

		res.render('Report-Zone-Coverage.ejs', {
			...empty,
			stations: data.stations,
			districts: cards,
			allDistricts: data.districts,
			vehiclesByStation: data.vehiclesByStation,
			subdistricts: data.subdistricts || [],
			subdistrictsByDistrict,
			stationNames,
			ringNames,
			rings: [...byRing.values()].sort((a, b) => a.ring_order - b.ring_order),
			dropped: data.dropped || null,
		});
	} catch (err) {
		// 503 = ยังไม่ได้โหลดตารางโซน ให้ขึ้นข้อความบอกวิธีแทนหน้า error เปล่า
		const hint = err.response?.data?.hint;
		console.error('ZONE COVERAGE:', err.message);
		res.render('Report-Zone-Coverage.ejs', {
			...empty,
			err: hint ? `${err.response.data.error} — ${hint}` : 'ดึงข้อมูลโซนไม่สำเร็จ',
		});
	}
});

app.get('/report-zone-members', async (req, res) => {
	const filters = {
		district: req.query.district || '',
		channel: req.query.channel || '',
		segment: req.query.segment || '',
		group: req.query.group || '',
		station: req.query.station || '',
		ring: req.query.ring || '',
		active: req.query.active === '1' ? '1' : '',
	};

	const empty = {
		summary: [], members: [], memberLimit: 0, segments: [],
		districts: [], groups: [], stations: [], rings: [],
		totals: { members: 0, active: 0, bookings: 0, purchases: 0, baht: 0 },
		filters, err: null,
	};

	try {
		// query ตัวนี้หนัก ต้องตั้ง timeout เอง ไม่งั้น axios รอไม่จำกัดแล้วได้
		// 'socket hang up' แทนข้อความที่บอกอะไรได้
		const { data } = await axios.get(api + 'api-zone-members',
			{ params: filters, timeout: 120000 });

		// รวมยอดและ facet ที่นี่ครั้งเดียว view จะได้ไม่ต้องวนซ้ำ
		const totals = data.summary.reduce((acc, r) => ({
			members: acc.members + Number(r.members),
			active: acc.active + Number(r.active_members),
			bookings: acc.bookings + Number(r.bookings),
			purchases: acc.purchases + Number(r.purchases),
			baht: acc.baht + Number(r.total_baht),
		}), { members: 0, active: 0, bookings: 0, purchases: 0, baht: 0 });

		const stations = [...new Set(data.facets.districts
			.map(d => d.nearest_station).filter(Boolean))].sort();
		const rings = [...new Map(data.facets.districts
			.filter(d => d.ring)
			.map(d => [d.ring, d.ring_order])).entries()]
			.sort((a, b) => a[1] - b[1]).map(([ring]) => ring);
		const districts = [...new Map(data.facets.districts
			.map(d => [d.district, d.district_label])).entries()]
			.map(([value, label]) => ({ value, label }));

		// เรียงให้ LINE / สมาชิก / ทั่วไป อยู่ลำดับเดิมเสมอ ไม่ใช่ตามจำนวน
		// การ์ดจะได้ไม่สลับที่ทุกครั้งที่เปลี่ยนตัวกรอง
		const SEGMENT_ORDER = ['สมาชิก', 'LINE', 'ทั่วไป'];
		const segments = SEGMENT_ORDER
			.map(name => data.segmentTotals?.[name])
			.filter(Boolean);

		res.render('Report-Zone-Members.ejs', {
			...empty,
			summary: data.summary,
			members: data.members,
			segments,
			memberLimit: data.memberLimit,
			districts,
			groups: data.facets.groups,
			stations,
			rings,
			totals,
		});
	} catch (err) {
		const hint = err.response?.data?.hint;
		console.error('ZONE MEMBERS:', err.message);
		res.render('Report-Zone-Members.ejs', {
			...empty,
			err: hint ? `${err.response.data.error} — ${hint}` : 'ดึงข้อมูลสมาชิกรายเขตไม่สำเร็จ',
		});
	}
});


// สถิติคนขับคำนวณจาก weight_query ทั้งชุด ใช้เวลาราว 15 วินาที
// ข้อมูลเปลี่ยนเดือนละครั้ง ไม่มีเหตุให้คำนวณใหม่ทุกครั้งที่เปิดหน้า
let driverCache = { data: null, fetchedAt: 0 };
const DRIVER_CACHE_TTL_MS = 10 * 60 * 1000;

async function loadDrivers() {
	const now = Date.now();
	if (driverCache.data && now - driverCache.fetchedAt < DRIVER_CACHE_TTL_MS) {
		return driverCache;
	}
	const { data } = await axios.get(api + 'api-drivers', { timeout: 180000 });
	driverCache = { data, fetchedAt: now };
	return driverCache;
}

// ── B1: สมาชิก · ความถี่และการหายไป ─────────────────────────
app.get('/report-member-insight', async (req, res) => {
	const filters = {
		segment: req.query.segment || '',
		q: req.query.q || '',
		sort: req.query.sort || '',
	};
	const empty = { filters, summary: [], members: [], segments: [], dataDate: null, err: null };

	try {
		const { data } = await axios.get(api + 'api-member-rfm', {
			params: { ...filters, limit: 300 },
			timeout: 60000,
		});

		res.render('Report-Member-Insight.ejs', {
			...empty,
			summary: data.summary,
			members: data.members,
			// ตัวเลือกในช่องกรองมาจากชุดเต็มเสมอ ไม่ใช่จากที่กรองอยู่
			// ไม่งั้นเลือกกลุ่มหนึ่งแล้วเปลี่ยนกลับไม่ได้
			segments: data.summary.map(s => s.segment),
			dataDate: data.dataDate,
		});
	} catch (err) {
		const hint = err.response && err.response.data ? err.response.data.hint : null;
		console.error('MEMBER INSIGHT:', err.message);
		res.render('Report-Member-Insight.ejs', {
			...empty,
			err: hint || 'ดึงข้อมูลสมาชิกไม่สำเร็จ',
		});
	}
});

// ── B4: เทียบผลงานคลัง ──────────────────────────────────────
app.get('/report-station-compare', async (req, res) => {
	const empty = {
		stations: [], materials: [], monthly: [], coverage: null,
		totals: { kg: 0, baht: 0, bills: 0 }, err: null,
	};

	try {
		const { data } = await axios.get(api + 'api-station-performance', { timeout: 60000 });

		const totals = data.stations.reduce((acc, s) => ({
			kg: acc.kg + Number(s.total_kg || 0),
			baht: acc.baht + Number(s.total_baht || 0),
			bills: acc.bills + Number(s.bills || 0),
		}), { kg: 0, baht: 0, bills: 0 });

		res.render('Report-Station-Compare.ejs', { ...empty, ...data, totals });
	} catch (err) {
		const hint = err.response && err.response.data ? err.response.data.hint : null;
		console.error('STATION COMPARE:', err.message);
		res.render('Report-Station-Compare.ejs', {
			...empty,
			err: hint || 'ดึงผลงานคลังไม่สำเร็จ',
		});
	}
});

// ── A1 + C2: หมวดสินค้าที่ต้องตัดสิน ────────────────────────
app.get('/report-data-quality', async (req, res) => {
	const empty = {
		items: [], groups: [], orphanCategories: [],
		counts: { pending: 0, ai: 0, auto: 0, manual: 0 },
		ai: { ready: false, hint: '' }, err: null,
	};

	try {
		const { data } = await axios.get(api + 'api-item-categories', { timeout: 60000 });

		const counts = data.items.reduce((acc, it) => {
			if (!it.category) acc.pending++;
			else if (it.source === 'ai') acc.ai++;
			else if (it.source === 'manual') acc.manual++;
			else acc.auto++;
			return acc;
		}, { pending: 0, ai: 0, auto: 0, manual: 0 });

		res.render('Report-Data-Quality.ejs', { ...empty, ...data, counts });
	} catch (err) {
		const hint = err.response && err.response.data ? err.response.data.hint : null;
		console.error('DATA QUALITY:', err.message);
		res.render('Report-Data-Quality.ejs', {
			...empty,
			err: hint || 'ดึงรายการหมวดสินค้าไม่สำเร็จ',
		});
	}
});

// ── C4: สรุปภาพรวมรายเดือน ──────────────────────────────────
app.get('/report-month-summary', async (req, res) => {
	const filters = { month: req.query.month || '' };
	const empty = {
		filters, facts: [], monthOptions: [], current: null, summary: null,
		delta: { baht: null, kg: null }, ai: { ready: false, hint: '' }, err: null,
	};

	try {
		// ดึงชุดเต็มก่อนเพื่อทำตัวเลือกเดือน แล้วค่อยดึงคำสรุปของเดือนที่เลือก
		const all = await axios.get(api + 'api-month-summary', { timeout: 60000 });
		const facts = all.data.facts;
		if (!facts.length) {
			return res.render('Report-Month-Summary.ejs', { ...empty, ai: all.data.ai });
		}

		const monthOptions = facts.map(f => f.month.slice(0, 7));
		const targetMonth = filters.month || monthOptions[0];

		const detail = await axios.get(api + 'api-month-summary', {
			params: { month: targetMonth },
			timeout: 60000,
		});

		const current = facts.find(f => f.month.slice(0, 7) === targetMonth) || facts[0];
		const idx = facts.indexOf(current);
		const prev = idx >= 0 && idx + 1 < facts.length ? facts[idx + 1] : null;

		// เทียบกับเดือนก่อนหน้าเสมอ ไม่ใช่เดือนแรกของชุด
		const pct = (now, before) => (before && Number(before) !== 0)
			? Math.round((Number(now) - Number(before)) / Number(before) * 100)
			: null;

		res.render('Report-Month-Summary.ejs', {
			...empty,
			filters: { month: targetMonth },
			facts,
			monthOptions,
			current,
			summary: detail.data.summary,
			delta: prev
				? { baht: pct(current.total_baht, prev.total_baht),
				    kg: pct(current.total_kg, prev.total_kg) }
				: { baht: null, kg: null },
			ai: all.data.ai,
		});
	} catch (err) {
		const hint = err.response && err.response.data ? err.response.data.hint : null;
		console.error('MONTH SUMMARY PAGE:', err.message);
		res.render('Report-Month-Summary.ejs', {
			...empty,
			err: hint || 'ดึงตัวเลขรายเดือนไม่สำเร็จ',
		});
	}
});

app.get('/report-driver-performance', async (req, res) => {
	const filters = {
		station: req.query.station || '',
		sort: req.query.sort || 'bills',
		minDays: req.query.minDays || '10',
		// ช่อง "พนักงานขับ" มีชื่อจุดรับเข้า (ปตท./MAKRO/LOTUS) ปนอยู่ด้วย
		// ค่าเริ่มต้นจึงแสดงเฉพาะคนขับรถ ไม่งั้นเอาปั๊มไปเทียบกับคน
		kind: req.query.kind === undefined ? 'คนขับรถ' : req.query.kind,
	};

	const empty = {
		drivers: [], monthly: {}, stations: [], kinds: [], kindCounts: {}, filters,
		totals: { drivers: 0, bills: 0, kg: 0, baht: 0, assigned: 0, done: 0, cancelled: 0 },
		company: { deductPct: null, medianBillsPerDay: null },
		computedAt: null, err: null,
	};

	try {
		const { data, fetchedAt } = await loadDrivers();

		const minDays = Number(filters.minDays) || 0;
		const stations = [...new Set(data.drivers
			.flatMap(d => (d.stations || '').split(',').map(x => x.trim()))
			.filter(Boolean))].sort();

		const SORTERS = {
			bills: (a, b) => Number(b.bills) - Number(a.bills),
			kg: (a, b) => Number(b.total_kg) - Number(a.total_kg),
			baht: (a, b) => Number(b.total_baht) - Number(a.total_baht),
			productivity: (a, b) => Number(b.bills_per_day) - Number(a.bills_per_day),
			// ไม่มีใบจอง = ไม่มี % ให้เทียบ ต้องไปท้ายรายการ ไม่ใช่บนสุด
			success: (a, b) => (b.success_pct ?? -1) - (a.success_pct ?? -1),
			cancel: (a, b) => (b.cancel_pct ?? -1) - (a.cancel_pct ?? -1),
			deduct: (a, b) => Number(b.deduct_pct || 0) - Number(a.deduct_pct || 0),
			drift: (a, b) => Number(b.price_drift_pct || 0) - Number(a.price_drift_pct || 0),
		};

		// นับจำนวนต่อประเภทจากชุดเต็มเสมอ ตัวเลือกจะได้ไม่หายไปเมื่อกรองแล้วเหลือ 0
		const kindCounts = {};
		data.drivers.forEach(d => {
			kindCounts[d.kind] = (kindCounts[d.kind] || 0) + 1;
		});
		const kinds = Object.keys(kindCounts).sort();

		const drivers = data.drivers
			.filter(d => !filters.kind || d.kind === filters.kind)
			.filter(d => Number(d.work_days) >= minDays)
			.filter(d => !filters.station || (d.stations || '').includes(filters.station))
			.sort(SORTERS[filters.sort] || SORTERS.bills);

		const totals = drivers.reduce((acc, d) => ({
			drivers: acc.drivers + 1,
			bills: acc.bills + Number(d.bills),
			kg: acc.kg + Number(d.total_kg),
			baht: acc.baht + Number(d.total_baht),
			assigned: acc.assigned + Number(d.booking_assigned),
			done: acc.done + Number(d.booking_done),
			cancelled: acc.cancelled + Number(d.booking_cancelled),
		}), { drivers: 0, bills: 0, kg: 0, baht: 0, assigned: 0, done: 0, cancelled: 0 });

		// รายเดือนส่งไปเฉพาะคนที่อยู่ในตาราง ไม่ต้องยัดทั้ง 144 คนลงหน้า
		const wanted = new Set(drivers.map(d => d.driver));
		const monthly = {};
		data.monthly.forEach(row => {
			if (wanted.has(row.driver)) (monthly[row.driver] ||= []).push(row);
		});

		res.render('Report-Driver-Performance.ejs', {
			...empty,
			drivers,
			monthly,
			stations,
			kinds,
			kindCounts,
			totals,
			company: {
				deductPct: data.drivers[0]?.company_deduct_pct ?? null,
				medianBillsPerDay: null,
			},
			computedAt: new Date(fetchedAt).toLocaleString('th-TH'),
		});
	} catch (err) {
		const hint = err.response?.data?.hint;
		console.error('DRIVERS:', err.message);
		res.render('Report-Driver-Performance.ejs', {
			...empty,
			err: hint ? `${err.response.data.error} — ${hint}` : 'ดึงผลงานคนขับไม่สำเร็จ',
		});
	}
});



// ── proxy ไป server.js สำหรับหน้าที่ต้องเขียนข้อมูล ──────────────
// เบราว์เซอร์เปิดหน้าเว็บที่ :3000 แต่ API อยู่ :4000 คนละ origin ยิงตรงไม่ได้
// (จะติด CORS) จึงให้ app.js เป็นตัวส่งต่อ — ทางเดียวกับที่หน้าอื่นทำอยู่แล้ว
// เปิดเฉพาะ path ที่ตั้งใจ ไม่ใช่ proxy ทุกอย่างไปที่ API
const RECURRING_ROUTES = {
	'jobs': 'api-recurring-jobs',
	'schedule': 'api-recurring-schedule',
	'holidays': 'api-holidays',
	'members': 'customers-search',
	'suggest': 'api-recurring-suggest',
	'holidaysync': 'api-holidays/sync',
};

app.use(express.json({ limit: '1mb' }));

// endpoint วิเคราะห์รอบใหม่ — หน้าเว็บเรียกผ่าน /api/analysis/... ไม่ยิงตรงไป :4000
// (เบราว์เซอร์เข้าถึงพอร์ต API ไม่ได้ ระบบรันสองตัวแยกกัน)
const ANALYSIS_ROUTES = {
	'items': 'api-item-categories',
	'month-summary': 'api-month-summary',
	'members': 'api-member-rfm',
	'stations': 'api-station-performance',
	'cache': 'api-cache-refresh',
};

app.all(/^\/api\/analysis\/([a-z-]+)(\/.+)?$/, async (req, res) => {
	const target = ANALYSIS_ROUTES[req.params[0]];
	if (!target) return res.status(404).json({ error: 'ไม่รู้จัก endpoint นี้' });

	try {
		const upstream = await axios({
			method: req.method,
			url: api + target + (req.params[1] || ''),
			params: req.query,
			data: ['POST', 'PUT', 'PATCH'].includes(req.method) ? req.body : undefined,
			// เรียก AI นานกว่า query ปกติมาก ปล่อยให้รอได้ถึง 2 นาที
			timeout: 120000,
			validateStatus: () => true,
		});
		res.status(upstream.status).json(upstream.data);
	} catch (err) {
		console.error('ANALYSIS PROXY:', err.message);
		res.status(502).json({ error: 'ติดต่อ API ไม่ได้' });
	}
});

app.all(/^\/api\/recurring\/([a-z]+)(\/\d+)?$/, async (req, res) => {
	const target = RECURRING_ROUTES[req.params[0]];
	if (!target) return res.status(404).json({ error: 'ไม่รู้จัก endpoint นี้' });

	const suffix = req.params[1] || '';
	try {
		const upstream = await axios({
			method: req.method,
			url: api + target + suffix,
			params: req.query,
			data: ['POST', 'PUT', 'PATCH'].includes(req.method) ? req.body : undefined,
			timeout: 60000,
			// ปล่อยให้ status ผ่านมาทั้งหมด แล้วส่งต่อตามจริง
			// ไม่งั้น 400/409 จะกลายเป็น 500 แล้วผู้ใช้ไม่รู้ว่าผิดตรงไหน
			validateStatus: () => true,
		});
		res.status(upstream.status).json(upstream.data);
	} catch (err) {
		console.error('RECURRING PROXY:', err.message);
		res.status(502).json({ error: 'ติดต่อ API ไม่ได้' });
	}
});

app.get('/report-recurring-jobs', async (req, res) => {
	// ค่าเริ่มต้นเป็นเดือนของวันล่าสุดที่มีข้อมูล ไม่ใช่เดือนปฏิทินปัจจุบัน
	// ข้อมูลตามหลังปฏิทินอยู่เสมอ เปิดมาเดือนปัจจุบันจะว่างเปล่า
	const latest = await latestDataDate();
	const month = req.query.month || latest.slice(0, 7);
	const from = month + '-01';
	// ห้ามใช้ toISOString: Date สร้างตามเวลาท้องถิ่น (UTC+7) แล้ว toISOString
	// แปลงกลับเป็น UTC ถอยไป 1 วัน — วันสุดท้ายของเดือนหลุดจากช่วงที่ query
	// (2026-08 เคยได้ to = 2026-08-30 แทนที่จะเป็น 08-31)
	const to = month + '-' + String(
		new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate()
	).padStart(2, '0');
	const jobFilter = req.query.job || '';

	const empty = {
		jobs: [], schedule: [], holidays: [], members: [], drivers: [], suggestions: [],
		analysis: { byDate: [], materials: [], drivers: [] },
		month, from, to, jobFilter, err: null,
	};

	try {
		const [jobsRes, scheduleRes, analysisRes, suggestRes, driverRes] =
			await Promise.all([
				axios.get(api + 'api-recurring-jobs', { timeout: 30000 }),
				axios.get(api + 'api-recurring-schedule',
					{ params: { from, to }, timeout: 30000 }),
				axios.get(api + 'api-recurring-analysis',
					{ params: { job: jobFilter || undefined }, timeout: 60000 }),
				axios.get(api + 'api-recurring-suggest',
					{ params: { month }, timeout: 30000 }).catch(() => ({ data: [] })),
				loadDrivers().then(r => r.data.drivers).catch(() => []),
			]);

		// รายชื่อคนขับสำหรับ dropdown เอาเฉพาะคนขับรถจริง ไม่เอาจุดรับเข้า
		const drivers = (driverRes || [])
			.filter(d => d.kind === 'คนขับรถ')
			.map(d => d.driver)
			.sort();

		res.render('Report-Recurring-Jobs.ejs', {
			...empty,
			jobs: jobsRes.data,
			schedule: scheduleRes.data.schedule,
			holidays: scheduleRes.data.holidays,
			analysis: analysisRes.data,
			suggestions: suggestRes.data || [],
			drivers,
		});
	} catch (err) {
		const hint = err.response?.data?.hint;
		console.error('RECURRING:', err.message);
		res.render('Report-Recurring-Jobs.ejs', {
			...empty,
			err: hint ? `${err.response.data.error} — ${hint}` : 'ดึงข้อมูลงานประจำไม่สำเร็จ',
		});
	}
});

app.listen(port, () => {
	console.log(`listening on Port : ${port}`)
	loadCarbonOverrides();
})
