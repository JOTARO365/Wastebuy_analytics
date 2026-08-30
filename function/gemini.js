// เรียก Gemini API — ใช้เฉพาะงานที่เป็น "ภาษา" ไม่ใช่งานคำนวณ
//
// กติกาที่ตั้งไว้ใน docs/PLAN.md หัวข้อ 8.4:
//   - ตัวเลขทุกตัวมาจาก SQL โมเดลได้รับแค่ตัวเลขที่คำนวณเสร็จแล้ว
//   - ไม่ส่งชื่อ/เบอร์/ที่อยู่สมาชิกออกไป (แผนฟรีเอาข้อมูลไปเทรนต่อได้)
//   - ผลที่ได้เป็น "ข้อเสนอ" ต้องมีคนกดยืนยัน
//   - ทุกครั้งที่เรียก เก็บ prompt + คำตอบลง ai_runs
//
// ไม่มีคีย์ = ระบบทำงานต่อได้ปกติ แค่ปุ่ม AI ใช้ไม่ได้ ไม่ใช่ทั้งหน้าพัง
import axios from 'axios';

const MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
const TIMEOUT_MS = 60000;

export function geminiReady() {
	return Boolean(process.env.GEMINI_API_KEY);
}

export function geminiStatus() {
	return {
		ready: geminiReady(),
		model: MODEL,
		hint: geminiReady() ? null : 'ใส่ GEMINI_API_KEY ใน .env แล้วรีสตาร์ท server.js',
	};
}

/**
 * ถามโมเดลแล้วคืนข้อความดิบ พร้อมบันทึกลง ai_runs เสมอ
 * ทั้งตอนสำเร็จและตอนพัง — เวลาโมเดลตอบแปลกจะได้ย้อนดูได้ว่าถามด้วยอะไร
 */
export async function askGemini(db, { task, prompt, inputSummary, json = false }) {
	if (!geminiReady()) {
		const err = new Error('ยังไม่ได้ตั้ง GEMINI_API_KEY');
		err.code = 'NO_KEY';
		throw err;
	}

	const url = `${ENDPOINT}/${MODEL}:generateContent`;
	const body = {
		contents: [{ parts: [{ text: prompt }] }],
		generationConfig: {
			// งานจัดหมวดต้องการคำตอบเดิมทุกครั้ง ไม่ใช่ความสร้างสรรค์
			temperature: json ? 0 : 0.4,
			...(json ? { responseMimeType: 'application/json' } : {}),
		},
	};

	const started = Date.now();
	let text = null;
	let failure = null;

	try {
		const res = await axios.post(url, body, {
			timeout: TIMEOUT_MS,
			headers: {
				'Content-Type': 'application/json',
				'x-goog-api-key': process.env.GEMINI_API_KEY,
			},
		});
		const parts = res.data?.candidates?.[0]?.content?.parts;
		text = Array.isArray(parts) ? parts.map(p => p.text || '').join('') : null;
		if (!text) throw new Error('โมเดลตอบกลับมาว่าง');
	} catch (err) {
		// ข้อความ error ของ Google มีรายละเอียดที่ต้องใช้ (โควตาหมด / คีย์ผิด)
		// แต่ห้ามให้คีย์หลุดออกไปกับ log
		failure = err.response?.data?.error?.message || err.message;
		if (process.env.GEMINI_API_KEY) {
			failure = failure.split(process.env.GEMINI_API_KEY).join('***');
		}
	}

	const duration = Date.now() - started;
	let runId = null;
	try {
		const saved = await db.query(`
INSERT INTO ai_runs (task, model, prompt, response, input_summary, ok, error, duration_ms)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING id`,
			[task, MODEL, prompt, text, inputSummary || null, !failure, failure, duration]);
		runId = saved.rows[0].id;
	} catch (logErr) {
		// บันทึกไม่ได้ไม่ควรทำให้คำตอบที่ได้มาแล้วหายไป
		console.error('AI LOG:', logErr.message);
	}

	if (failure) {
		const err = new Error(failure);
		err.code = 'GEMINI_FAILED';
		err.runId = runId;
		throw err;
	}
	return { text, runId, model: MODEL, durationMs: duration };
}

/** แกะ JSON จากคำตอบ — บางครั้งโมเดลห่อด้วย ```json ทั้งที่สั่งไม่ให้ห่อ */
export function parseJsonReply(text) {
	const cleaned = text.trim()
		.replace(/^```(?:json)?\s*/i, '')
		.replace(/\s*```$/, '');
	return JSON.parse(cleaned);
}
