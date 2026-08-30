// คำนวณ cache ของหน้าวิเคราะห์ใหม่ให้อัตโนมัติ
//
// หน้าเว็บอ่านจาก materialized view (mv_*) เพราะอ่านสดจาก weight_query 1.3M แถว
// ใช้เวลาหลักสิบวินาทีต่อการเปิดหน้าหนึ่งครั้ง (ดู database/analysis_cache.sql)
// ข้อเสียคือ cache ค้างเมื่อข้อมูลเข้าใหม่
//
// เดิมต้องสั่ง scripts/refresh-cache.ps1 เองทุกครั้ง ซึ่งแปลว่าคนใช้ต้องรู้ว่า
// มีสคริปต์นี้อยู่ ลืมเมื่อไรตัวเลขบนหน้าเว็บก็ค้างที่รอบก่อนโดยไม่มีใครรู้
// ตัวนี้ทำให้ระบบดูแลตัวเอง: เช็คว่าข้อมูลต้นทางเปลี่ยนไหม ถ้าเปลี่ยนก็คำนวณใหม่
//
// ใช้ REFRESH ... CONCURRENTLY เพื่อให้คนที่เปิดหน้าอยู่ยังอ่านของเดิมได้ระหว่างทำ
// (ทำได้เพราะเรียกจาก Node นอกทรานแซกชัน — ในฟังก์ชัน plpgsql ทำไม่ได้)

// ลำดับสำคัญ: ราคากลางต้องมาก่อนผลงานคนขับ ไม่งั้นคนขับถูกวัดด้วยราคาของรอบก่อน
// และที่อยู่สมาชิกต้องมาก่อนออร์เดอร์ เพราะเขตของบิลมาจากที่อยู่
const VIEWS = [
	{ name: 'v_item_price_benchmark', concurrent: false }, // ไม่มี unique index
	{ name: 'mv_item_category', concurrent: true },
	{ name: 'mv_unknown_items', concurrent: true },
	{ name: 'mv_member_address', concurrent: true },
	{ name: 'mv_orders', concurrent: true },
	{ name: 'mv_orders_by_district', concurrent: true },
	{ name: 'mv_member_activity', concurrent: true },
	{ name: 'mv_station_performance', concurrent: true },
	{ name: 'mv_station_materials', concurrent: true },
	{ name: 'mv_station_monthly', concurrent: true },
	{ name: 'mv_station_coverage', concurrent: true },
	{ name: 'mv_month_facts', concurrent: true },
	{ name: 'mv_driver_performance', concurrent: true },
	{ name: 'mv_driver_monthly', concurrent: true },
	{ name: 'mv_zone_member_summary', concurrent: true },
	{ name: 'mv_booking_by_ring', concurrent: true },
];

// ลายนิ้วมือของข้อมูลต้นทาง — เปลี่ยนเมื่อไรแปลว่ามีข้อมูลเข้ามาใหม่
// ใช้ count + วันล่าสุด แทนการดู timestamp ของตาราง เพราะ PostgreSQL
// ไม่ได้เก็บ "แก้ล่าสุดเมื่อไร" ของตารางไว้ให้อ่านตรง ๆ
const FINGERPRINT_SQL = `
SELECT (SELECT count(*) FROM weight_query)                  AS weight_rows,
       (SELECT max(purchase_date)::text FROM weight_query)  AS weight_max,
       (SELECT count(*) FROM booking_queue)                 AS booking_rows,
       (SELECT count(*) FROM item_category_overrides
         WHERE source = 'manual')                           AS confirmed_items`;

let running = false;

async function fingerprint(db) {
	try {
		const r = await db.query(FINGERPRINT_SQL);
		return JSON.stringify(r.rows[0]);
	} catch (err) {
		// ตารางยังไม่ครบ = ยังตั้งระบบไม่เสร็จ ไม่ใช่ความผิดพลาด
		if (err.code === '42P01') return null;
		throw err;
	}
}

/** cache ตรงกับข้อมูลปัจจุบันหรือยัง */
export async function cacheState(db) {
	const current = await fingerprint(db);
	if (current === null) return { ready: false, reason: 'ยังไม่ได้สร้างตารางวิเคราะห์' };

	const last = await db.query(
		'SELECT refreshed_at, detail FROM analysis_cache_log ORDER BY id DESC LIMIT 1');
	const row = last.rows[0];
	const savedPrint = row && row.detail ? row.detail.fingerprint : null;

	return {
		ready: true,
		stale: savedPrint !== current,
		fingerprint: current,
		refreshedAt: row ? row.refreshed_at : null,
		running,
	};
}

/**
 * คำนวณใหม่ทั้งชุด — เรียกซ้ำระหว่างที่ยังทำอยู่จะถูกข้าม
 * ไม่ throw ออกไป เพราะตัวเรียกคือ background job ที่ไม่ควรทำให้ server ตาย
 */
export async function refreshCache(db, { reason = 'auto' } = {}) {
	if (running) return { skipped: true, reason: 'กำลังคำนวณอยู่แล้ว' };

	const current = await fingerprint(db);
	if (current === null) return { skipped: true, reason: 'ยังไม่ได้สร้างตารางวิเคราะห์' };

	running = true;
	const started = Date.now();
	const done = [];
	const failed = [];

	try {
		for (const view of VIEWS) {
			const exists = await db.query(
				'SELECT to_regclass($1) IS NOT NULL AS ok', ['public.' + view.name]);
			if (!exists.rows[0].ok) continue;

			const t0 = Date.now();
			try {
				await db.query(
					'REFRESH MATERIALIZED VIEW ' + (view.concurrent ? 'CONCURRENTLY ' : '') + view.name);
				done.push({ view: view.name, ms: Date.now() - t0 });
			} catch (err) {
				// ตัวเดียวพังไม่ควรทำให้ที่เหลือไม่ได้คำนวณ
				failed.push({ view: view.name, error: err.message });
				console.error('CACHE REFRESH ' + view.name + ':', err.message);
			}
		}

		await db.query('INSERT INTO analysis_cache_log (detail) VALUES ($1)',
			[JSON.stringify({
				fingerprint: current,
				reason,
				ms: Date.now() - started,
				refreshed: done,
				failed,
			})]);

		console.log('cache: คำนวณใหม่ ' + done.length + ' view ใน ' +
			Math.round((Date.now() - started) / 1000) + ' วินาที' +
			(failed.length ? ' (พลาด ' + failed.length + ')' : ''));

		return { refreshed: done, failed, ms: Date.now() - started };
	} finally {
		running = false;
	}
}

/**
 * ดูแลตัวเองเบื้องหลัง: เช็คทุก ๆ ช่วงว่าข้อมูลเปลี่ยนไหม เปลี่ยนแล้วคำนวณใหม่
 * ค่าเริ่มต้น 15 นาที — ข้อมูลเข้าเดือนละครั้ง ถี่กว่านี้ไม่ได้อะไรเพิ่ม
 */
export function startCacheWatcher(db, { intervalMs = 15 * 60 * 1000 } = {}) {
	const tick = async () => {
		try {
			const state = await cacheState(db);
			if (!state.ready || state.running) return;
			if (!state.stale) return;

			console.log('cache: ข้อมูลเปลี่ยน กำลังคำนวณใหม่เบื้องหลัง...');
			await refreshCache(db, { reason: 'ตรวจพบข้อมูลใหม่' });
		} catch (err) {
			console.error('CACHE WATCHER:', err.message);
		}
	};

	// ตรวจครั้งแรกหลังเปิดเครื่อง 20 วินาที — ให้ server พร้อมรับ request ก่อน
	// ไม่งั้นคนเปิดหน้าแรกตอน server เพิ่งขึ้นจะเจอ query แข่งกับการคำนวณ cache
	setTimeout(tick, 20000);
	const timer = setInterval(tick, intervalMs);
	timer.unref?.();
	return timer;
}
