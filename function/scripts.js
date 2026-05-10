import { createRequire } from "module";
const require = createRequire(import.meta.url)
const db = require('../node_modules/thai-address-database/database/raw_database/raw_database.json')

export function showDate() {
    const date = new Date();
    const day = date.getDate();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).padStart(2, '0');
    return (year + '-' + month + '-' + day);
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

    let date;

    if (startDate) {
        date = new Date(startDate)
    } else {
        date = new Date();
    }

    const day = date.getDate();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).padStart(2, '0');
    return [year, month, day];
}

export function stripTime(date) {
	const d = new Date(date);
	d.setHours(0, 0, 0, 0);
	return d;
}


export function extractlocation(url) {
  if (!url) return { lat: null, lng: null };

  // กรณี @lat,lng ใน URL
  let match = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (match) {
    return {
      lat: parseFloat(match[1]),
      lng: parseFloat(match[2])
    };
  }

  // กรณี q=lat,lng
  match = url.match(/q=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (match) {
    return {
      lat: parseFloat(match[1]),
      lng: parseFloat(match[2])
    };
  }

  return { lat: null, lng: null };
};

export function FormatDate(Dates) {
	if (!Dates)
		return "";
	const [year, month, day] = Dates.split('-');
	return `${day}-${month}-${year}`;
};


export function InEndDate(endDate) {
    let date;

    if (endDate) {
        date = new Date(endDate);
    } else {
        date = new Date()
    }

    const day = date.getDate();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).padStart(2, '0');
    return [year, month, day];
}

export function carbonCalc(row, item, weight) {

    // # factor_1 will calculate the values according it this list
    // # จอทีวีนูน17นิ้ว จอทีวีนูน14นิ้ว   หม้อน้ำใส้ทองเหลือง
    // # อั่ลลอย      ตะกั่วติดเหล็ก   สแตนเลสติดเหล็ก
    // # สแตนเลส2   ทองเหลืองบาง  หม้อน้ำใส้ทองแดง
    // # ของแกะแอร์คอยร้อน/เย็น     กระป๋องสังกะสี
    // # แบตเล็ก     แบตดำใหญ่    แบตขาว
    // # ของแกะ / คอมแอร์ / มอเตอร์
    // # สแตนเลส1   ตะกั่วอ่อน      ตะกั่วแข็ง
    // # หม้อน้ำใส้อลูมิเนียม  ทองเหลืองติดเหล็ก  ทองเหลืองหนา
    // # สายไฟเส้นเล็กไม่ปอก(ทองแดง)  สายไฟเส้นใหญ่ไม่ปอก(ทองแดง)
    // # ทองแดง 5  ทองแดง 4  ทองแดง 3
    // # ทองแดง 2  ทองแดง 1  จอคอม 17 นิ้ว
    // # สังกะสีแผ่น  กระป๋องสังกะสี


    // # factor_2 will calculate the values according it this list
    // # อลูมิเนียมกะทะผัด อลูมิเนียมแผ่นเพลท  ถุงpe
    // # สายรัด         พลาสติกกรอบยาคู่ลย์ ยางรถยนต์
    // # ท่อpvcเหลือง    เครื่องซักผ้า
    // # อลูมิเนียมล้อแม็กรถยนต์        อลูมิเนียมฝาจุกแกะ (M100)
    // # อลูมิเนียมติดเหล็กไม่เกิน 30%   อลูมิเนียมจั๊บ
    // # อลูมิเนียมกระป๋อง อลูมิเนียมบาง อลูมิเนียมหนา
    // # B.โค๊ก Bโค๊ก(บิด/เหยียบ)


    // # factor_3 will calculate the values according it this list
    // # ถุงฟิมส์       ถุงรวมสะอาด   จอคอม 14 นิ้ว
    // # ตู้เย็น        แผ่น CD       อาคีลิก
    // # เปลือกสายไฟรวมสี / สีดำ    ท่อPVC เทา/ขอบpvcเทา
    // # ท่อ PVC ฟ้า  ถุงซัก        ถุงรวมสะอาด
    // # PET ใส     PET สี( เขียว,ชา )  ขาวขุ่น 2
    // # พลาสติกกรอบติดเหล็ก   พลาสติกกรอบ
    // # พลาสติกรวมดำ   พลาสติกรวมเล็ก   พลาสติกรวม
    // # ปิ๊บน้ำมันพืชใหม่ (เปล่า) Petใส(บิด/เหยียบ)


    // # factor_4 will calculate the values according it this list
    // # กระดาษทำลาย/รอคัด  กล่องนม     หนังสือพิมพ์
    // # หนังสือเล่ม          กระดาษแกน  กระดาษย่อย
    // # กระดาษลังน้ำตาล (ลูกฟูก)   กระดาษขาวดำ1


    // # factor_5 will calculate the values according it this list
    // # เหล็กบาง/เหล็กถัง200Lit/ลวดสลิง/ผ้าเบรค
    // # เหล็กย่อย  เหล็กยาว  เหล็กหนาสั้น+เหล็กเครื่อง
    // # เหล็กหล่อ  เหล็กขี้กลึง,ลวดยุ่ง   เหล็กโช๊ค
    // # เหล็กรวม


    // # factor_6 will calculate the values according it this list
    // # เหล้าขาวเล็ก  เหล้าขาวใหญ่  เบียร์ช้างใหญ่ (แบบใหม่)
    // # เบียร์ลีโอ     แก้วรวม      แก้วเขียว
    // # แก้วขาว      แก้วแดง


    // # has not been calculated yet
    // # น้ำมันเครื่อง  น้ำมันพืชเก่า (KG)

    const factor_1 = 4.391
    const factor_2 = 9.127
    const factor_3 = 1.031
    const factor_4 = 3.546
    const factor_5 = 1.832
    const factor_6 = 0.276

    if ([
        'จอทีวีนูน17นิ้ว', 'จอทีวีนูน14นิ้ว', 'หม้อน้ำใส้ทองเหลือง', 'อั่ลลอย', 'ตะกั่วติดเหล็ก',
        'สแตนเลสติดเหล็ก', 'สแตนเลส2', 'ทองเหลืองบาง', 'หม้อน้ำใส้ทองแดง', 'ของแกะแอร์คอยร้อน/เย็น',
        'กระป๋องสังกะสี', 'แบตเล็ก', 'แบตดำใหญ่', 'แบตขาว', 'ของแกะ / คอมแอร์ / มอเตอร์', 'สแตนเลส1',
        'ตะกั่วอ่อน', 'ตะกั่วแข็ง', 'หม้อน้ำใส้อลูมิเนียม', 'ทองเหลืองติดเหล็ก', 'ทองเหลืองหนา',
        'สายไฟทองแดงไม่ปอกเส้นเล็ก', 'สายไฟทองแดงไม่ปอกเส้นใหญ่', 'ทองแดง 5', 'ทองแดง 4',
        'ทองแดง 3', 'ทองแดง 2', 'ทองแดง 1', 'จอคอม 17 นิ้ว', 'สังกะสีแผ่น', 'กระป๋องสังกะสี'
    ].includes(row[item])) {
        return row[weight] * factor_1;
    }

    else if ([
        'อลูมิเนียมกะทะผัด', 'อลูมิเนียมแผ่นเพลท', 'ถุงpe', 'สายรัด', 'พลาสติกกรอบยาคู่ลย์', 'ยางรถยนต์',
        'ท่อpvcเหลือง', 'เครื่องซักผ้า', 'อลูมิเนียมล้อแม็กรถยนต์', 'อลูมิเนียมฝาจุกแกะ (M100)',
        'อลูมิเนียมติดเหล็กไม่เกิน 30%', 'อลูมิเนียมจั๊บ', 'อลูมิเนียมกระป๋อง', 'อลูมิเนียมบาง',
        'อลูมิเนียมหนา', 'B.โค๊ก', 'Bโค๊ก(บิด/เหยียบ)'
    ].includes(row[item])) {
        return row[weight] * factor_2;
    }

    else if ([
        'ถุงฟิมส์', 'ถุงรวมสะอาด', 'จอคอม 14 นิ้ว', 'ตู้เย็น', 'แผ่น CD', 'อาคีลิก',
        'เปลือกสายไฟรวมสี / สีดำ', 'ท่อPVC เทา/ขอบpvcเทา', 'ท่อ PVC ฟ้า', 'ถุงซัก', 'ถุงรวมสะอาด',
        'PET ใส', 'PET สี( เขียว,ชา )', 'ขาวขุ่น 2', 'พลาสติกกรอบติดเหล็ก', 'พลาสติกกรอบ',
        'พลาสติกรวมดำ', 'พลาสติกรวมเล็ก', 'พลาสติกรวม', 'ปิ๊บน้ำมันพืชใหม่ (เปล่า)', 'Petใส(บิด/เหยียบ)'
    ].includes(row[item])) {
        return row[weight] * factor_3;
    }

    else if ([
         'กระดาษทำลาย/รอคัด', 'กล่องนม', 'หนังสือพิมพ์', 'หนังสือเล่ม', 'กระดาษแกน', 'กระดาษย่อย',
        'กระดาษลังน้ำตาล (ลูกฟูก)', 'กระดาษขาวดำ1'
    ].includes(row[item])) {
        return row[weight] * factor_4;
    }

    else if ([
        'เหล็กบาง/เหล็กถัง200Lit/ลวดสลิง/ผ้าเบรค', 'เหล็กย่อย', 'เหล็กยาว', 'เหล็กหนาสั้น+เหล็กเครื่อง',
        'เหล็กหล่อ', 'เหล็กขี้กลึง,ลวดยุ่ง', 'เหล็กโช๊ค', 'เหล็กรวม'
    ].includes(row[item])) {
        return row[weight] * factor_5;
    }

    else if ([
        'เหล้าขาวเล็ก', 'เหล้าขาวใหญ่', 'เบียร์ช้างใหญ่ (แบบใหม่)', 'เบียร์ลีโอ', 'แก้วรวม', 'แก้วเขียว',
        'แก้วขาว', 'แก้วแดง'
    ].includes(row[item])) {
        return row[weight] * factor_6;
    }

    else
        return 0;
};



