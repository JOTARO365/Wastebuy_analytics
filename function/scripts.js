import { createRequire } from "module";
const require = createRequire(import.meta.url)
const db = require('../node_modules/thai-address-database/database/raw_database/raw_database.json')

// วันที่ต้องเป็น YYYY-MM-DD เป๊ะ ๆ ไม่งั้น <input type="date"> ทิ้งค่าแล้วโชว์ว่าง
// เดิม day ไม่ได้ padStart วันที่ 1-9 จึงได้ '2026-08-9' แล้วช่องวันที่ว่างทั้งเดือน
function isoDate(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).padStart(4, '0');
    return `${year}-${month}-${day}`;
}

// รับได้ทั้ง YYYY-MM-DD และ DD-MM-YYYY แล้วคืน YYYY-MM-DD ซึ่งเป็นรูปแบบเดียว
// ที่ <input type="date"> ยอมรับ ใส่รูปแบบอื่นเบราว์เซอร์ทิ้งค่าเงียบ ๆ
export function toIsoDate(value) {
    if (!value) return '';
    const text = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
    const dmy = text.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime()) ? '' : isoDate(parsed);
}

export function showDate() {
    return isoDate(new Date());
};

export function SerialToDateBE(serial) {
	const Epoch = new Date (Date.UTC(1899, 11, 30));
	const date = new Date(Epoch.getTime() + serial * 86400 * 1000);
	const day = date.getDate().toString().padStart(2, '0');
	const month = (date.getMonth() + 1).toString().padStart(2, '0');
	const year = date.getFullYear() + 543;

	return `${day}/${month}/${year}`;
};

export function SerialToDateCE(serial) {
	const Epoch = new Date (Date.UTC(1899, 11, 30));
	const date = new Date(Epoch.getTime() + serial * 86400 * 1000);
	const day = date.getDate().toString().padStart(2, '0');
	const month = (date.getMonth() + 1).toString().padStart(2, '0');
	const year = date.getFullYear() - 543;

	return `${day}/${month}/${year}`;
};

export function InStartDate(startDate) {
    const date = startDate ? new Date(startDate) : new Date();
    return isoDate(date).split('-');
}

export function InEndDate(endDate) {
    const date = endDate ? new Date(endDate) : new Date();
    return isoDate(date).split('-');
}

export function stripTime(date) {
	const d = new Date(date);
	d.setHours(0, 0, 0, 0);
	return d;
}

export function FormatDate(Dates) {
	if (!Dates)
		return "";
	const [year, month, day] = Dates.split('-');
	return `${day}-${month}-${year}`;
};

// ค่าแฟกเตอร์ kgCO2e ต่อกิโล แยกตามชนิดวัสดุ
// เดิมเป็น if/else 6 ชั้นในฟังก์ชันเดียว ชื่อสินค้าต้องตรงเป๊ะทุกตัวอักษร
// 'PETใส' กับ 'PET ใส' จึงเป็นคนละตัว และตัวหลังหลุดไปได้ 0 เงียบ ๆ
const CARBON_FACTORS = [
    { name: 'metal', factor: 4.391, items: [
        'จอทีวีนูน17นิ้ว', 'จอทีวีนูน14นิ้ว', 'หม้อน้ำใส้ทองเหลือง', 'อั่ลลอย', 'ตะกั่วติดเหล็ก',
        'สแตนเลสติดเหล็ก', 'สแตนเลส2', 'ทองเหลืองบาง', 'หม้อน้ำใส้ทองแดง',
        'ของแกะแอร์คอยร้อน/เย็น', 'กระป๋องสังกะสี', 'แบตเล็ก', 'แบตดำใหญ่', 'แบตขาว',
        'ของแกะ / คอมแอร์ / มอเตอร์', 'สแตนเลส1', 'ตะกั่วอ่อน', 'ตะกั่วแข็ง',
        'หม้อน้ำใส้อลูมิเนียม', 'ทองเหลืองติดเหล็ก', 'ทองเหลืองหนา', 'สายไฟทองแดงไม่ปอกเส้นเล็ก',
        'สายไฟทองแดงไม่ปอกเส้นใหญ่', 'ทองแดง 5', 'ทองแดง 4', 'ทองแดง 3', 'ทองแดง 2', 'ทองแดง 1',
        'จอคอม 17 นิ้ว', 'สังกะสีแผ่น', 'กระป๋องสังกะสี'
    ] },
    { name: 'aluminium', factor: 9.127, items: [
        'อลูมิเนียมกะทะผัด', 'อลูมิเนียมแผ่นเพลท', 'ถุงpe', 'สายรัด', 'พลาสติกกรอบยาคู่ลย์',
        'ยางรถยนต์', 'ท่อpvcเหลือง', 'เครื่องซักผ้า', 'อลูมิเนียมล้อแม็กรถยนต์',
        'อลูมิเนียมฝาจุกแกะ (M100)', 'อลูมิเนียมติดเหล็กไม่เกิน 30%', 'อลูมิเนียมจั๊บ',
        'อลูมิเนียมกระป๋อง', 'อลูมิเนียมบาง', 'อลูมิเนียมหนา', 'B.โค๊ก', 'Bโค๊ก(บิด/เหยียบ)'
    ] },
    { name: 'plastic', factor: 1.031, items: [
        'ถุงฟิมส์', 'ถุงรวมสะอาด', 'จอคอม 14 นิ้ว', 'ตู้เย็น', 'แผ่น CD', 'อาคีลิก',
        'เปลือกสายไฟรวมสี / สีดำ', 'ท่อPVC เทา/ขอบpvcเทา', 'ท่อ PVC ฟ้า', 'ถุงซัก',
        'ถุงรวมสะอาด', 'PET ใส', 'PET สี( เขียว,ชา )', 'ขาวขุ่น 2', 'พลาสติกกรอบติดเหล็ก',
        'พลาสติกกรอบ', 'พลาสติกรวมดำ', 'พลาสติกรวมเล็ก', 'พลาสติกรวม',
        'ปิ๊บน้ำมันพืชใหม่ (เปล่า)', 'Petใส(บิด/เหยียบ)'
    ] },
    { name: 'paper', factor: 3.546, items: [
        'กระดาษทำลาย/รอคัด', 'กล่องนม', 'หนังสือพิมพ์', 'หนังสือเล่ม', 'กระดาษแกน', 'กระดาษย่อย',
        'กระดาษลังน้ำตาล (ลูกฟูก)', 'กระดาษขาวดำ1'
    ] },
    { name: 'steel', factor: 1.832, items: [
        'เหล็กบาง/เหล็กถัง200Lit/ลวดสลิง/ผ้าเบรค', 'เหล็กย่อย', 'เหล็กยาว',
        'เหล็กหนาสั้น+เหล็กเครื่อง', 'เหล็กหล่อ', 'เหล็กขี้กลึง,ลวดยุ่ง', 'เหล็กโช๊ค',
        'เหล็กรวม'
    ] },
    { name: 'glass', factor: 0.276, items: [
        'เหล้าขาวเล็ก', 'เหล้าขาวใหญ่', 'เบียร์ช้างใหญ่ (แบบใหม่)', 'เบียร์ลีโอ', 'แก้วรวม',
        'แก้วเขียว', 'แก้วขาว', 'แก้วแดง'
    ] },
];
const PROJECT_PREFIX = /^(ss|dp|nl|rdf)\s+/i;

// map ชื่อที่ normalize แล้ว -> factor สร้างครั้งเดียวตอนโหลดโมดูล
// เดิมทุกแถวต้องวิ่งผ่าน includes() ของ array 6 ชุด = O(n) ต่อแถว
const FACTOR_BY_NAME = new Map();
CARBON_FACTORS.forEach(function (group) {
    group.items.forEach(function (item) {
        FACTOR_BY_NAME.set(normalizeMaterialName(item), group.factor);
    });
});

// ชื่อสินค้าจากรายงานสะกดไม่นิ่ง: 'PETใส' / 'PET ใส', 'ท่อPVC ฟ้า' / 'ท่อ PVC ฟ้า'
// — เทียบแบบตัดช่องว่างทั้งหมดจึงจับได้ตรงกัน
//
// สินค้าของโครงการมีรหัสโครงการนำหน้าชื่อด้วย ('SS PETใส' = PETใส ของสยามพารากอน)
// การตัดแค่ช่องว่างไม่พอ เพราะ 'sspetใส' ยังไม่เท่ากับ 'petใส' — ต้องตัด prefix ทิ้ง
// ก่อน ไม่งั้นสินค้าทั้งชุดของโครงการไม่ได้ค่าคาร์บอนเลย (6,435 แถว / 381,711 กก.)
export function normalizeMaterialName(name) {
    return String(name == null ? '' : name)
        .replace(PROJECT_PREFIX, '')
        .replace(/\s+/g, '')
        .toLowerCase();
}

// ค่า GHG จากตาราง materials มีสิทธิ์เหนือกว่าตารางในโค้ด
// ตั้งครั้งเดียวตอน server เริ่ม (ดู loadCarbonOverrides ใน app.js)
const FACTOR_OVERRIDES = new Map();

export function setCarbonOverrides(pairs) {
    FACTOR_OVERRIDES.clear();
    (pairs || []).forEach(function (row) {
        const factor = Number(row.ghg);
        if (!row.name_mat || !Number.isFinite(factor) || factor === 0) return;
        FACTOR_OVERRIDES.set(normalizeMaterialName(row.name_mat), factor);
    });
    return FACTOR_OVERRIDES.size;
}

// ชื่อที่หาแฟกเตอร์ไม่เจอ เก็บไว้รายงานให้คนเห็น ไม่ใช่ปล่อยเป็น 0 เงียบ ๆ
const UNKNOWN_MATERIALS = new Map();

export function carbonFactor(name) {
    const key = normalizeMaterialName(name);
    if (!key) return null;
    const factor = FACTOR_OVERRIDES.get(key) ?? FACTOR_BY_NAME.get(key);
    if (factor === undefined) {
        UNKNOWN_MATERIALS.set(name, (UNKNOWN_MATERIALS.get(name) || 0) + 1);
        return null;
    }
    return factor;
}

export function unknownMaterials() {
    return [...UNKNOWN_MATERIALS.entries()]
        .map(function (e) { return { item_name: e[0], rows: e[1] }; })
        .sort(function (a, b) { return b.rows - a.rows; });
}

export function resetUnknownMaterials() {
    UNKNOWN_MATERIALS.clear();
}

// คืน 0 เมื่อไม่รู้จักวัสดุ (ผู้เรียกเดิมใช้ `|| 0` อยู่แล้ว) แต่ตอนนี้ถูกนับไว้
// ใน unknownMaterials() ด้วย หน้าเว็บจึงบอกได้ว่ามีอะไรตกหล่นบ้าง
export function carbonCalc(row, item, weight) {
    const factor = carbonFactor(row[item]);
    if (factor === null) return 0;
    const kg = Number(row[weight]);
    return Number.isFinite(kg) ? kg * factor : 0;
}
