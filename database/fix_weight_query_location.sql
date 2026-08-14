-- แก้ weight_query.location ที่ยังเป็นชื่อเก่า ให้ตรงกับ customers.fullname ปัจจุบัน
-- ชื่อที่แก้ : 218
-- แถวที่โดน : 19,525
-- ที่มา     : unmatched_locations.csv (analyze_unmatched.py)

SET client_encoding = 'UTF8';

BEGIN;

-- [renamed] 394 แถว
UPDATE weight_query SET location = 'บ.แสงฟ้าก่อสร้าง บ้านร่วมทางฝัน6' WHERE location = 'บ้านร่วมทางฝัน 6 บจก.เเสงฟ้าก่อสร้าง';
-- [renamed] 662 แถว
UPDATE weight_query SET location = 'บ.แสงฟ้าก่อสร้าง จำกัด' WHERE location = 'บริษัท แสงฟ้าก่อสร้าง จำกัด';
-- [renamed] 1094 แถว
UPDATE weight_query SET location = 'CTA16138 โรงเรียนบ้านบางกะปิ' WHERE location = 'โรงเรียน บ้านบางกะปิ';
-- [renamed] 50 แถว
UPDATE weight_query SET location = 'บ.แสงฟ้าก่อสร้าง ผู้รับเหมา' WHERE location = 'ผู้รับเหมา แสงฟ้า';
-- [renamed] 1050 แถว
UPDATE weight_query SET location = 'เทพลีลาคอนโดทาวน์ สมศร..เนตรวิจิตร' WHERE location = 'เทพลีลาคอนโดทาวน์ ปุณรัศมิ์ ไกรอัมราเกียรติ';
-- [renamed] 377 แถว
UPDATE weight_query SET location = '7-11(04619) บึงบัว ฉันทนา(ผู้จัดการ)' WHERE location = '7-11(04619) ฉันทนา(ผู้จัดการ)';
-- [renamed] 216 แถว
UPDATE weight_query SET location = 'บ.แสงฟ้าก่อสร้าง (Holiday Inn Express S.23)' WHERE location = 'บ.แสงฟ้า (Holiday Inn Express S.23)';
-- [renamed] 265 แถว
UPDATE weight_query SET location = 'KTB04 อาคารสาขาถนนศรีอยุธยา วรสรวง' WHERE location = 'KTBนฤมล วรสรวง';
-- [renamed] 313 แถว
UPDATE weight_query SET location = 'CTB34288 โรงเรียนคลองสองต้นนุ่น มีนบุรี' WHERE location = 'CTB34288 โรงเรียนคลองสองต้นนุ่น ภัคธินันท์';
-- [renamed] 138 แถว
UPDATE weight_query SET location = 'บ.แสงฟ้าก่อสร้าง โรงพยาบาลกรุงเทพคริสเตียน' WHERE location = 'บ.แสงฟ้าก่อสร้าง65N1 รามคำแหงฮิลส์';
-- [renamed] 374 แถว
UPDATE weight_query SET location = 'ต๊ะ หมูอ้วน' WHERE location = 'CRA ฝ่ายโครงการตามพระดำริ';
-- [renamed] 149 แถว
UPDATE weight_query SET location = 'บ.แสงฟ้าก่อสร้าง V.ONE TOWER' WHERE location = 'แสงฟ้าก่อสร้าง V.ONE TOWER';
-- [renamed] 149 แถว
UPDATE weight_query SET location = 'Careton CTB48392 โรงเรียนผลลีรุ่งเรือง หนองจอก' WHERE location = 'CTB48392 โรงเรียนผลลีรุ่งเรือง หนองจอก';
-- [renamed] 219 แถว
UPDATE weight_query SET location = 'PTT.บางนา-ตราด กม.14 101564' WHERE location = 'บางนาตราด กม.14';
-- [renamed] 143 แถว
UPDATE weight_query SET location = 'YANNAWA DISTRICT OFFICE' WHERE location = 'จารุวรรณ ลีระกุล';
-- [renamed] 289 แถว
UPDATE weight_query SET location = 'ZG AKA เซ็นทรัลลาดพร้าว' WHERE location = 'AKA เซ็นทรัลลาดพร้าว';
-- [renamed] 17 แถว
UPDATE weight_query SET location = 'ตลาดศูนย์การค้ามีนบุรี จันท์' WHERE location = 'ตลาดมีนบุรี จันท์';
-- [renamed] 166 แถว
UPDATE weight_query SET location = 'ZG AKA เซ็นทรัลพระราม 9' WHERE location = 'AKA เซ็นทรัลพระราม 9';
-- [renamed] 386 แถว
UPDATE weight_query SET location = 'ZG OTT เซ็นทรัลลาดพร้าว' WHERE location = 'OTT เซ็นทรัลลาดพร้าว';
-- [renamed] 147 แถว
UPDATE weight_query SET location = 'บริษัท โฮมเพ้นท์ จำกัด สาขาที่ 00017 สาขารังสิต-นครนายก คลอง4' WHERE location = 'บริษัท โฮมเพ้นท์ จำกัด สาขาที่ 00016 สาขารังสิต-นครนายก คลอง4';
-- [renamed] 198 แถว
UPDATE weight_query SET location = 'CTA20183 โรงเรียนวัดราษฎร์บำรุง' WHERE location = 'CTA21191ศศพร ภู่สุด';
-- [renamed] 188 แถว
UPDATE weight_query SET location = 'ZG Zen Group สำนักงานใหญ่' WHERE location = 'Zen Group สำนักงานใหญ่';
-- [renamed] 148 แถว
UPDATE weight_query SET location = 'Careton   VRB โรงเรียนวัดทัศนารุณสุนทริการาม' WHERE location = 'CTB36309 VRB โรงเรียนวัดทัศนารุณสุนทริการาม';
-- [renamed] 452 แถว
UPDATE weight_query SET location = 'ZG OTT เซ็นทรัลพระราม 9' WHERE location = 'OTT เซ็นทรัลพระราม 9';
-- [renamed] 90 แถว
UPDATE weight_query SET location = 'ZG AKA แฟชั่นไอส์แลนด์' WHERE location = 'AKA แฟชั่นไอส์แลนด์';
-- [renamed] 183 แถว
UPDATE weight_query SET location = 'ZG ZEN แฟชั่นไอส์แลนด์' WHERE location = 'ZEN แฟชั่นไอส์แลนด์';
-- [renamed] 97 แถว
UPDATE weight_query SET location = 'ZG AKA เซ็นทรัล เวสต์เกต' WHERE location = 'AKA เซ็นทรัล เวสต์เกต';
-- [renamed] 233 แถว
UPDATE weight_query SET location = 'ZG OTT เมกาบางนา' WHERE location = 'OTT เมกาบางนา';
-- [renamed] 214 แถว
UPDATE weight_query SET location = 'ZG ZEN เซ็นทรัลลาดพร้าว' WHERE location = 'ZEN เซ็นทรัลลาดพร้าว';
-- [renamed] 129 แถว
UPDATE weight_query SET location = 'ZG AKA เซ็นทรัลพระราม 2' WHERE location = 'AKA เซ็นทรัลพระราม 2';
-- [renamed] 124 แถว
UPDATE weight_query SET location = 'ZG AKA เดอะมอลล์งามวงศ์วาน' WHERE location = 'AKA เดอะมอลล์งามวงศ์วาน';
-- [renamed] 171 แถว
UPDATE weight_query SET location = 'บริษัท Epson Thailand ธุมวดี...ปลื้มใจ' WHERE location = 'ธุมวดี ปลื้มใจ';
-- [renamed] 112 แถว
UPDATE weight_query SET location = 'บ.แสงฟ้าก่อสร้าง 67M1 บุญมิตรสีลม' WHERE location = '67M1 บุญมิตรสีลม บ.แสงฟ้าก่อสร้าง';
-- [renamed] 69 แถว
UPDATE weight_query SET location = 'Careton โรงเรียนวัดตลิ่งชัน(ปิ่นทองสัณฐาคาร) ตลิ่งชัน' WHERE location = 'CTA10075 โรงเรียนวัดตลิ่งชัน (ปิ่นทองสัณฐาคาร) ตลิ่งชัน';
-- [renamed] 68 แถว
UPDATE weight_query SET location = 'CTB34297 รร.วัดใหม่ลำนกแขวก' WHERE location = 'โรงเรียน วัดใหม่ลำนกแขวก';
-- [renamed] 81 แถว
UPDATE weight_query SET location = 'CTA06039 โรงเรียนวัดไทร (ถาวรพรหมานุกูล)' WHERE location = 'CTA06039 โรงเรียนวัดไทร (ถาวรพรหมานุกูล) จอมทอง';
-- [renamed] 154 แถว
UPDATE weight_query SET location = 'นายธนนท์ชัย มงคลสุภา' WHERE location = 'CTB31261 โรงเรียนพูนสิน เพชรสุขอุปถัมภ์';
-- [renamed] 144 แถว
UPDATE weight_query SET location = 'Jutamas -' WHERE location = 'CTB34294 โรงเรียนวัดทองสัมฤทธิ์ -';
-- [renamed] 198 แถว
UPDATE weight_query SET location = 'ZG ZEN เซ็นทรัลพระราม 9' WHERE location = 'ZEN เซ็นทรัลพระราม 9';
-- [renamed] 79 แถว
UPDATE weight_query SET location = 'CTB35306 โรงเรียนวัดปริวาศ' WHERE location = 'CTB35306 โรงเรียนวัดปริวาศ ยานนาวา';
-- [renamed] 104 แถว
UPDATE weight_query SET location = 'CTB46380 โรงเรียนออเงิน (อ่อน-เหม อนุสรณ์)' WHERE location = 'CTB46380 โรงเรียนออเงิน วรนันทน์';
-- [whitespace] 123 แถว
UPDATE weight_query SET location = 'PTT Station สาขาพระราม 2  48' WHERE location = 'PTT Station สาขาพระราม 2 48';
-- [renamed] 63 แถว
UPDATE weight_query SET location = 'ZG AKA เซ็นทรัลเวิลด์' WHERE location = 'AKA เซ็นทรัลเวิลด์';
-- [renamed] 198 แถว
UPDATE weight_query SET location = 'ZG ZEN เซ็นทรัลเวิลด์' WHERE location = 'ZEN เซ็นทรัลเวิลด์';
-- [renamed] 54 แถว
UPDATE weight_query SET location = 'ZG AKA เดอะมอลล์ บางแค' WHERE location = 'AKA เดอะมอลล์ บางแค';
-- [renamed] 98 แถว
UPDATE weight_query SET location = 'ZG AKA ฟิวเจอร์พาร์ค รังสิต' WHERE location = 'AKA ฟิวเจอร์พาร์ค รังสิต';
-- [renamed] 123 แถว
UPDATE weight_query SET location = 'ZG AKA เซ็นทรัล เวสต์วิลล์' WHERE location = 'AKA เซ็นทรัล เวสต์วิลล์';
-- [whitespace] 84 แถว
UPDATE weight_query SET location = 'ศศิภรณ์  ศุภรมย์' WHERE location = 'ศศิภรณ์ ศุภรมย์';
-- [renamed] 96 แถว
UPDATE weight_query SET location = 'บ.แสงฟ้าก่อสร้าง The Siam Project' WHERE location = 'บ.แสงฟ้าก่อสร้าง 67U0 อาคารจอดรถยนต์ 2 รพ.ยันฮี';
-- [renamed] 76 แถว
UPDATE weight_query SET location = 'CTA12090 โรงเรียนคลองรางจาก' WHERE location = 'CTA12090 โรงเรียนคลองรางจาก เขตทุ่งครุ';
-- [renamed] 177 แถว
UPDATE weight_query SET location = 'ZG ZEN เซ็นทรัลอีสต์วิลล์' WHERE location = 'ZEN เซ็นทรัลอีสต์วิลล์';
-- [renamed] 260 แถว
UPDATE weight_query SET location = 'ZG OTT เซ็นทรัลเวิลด์' WHERE location = 'OTT เซ็นทรัลเวิลด์';
-- [renamed] 175 แถว
UPDATE weight_query SET location = 'ZG OTT เมืองทองธานี' WHERE location = 'OTT เมืองทองธานี';
-- [renamed] 165 แถว
UPDATE weight_query SET location = 'ZG ZEN เซ็นทรัล เวสต์วิลล์' WHERE location = 'ZEN เซ็นทรัล เวสต์วิลล์';
-- [renamed] 127 แถว
UPDATE weight_query SET location = 'ZG ZEN เซ็นทรัลพระราม 2' WHERE location = 'ZEN เซ็นทรัลพระราม 2';
-- [renamed] 181 แถว
UPDATE weight_query SET location = 'ZG ZEN เดอะมอลล์ บางแค' WHERE location = 'ZEN เดอะมอลล์ บางแค';
-- [renamed] 177 แถว
UPDATE weight_query SET location = 'ZG ZEN เดอะมอลล์งามวงศ์วาน' WHERE location = 'ZEN เดอะมอลล์งามวงศ์วาน';
-- [renamed] 44 แถว
UPDATE weight_query SET location = 'นายสมพงษ์ รัตนศรี' WHERE location = 'Pop mart เทอร์มินอล 21';
-- [renamed] 239 แถว
UPDATE weight_query SET location = 'ZG OTT เดอะมอลล์งามวงศ์วาน' WHERE location = 'OTT เดอะมอลล์งามวงศ์วาน';
-- [renamed] 59 แถว
UPDATE weight_query SET location = 'CTA14115 โรงเรียนวัดเจ้าอาม' WHERE location = 'โรงเรียน วัดเจ้าอาม';
-- [renamed] 74 แถว
UPDATE weight_query SET location = 'กิจปณัฎฐ์ คันธบงกช' WHERE location = 'นิติฯ Happy Condo G';
-- [renamed] 64 แถว
UPDATE weight_query SET location = 'โรงเรียนวัดตะกล่ำ _' WHERE location = 'CTB28246 โรงเรียนวัดตะกล่ำ นางพัชนี คำใส';
-- [renamed] 298 แถว
UPDATE weight_query SET location = 'ZG OTT เซ็นทรัล เวสต์วิลล์' WHERE location = 'OTT เซ็นทรัล เวสต์วิลล์';
-- [renamed] 111 แถว
UPDATE weight_query SET location = 'ZG AKA เดอะมอลล์บางกะปิ' WHERE location = 'AKA เดอะมอลล์บางกะปิ';
-- [renamed] 97 แถว
UPDATE weight_query SET location = 'ZG ZEN เมกาบางนา' WHERE location = 'ZEN เมกาบางนา';
-- [renamed] 61 แถว
UPDATE weight_query SET location = 'CTA19169 โรงเรียนวัดไทร' WHERE location = 'ศรัณญู หยิบศรีศิลป์';
-- [renamed] 23 แถว
UPDATE weight_query SET location = 'Pandora_AAA_ ณัฐพล โพธิ์นาง' WHERE location = 'ณัฐพล โพธิ์นาง';
-- [renamed] 304 แถว
UPDATE weight_query SET location = 'ZG OTT เซ็นทรัล เวสต์เกต' WHERE location = 'OTT เซ็นทรัล เวสต์เกต';
-- [renamed] 136 แถว
UPDATE weight_query SET location = 'ZG OTT Zpell ฟิวเจอร์พาร์ค รังสิต' WHERE location = 'OTT Zpell ฟิวเจอร์พาร์ค รังสิต';
-- [renamed] 50 แถว
UPDATE weight_query SET location = 'ZG AKA เซ็นทรัลปิ่นเกล้า' WHERE location = 'AKA เซ็นทรัลปิ่นเกล้า';
-- [renamed] 250 แถว
UPDATE weight_query SET location = 'ZG OTT เซ็นทรัลพระราม 2' WHERE location = 'OTT เซ็นทรัลพระราม 2';
-- [renamed] 96 แถว
UPDATE weight_query SET location = 'ZG ZEN Zpell ฟิวเจอร์พาร์ค รังสิต' WHERE location = 'ZEN Zpell ฟิวเจอร์พาร์ค รังสิต';
-- [renamed] 222 แถว
UPDATE weight_query SET location = 'ZG OTT เซ็นทรัลพระราม 3' WHERE location = 'OTT เซ็นทรัลพระราม 3';
-- [renamed] 55 แถว
UPDATE weight_query SET location = 'ZG AKA สามย่าน' WHERE location = 'AKA สามย่าน';
-- [renamed] 67 แถว
UPDATE weight_query SET location = 'ZG AKA เมกาบางนา' WHERE location = 'AKA เมกาบางนา';
-- [renamed] 69 แถว
UPDATE weight_query SET location = 'บริษัท สยามมิชลิน จำกัด อาคารเดอะไนน์ ทาวเวอร์' WHERE location = 'บริษัท สยามมิชลิน จำกัด The9 tower';
-- [renamed] 95 แถว
UPDATE weight_query SET location = 'ZG ZEN เดอะมอลล์บางกะปิ' WHERE location = 'ZEN เดอะมอลล์บางกะปิ';
-- [renamed] 125 แถว
UPDATE weight_query SET location = 'ZG LAO เซ็นทรัลปิ่นเกล้า' WHERE location = 'LAO เซ็นทรัลปิ่นเกล้า';
-- [renamed] 156 แถว
UPDATE weight_query SET location = 'ZG OTT เดอะมอลล์บางกะปิ' WHERE location = 'OTT เดอะมอลล์บางกะปิ';
-- [renamed] 109 แถว
UPDATE weight_query SET location = 'ZG OTT ศูนย์สิริกิติ์' WHERE location = 'OTT ศูนย์สิริกิติ์';
-- [renamed] 75 แถว
UPDATE weight_query SET location = 'CTB26227 รร.ประภาสวิทยา บึงกุ่ม' WHERE location = 'CTB26227 โรงเรียนประภาสวิทยา บึงกุ่ม';
-- [renamed] 86 แถว
UPDATE weight_query SET location = 'บริษัท เจเนซีส เฟอร์ทิลีตี เซ็นเตอร์ จำกัด (มหาชน)' WHERE location = 'บริษัท เจเนซีส เฟอร์ทิลีตี เซ็นเตอร์ จำกัด (มหาชน) สาขาสำนักงานใหญ่';
-- [renamed] 196 แถว
UPDATE weight_query SET location = 'ZG OTT โรบินสันลาดกระบัง' WHERE location = 'OTT โรบินสันลาดกระบัง';
-- [renamed] 69 แถว
UPDATE weight_query SET location = 'โรงเรียนวัดบางขุนนนท์ เชคบางกอกน้อย' WHERE location = 'อรนิชชา วรรณสุทธิ์';
-- [renamed] 42 แถว
UPDATE weight_query SET location = 'CTB40344 โรงเรียนสุเหร่าดอนสะแก' WHERE location = 'สุพจน์ สันเพชร';
-- [renamed] 138 แถว
UPDATE weight_query SET location = 'ZG ZEN1 เซ็นทรัลปิ่นเกล้า' WHERE location = 'ZEN1 เซ็นทรัลปิ่นเกล้า';
-- [renamed] 59 แถว
UPDATE weight_query SET location = 'CTA03017 โรงเรียนวัดคู้บอน (วัฒนานันท์อุทิศ)' WHERE location = 'CTA03017 โรงเรียนวัดคู้บอน (วัฒนานันท์อุทิศ) คลองสามวา';
-- [renamed] 115 แถว
UPDATE weight_query SET location = 'ZG OTT เซ็นทรัลปิ่นเกล้า' WHERE location = 'OTT เซ็นทรัลปิ่นเกล้า';
-- [renamed] 56 แถว
UPDATE weight_query SET location = 'รจเรข แสงนิล' WHERE location = 'CTA21191 โรงเรียนวัดเลียบราษฎร์บำรุง บางซื่อ';
-- [renamed] 97 แถว
UPDATE weight_query SET location = 'ZG LAO เซ็นทรัลพระราม 3' WHERE location = 'LAO เซ็นทรัลพระราม 3';
-- [renamed] 65 แถว
UPDATE weight_query SET location = 'ZG ZEN เซ็นทรัลพระราม 3' WHERE location = 'ZEN เซ็นทรัลพระราม 3';
-- [renamed] 107 แถว
UPDATE weight_query SET location = 'ZG ZEN เมืองทองธานี' WHERE location = 'ZEN เมืองทองธานี';
-- [renamed] 85 แถว
UPDATE weight_query SET location = 'ZG OTT เซ็นทรัลอีสต์วิลล์' WHERE location = 'OTT เซ็นทรัลอีสต์วิลล์';
-- [renamed] 70 แถว
UPDATE weight_query SET location = 'ZG OTT สามย่าน' WHERE location = 'OTT สามย่าน';
-- [renamed] 21 แถว
UPDATE weight_query SET location = 'CTB33279 รร.วัดชัยฉิมพลี เขตภาษีเจริญ_ครูชนกนันท์' WHERE location = 'CTB33279 โรงเรียนวัดชัยฉิมพลี เขตภาษีเจริญ_ครูชนกนันท์';
-- [renamed] 25 แถว
UPDATE weight_query SET location = 'PTT_ยานนาวา' WHERE location = 'วรรณิญา ศรีซังส้ม';
-- [renamed] 130 แถว
UPDATE weight_query SET location = 'ZG ZEN พาซิโอ ลาดกระบัง' WHERE location = 'ZEN พาซิโอ ลาดกระบัง';
-- [renamed] 74 แถว
UPDATE weight_query SET location = 'ZG AKA เซ็นทรัลพระราม 3' WHERE location = 'AKA เซ็นทรัลพระราม 3';
-- [renamed] 74 แถว
UPDATE weight_query SET location = 'ZG ZEN เซ็นทรัล เวสต์เกต' WHERE location = 'ZEN เซ็นทรัล เวสต์เกต';
-- [renamed] 64 แถว
UPDATE weight_query SET location = 'Samlan Keovixien' WHERE location = 'Samoan Kevixien';
-- [renamed] 93 แถว
UPDATE weight_query SET location = 'ZG TUM สามย่าน' WHERE location = 'TUM สามย่าน';
-- [renamed] 60 แถว
UPDATE weight_query SET location = 'ZG AKA เซ็นทรัลรามอินทรา' WHERE location = 'AKA เซ็นทรัลรามอินทรา';
-- [renamed] 34 แถว
UPDATE weight_query SET location = 'ZG AKA เซ็นทรัลอีสต์วิลล์' WHERE location = 'AKA เซ็นทรัลอีสต์วิลล์';
-- [renamed] 55 แถว
UPDATE weight_query SET location = 'สมใจ นิยมาภา' WHERE location = 'LINE Mum';
-- [renamed] 60 แถว
UPDATE weight_query SET location = 'ZG AKA โรบินสันลาดกระบัง' WHERE location = 'AKA โรบินสันลาดกระบัง';
-- [renamed] 22 แถว
UPDATE weight_query SET location = 'Central รามอินทรา' WHERE location = 'เซ็นทรัล รามอินทรา';
-- [renamed] 29 แถว
UPDATE weight_query SET location = 'ปรียาพร  พูลเกษ' WHERE location = 'LINE Pinnie';
-- [renamed] 39 แถว
UPDATE weight_query SET location = 'patcharaporn rattanasopa' WHERE location = 'พัชราภรณ์ รัตนโสภา';
-- [renamed] 25 แถว
UPDATE weight_query SET location = 'โรงเรียนวิจิตรวิทยา CTB41349' WHERE location = 'CTB41349 โรงเรียนวิจิตรวิทยา วัฒนา';
-- [renamed] 4 แถว
UPDATE weight_query SET location = 'เกษมสุข สานิยม' WHERE location = 'LINE Kasemsook';
-- [renamed] 20 แถว
UPDATE weight_query SET location = 'CTA10069โรงเรัยนชุมทางตลิ่งชัน นัทธพงศ์ มาตเสนา' WHERE location = 'CTA10069 โรงเรียนชุมทางตลิ่งชัน ตลิ่งชัน';
-- [renamed] 11 แถว
UPDATE weight_query SET location = 'บ.แสงฟ้าก่อสร้าง โครงการไซมิส พระราม 9' WHERE location = 'บจก.แสงฟ้าก่อสร้าง โครงการไซมิส พระราม 9';
-- [renamed] 59 แถว
UPDATE weight_query SET location = 'ZG ZEN เพลินนารี่' WHERE location = 'ZEN เพลินนารี่';
-- [renamed] 47 แถว
UPDATE weight_query SET location = 'ZG ZEN ศูนย์สิริกิติ์' WHERE location = 'ZEN ศูนย์สิริกิติ์';
-- [renamed] 48 แถว
UPDATE weight_query SET location = 'กรกฤต สุกาญจน์วัฒนชัย' WHERE location = 'LINE 3Sondad';
-- [renamed] 95 แถว
UPDATE weight_query SET location = 'ZG OTT เพลินนารี่' WHERE location = 'OTT เพลินนารี่';
-- [renamed] 59 แถว
UPDATE weight_query SET location = 'ZG ZEN เซ็นทรัลรามอินทรา' WHERE location = 'ZEN เซ็นทรัลรามอินทรา';
-- [renamed] 69 แถว
UPDATE weight_query SET location = 'ZG OTT เอ็มควอเทียร์' WHERE location = 'OTT เอ็มควอเทียร์';
-- [renamed] 29 แถว
UPDATE weight_query SET location = 'ZG ZEN เซ็นทรัลบางนา' WHERE location = 'ZEN เซ็นทรัลบางนา';
-- [renamed] 25 แถว
UPDATE weight_query SET location = 'PTT_บางบอน 000012' WHERE location = 'PTT Station สาขาบางบอน';
-- [renamed] 15 แถว
UPDATE weight_query SET location = 'CTA030029 รร.สุเหร่าแสนแสบ' WHERE location = 'CTA030029 โรงเรียนสุเหร่าแสนแสบ คลองสามวา';
-- [renamed] 152 แถว
UPDATE weight_query SET location = 'วิมลพรรณ ศรีสุวรรณางกูร' WHERE location = 'วิมล ศรีสุวรรณ';
-- [renamed] 15 แถว
UPDATE weight_query SET location = 'PTT_แยกประชาอุทิศ-ลาดพร้าว 102880' WHERE location = 'PTT_.แยกประชาอุทิศ-ลาดพร้าว 102880';
-- [renamed] 21 แถว
UPDATE weight_query SET location = 'PTT กล้วยน้ำไท' WHERE location = 'PTT Station กล้วยน้ำไท';
-- [renamed] 29 แถว
UPDATE weight_query SET location = 'ZG AKA เซ็นทรัลบางนา' WHERE location = 'AKA เซ็นทรัลบางนา';
-- [renamed] 13 แถว
UPDATE weight_query SET location = 'บริษัท โฮมเพ้นท์ สาขา รัตนาธิเบศร์ราชพฤกษ์' WHERE location = 'ชาลิสา นิยมราษฎร์';
-- [renamed] 147 แถว
UPDATE weight_query SET location = 'Kmrl 1/6 ครูนุต มาเรียลัย' WHERE location = 'Kmrl 1/6 ครูนุต';
-- [whitespace] 25 แถว
UPDATE weight_query SET location = 'ปภาอร ตันเจริญ' WHERE location = 'ปภาอร  ตันเจริญ';
-- [renamed] 18 แถว
UPDATE weight_query SET location = 'Pimchanok Lor' WHERE location = 'Emmi Ssw';
-- [renamed] 26 แถว
UPDATE weight_query SET location = 'นวพร ฉัตรเสถียรวงศ์' WHERE location = 'LINE Navaporn';
-- [renamed] 20 แถว
UPDATE weight_query SET location = 'มลตรี อุปชาบาล' WHERE location = 'LINE  KT';
-- [renamed] 70 แถว
UPDATE weight_query SET location = 'ชญาน์นัทช์ พึ่งบุญ มาเรียลัย' WHERE location = 'ชญาน์นัทช์ พึ่งบุญ';
-- [renamed] 26 แถว
UPDATE weight_query SET location = 'ไหม ไกรเลิศ' WHERE location = 'LINE  Phanphas';
-- [renamed] 72 แถว
UPDATE weight_query SET location = 'ZG CYU เซ็นทรัลเวิลด์' WHERE location = 'CYU เซ็นทรัลเวิลด์';
-- [renamed] 28 แถว
UPDATE weight_query SET location = 'ZG (ปิด)ZEN2 เซ็นทรัลปิ่นเกล้า' WHERE location = '(ปิด)ZEN2 เซ็นทรัลปิ่นเกล้า';
-- [renamed] 23 แถว
UPDATE weight_query SET location = 'ZG AKA เอ็มควอเทียร์' WHERE location = 'AKA เอ็มควอเทียร์';
-- [renamed] 23 แถว
UPDATE weight_query SET location = 'PTT _สามย่าน 103012' WHERE location = 'PTT สามย่าน 103012';
-- [renamed] 11 แถว
UPDATE weight_query SET location = 'AP Grande Pleno รามอินทรา-วงแหวน 2 (จตุรโชติ24)' WHERE location = 'AP Grande Pleno รามอินทรา-วงแหวน 2 (จตุโชติ24)';
-- [renamed] 63 แถว
UPDATE weight_query SET location = 'Kmrl3/1 ครูแอร์ มาเรียลัย' WHERE location = 'Kmrl3/1 ครูแอร์';
-- [renamed] 7 แถว
UPDATE weight_query SET location = 'PTTสาขา เทพรักษ์ 103145' WHERE location = 'เอื้อมพร พันธุ์ดารา';
-- [renamed] 23 แถว
UPDATE weight_query SET location = 'ณัฐ อิสริยะโอภาส' WHERE location = 'natt issariyaopas';
-- [renamed] 2 แถว
UPDATE weight_query SET location = 'CTB42358 โรงเรียนวัดปากบ่อ สวนหลวง' WHERE location = 'LINE T JeNJi';
-- [renamed] 9 แถว
UPDATE weight_query SET location = 'CTA22199 โรงเรียนอำนวยกนกศิริอนุสรณ์' WHERE location = 'นางสาวอรทัย อาญาเมือง';
-- [renamed] 5 แถว
UPDATE weight_query SET location = 'ZG AKA เซ็นทรัลแจ้งวัฒนะ' WHERE location = 'AKA เซ็นทรัลแจ้งวัฒนะ';
-- [renamed] 20 แถว
UPDATE weight_query SET location = 'ZG LY ศูนย์สิริกิติ์' WHERE location = 'LY ศูนย์สิริกิติ์';
-- [renamed] 81 แถว
UPDATE weight_query SET location = 'Melต/1 ครูนุช มาเรียลัย' WHERE location = 'Melต/1 ครูนุช';
-- [renamed] 22 แถว
UPDATE weight_query SET location = 'รชาดา สุวรรณหงษ์' WHERE location = 'มณัสนันท์ สุวรรณหงษ์';
-- [renamed] 5 แถว
UPDATE weight_query SET location = 'วิระ รัตนนันต์' WHERE location = 'LINE Vira';
-- [renamed] 78 แถว
UPDATE weight_query SET location = 'Kmrl1/7 ครูชลธิชา มาเรียลัย' WHERE location = 'Kmrl1/7 ครูชลธิชา';
-- [renamed] 5 แถว
UPDATE weight_query SET location = 'วนิดา พัฒเพ็ง' WHERE location = 'โรงเรียนไขศรีปราโมชอนุสรณ์ วนิดา พัฒเพ็ง';
-- [renamed] 15 แถว
UPDATE weight_query SET location = 'เพ็ญพักต์ นนทะภา' WHERE location = 'LINE Penphak456';
-- [renamed] 65 แถว
UPDATE weight_query SET location = 'Kmrl3/3 ครูทิพย์ มาเรียลัย' WHERE location = 'Kmrl3/3 ครูทิพย์';
-- [renamed] 63 แถว
UPDATE weight_query SET location = 'อารียา บุญอยู่ มาเรียลัย' WHERE location = 'อารียา บุญอยู่';
-- [renamed] 66 แถว
UPDATE weight_query SET location = 'Kmrl1/5 ครูเกษ มาเรียลัย' WHERE location = 'Kmrl1/5 ครูเกษ';
-- [renamed] 88 แถว
UPDATE weight_query SET location = 'Kmrl 1/1 ครูเล็ก มาเรียลัย' WHERE location = 'Kmrl 1/1 ครูเล็ก';
-- [renamed] 13 แถว
UPDATE weight_query SET location = 'Makro126 On Nut  มฆวัฒ' WHERE location = 'มฆวัน  พุมดวง';
-- [renamed] 68 แถว
UPDATE weight_query SET location = 'Kmrl2/3 ครูมณ มาเรียลัย' WHERE location = 'Kmrl2/3 ครูมณ';
-- [renamed] 16 แถว
UPDATE weight_query SET location = 'ZG ZEN ซีดีซี' WHERE location = 'ZEN ซีดีซี';
-- [renamed] 75 แถว
UPDATE weight_query SET location = 'Kmrl1/2 ครูสา มาเรียลัย' WHERE location = 'Kmrl1/2 ครูสา';
-- [renamed] 14 แถว
UPDATE weight_query SET location = 'พิณพร ยุวภูษิตานนท์' WHERE location = 'LINE Pin  Zaken';
-- [renamed] 53 แถว
UPDATE weight_query SET location = 'สุทธินันท์ คําภา มาเรียลัย' WHERE location = 'สุทธินันท์ คําภา';
-- [renamed] 19 แถว
UPDATE weight_query SET location = 'Kasem Koomponsyn' WHERE location = 'Kridsadathan Tiabprakhon';
-- [renamed] 14 แถว
UPDATE weight_query SET location = 'ZG ZEN Paseo รามคำแหง' WHERE location = 'ZEN Paseo รามคำแหง';
-- [renamed] 5 แถว
UPDATE weight_query SET location = 'ZG AKA ยูเนี่ยนมอลล์' WHERE location = 'AKA ยูเนี่ยนมอลล์';
-- [renamed] 63 แถว
UPDATE weight_query SET location = 'Kmrl 2/4 ครูอ้อ มาเรียลัย' WHERE location = 'Kmrl 2/4 ครูอ้อ';
-- [renamed] 4 แถว
UPDATE weight_query SET location = 'ZG AKA ซีคอน ศรีนครินทร์' WHERE location = 'AKA ซีคอน ศรีนครินทร์';
-- [renamed] 5 แถว
UPDATE weight_query SET location = 'AP_CON GPN ทวีวัฒนา' WHERE location = 'เทวินทร์ นารอด';
-- [renamed] 40 แถว
UPDATE weight_query SET location = 'ชนาภา คำทา มาเรียลัย' WHERE location = 'ชนาภา คำทา';
-- [renamed] 9 แถว
UPDATE weight_query SET location = 'ณัฐนนท์ สถิตย์พร' WHERE location = 'LINE Nattanont';
-- [renamed] 7 แถว
UPDATE weight_query SET location = 'ZG AKA ซีคอน บางแค' WHERE location = 'AKA ซีคอน บางแค';
-- [renamed] 7 แถว
UPDATE weight_query SET location = 'โรงเรียนวัดเทพากร (เลี่ยมมาตุทิศ)' WHERE location = 'พรวีณา อยู่ดีรัมย์';
-- [renamed] 6 แถว
UPDATE weight_query SET location = 'สุพรรณี ผลสินธุ์' WHERE location = 'LINE Kik_PlernCheese';
-- [renamed] 11 แถว
UPDATE weight_query SET location = 'GPMED HOUSEเวลาติดต่อ13.00-17.00น.เท่านั้น' WHERE location = 'GPMED HOUSE';
-- [renamed] 12 แถว
UPDATE weight_query SET location = 'ZG ZEN บีไฮฟ' WHERE location = 'ZEN บีไฮฟ';
-- [renamed] 5 แถว
UPDATE weight_query SET location = 'ZG ZEN เซ็นทรัลแจ้งวัฒนะ' WHERE location = 'ZEN เซ็นทรัลแจ้งวัฒนะ';
-- [renamed] 25 แถว
UPDATE weight_query SET location = 'KmrlALC Teacherlaoshi มาเรียลัย' WHERE location = 'KmrlALC Teacherlaoshi';
-- [renamed] 9 แถว
UPDATE weight_query SET location = 'ZG ZEN เดอะแจ๊ส วังหิน' WHERE location = 'ZEN เดอะแจ๊ส วังหิน';
-- [renamed] 14 แถว
UPDATE weight_query SET location = 'ณิชกานต์ ประภาพล' WHERE location = 'Nitchakarn Prapaspon';
-- [renamed] 7 แถว
UPDATE weight_query SET location = 'ZG OTT ราชพฤกษ์' WHERE location = 'OTT ราชพฤกษ์';
-- [renamed] 6 แถว
UPDATE weight_query SET location = 'คลินิกเวชกรรมกล้วยน้ำไท สาขาลาดกระบัง50' WHERE location = 'ขัติยาพร ผางเวช';
-- [renamed] 34 แถว
UPDATE weight_query SET location = 'ZG CYU เอ็มควอเทียร์' WHERE location = 'CYU เอ็มควอเทียร์';
-- [renamed] 47 แถว
UPDATE weight_query SET location = 'kmrl3/4 ครูเล็ก มาเรียลัย' WHERE location = 'kmrl3/4 ครูเล็ก';
-- [renamed] 30 แถว
UPDATE weight_query SET location = 'Kmrl3/7 ครูแต๋ง มาเรียลัย' WHERE location = 'Kmrl3/7  ครูแต๋ง';
-- [renamed] 12 แถว
UPDATE weight_query SET location = 'จตุพร แถวกระต่าย' WHERE location = 'LINE tabz789';
-- [renamed] 13 แถว
UPDATE weight_query SET location = 'พ่อมึงตาย admin waste buy' WHERE location = 'จิณณ์ แซ่หยาง';
-- [renamed] 5 แถว
UPDATE weight_query SET location = 'Pandora_AAA_1070697 Bunruan' WHERE location = 'Pandora_AAA_1300 มากทอง';
-- [renamed] 14 แถว
UPDATE weight_query SET location = 'Kmrl ธุรการ ธิตินันท์ มาเรียลัย' WHERE location = 'Kmrl ธุรการ ธิตินันท์';
-- [renamed] 6 แถว
UPDATE weight_query SET location = 'มัสลัน  เจ๊ะแต' WHERE location = 'เค คลินิกเวชกรรม สาขาอ่อนนุช';
-- [whitespace] 8 แถว
UPDATE weight_query SET location = 'ดวงฤทัย  ดาวเรือง' WHERE location = 'ดวงฤทัย ดาวเรือง';
-- [renamed] 27 แถว
UPDATE weight_query SET location = 'จุฑารัตน์ ฟองฤทธิ์' WHERE location = 'จุฑารัตน์ เจตนเสน';
-- [renamed] 9 แถว
UPDATE weight_query SET location = 'สมชาย อัศวรัตน์' WHERE location = 'สมชาย อัศวัตน์';
-- [renamed] 3 แถว
UPDATE weight_query SET location = 'นันท์นภัส เลิศศิริสาคร' WHERE location = 'Markro42 รามอินทรา';
-- [renamed] 7 แถว
UPDATE weight_query SET location = 'เตรียม2 ครูฝน มาเรียลัย' WHERE location = 'เตรียม2 ครูฝน';
-- [renamed] 2 แถว
UPDATE weight_query SET location = 'ZG OTT เดอะพรอมานาด' WHERE location = 'OTT เดอะพรอมานาด';
-- [renamed] 9 แถว
UPDATE weight_query SET location = 'Kmrlcafe Nattarika มาเรียลัย' WHERE location = 'Kmrlcafe Nattarika';
-- [renamed] 4 แถว
UPDATE weight_query SET location = 'Pandora_AAA_1234567 Tookta' WHERE location = 'Pandora_AAA_8939 salee';
-- [renamed] 8 แถว
UPDATE weight_query SET location = 'ภวัต ละอองสุวรรณ' WHERE location = 'LINE D03155665';
-- [renamed] 5 แถว
UPDATE weight_query SET location = 'สุรินทร์ ตั้งศิริไพศาลกุล' WHERE location = 'LINE RinKung';
-- [renamed] 7 แถว
UPDATE weight_query SET location = 'Kmrl1/3 ครูโสภา มาเรียลัย' WHERE location = 'Kmrl1/3  ครูโสภา';
-- [renamed] 4 แถว
UPDATE weight_query SET location = 'วีรวรรณ  วิริยะ' WHERE location = 'LINE WI2307';
-- [renamed] 12 แถว
UPDATE weight_query SET location = 'วิรุฬห์ (วิ-รุน) อยู่สะบาย' WHERE location = 'LINE WINNER';
-- [renamed] 3 แถว
UPDATE weight_query SET location = 'ศศิณัฏฐ์ ชญาจิรวงศ์' WHERE location = 'CTA24210 วัดคฤหบดี (จันทรสถิตย์)';
-- [renamed] 5 แถว
UPDATE weight_query SET location = 'ลัดดาวรรณ บำรุงบ้าน' WHERE location = 'ลัดดาวรรณ บำรุงย้าน';
-- [renamed] 7 แถว
UPDATE weight_query SET location = 'Kmrl 2/1 ครูออยจิ มาเรียลัย' WHERE location = 'Kmrl 2/1 ครูออยจิ';
-- [renamed] 3 แถว
UPDATE weight_query SET location = 'อ.2/8 พรรณพร หฤษฎีเกรียงไกร มาเรียลัย' WHERE location = 'อ.2/8 พรรณพร หฤษฎีเกรียงไกร';
-- [renamed] 4 แถว
UPDATE weight_query SET location = 'Kmrl1/4 K.Bell มาเรียลัย' WHERE location = 'Kmrl1/4 K.Bell';
-- [renamed] 5 แถว
UPDATE weight_query SET location = 'Kmrl2/5 ครูขวัญ มาเรียลัย' WHERE location = 'Kmrl2/5 ครูขวัญ';
-- [renamed] 6 แถว
UPDATE weight_query SET location = 'Kmrl3/9 ครูนุ่น มาเรียลัย' WHERE location = 'ครูนุ่น Kmrl3/9';
-- [renamed] 3 แถว
UPDATE weight_query SET location = 'Mrl 2/2 ครูอัญญ์ มาเรียลัย' WHERE location = 'ครูอัญญ์ Mrl 2/2';
-- [renamed] 6 แถว
UPDATE weight_query SET location = 'ตลาดมีนบุรี ล็อค 118-120 บุบผา สีภูงา' WHERE location = 'บุบผา สีภูงา';
-- [renamed] 2 แถว
UPDATE weight_query SET location = 'Kmrl3/6 ครูพัชร์ มาเรียลัย' WHERE location = 'Kmrl3/6 ครูพัชร์';
-- [renamed] 3 แถว
UPDATE weight_query SET location = 'อ.2/7 บุษบา เนียมมั่นคง มาเรียลัย' WHERE location = 'อ.2/7 บุษบา  เนียมมั่นคง';
-- [renamed] 3 แถว
UPDATE weight_query SET location = 'Kmrl3/8 K.sujitta มาเรียลัย' WHERE location = 'Kmrl3/8 K.sujitta';
-- [renamed] 1 แถว
UPDATE weight_query SET location = 'อาภารัตน์ วงศ์กราย' WHERE location = 'LINE Sherry';
-- [renamed] 1 แถว
UPDATE weight_query SET location = 'จิรพัฒน์ ฐานสันโดษ' WHERE location = 'จิรพัฒน์ ฐานสันโเดษ';
-- [renamed] 1 แถว
UPDATE weight_query SET location = 'Pandora_AAA_ สุกัญญา บุตตะโยธี' WHERE location = 'Pandora_AAA_03326 บุตตะโยธี';
-- [renamed] 1 แถว
UPDATE weight_query SET location = '3/2 รสริน มาเรียลัย' WHERE location = 'รสริน 3/2';
-- [renamed] 1 แถว
UPDATE weight_query SET location = 'Pandora_AAA_1122061 ฟะแฟง' WHERE location = 'pandora_aaa_18618 คะดุน';

-- หลังแก้แล้วต้องไม่เหลือชื่อเก่าเหล่านี้อยู่
DO $$
DECLARE leftover bigint;
BEGIN
    SELECT count(*) INTO leftover FROM weight_query WHERE location IN (
        'บ้านร่วมทางฝัน 6 บจก.เเสงฟ้าก่อสร้าง',
        'บริษัท แสงฟ้าก่อสร้าง จำกัด',
        'โรงเรียน บ้านบางกะปิ',
        'ผู้รับเหมา แสงฟ้า',
        'เทพลีลาคอนโดทาวน์ ปุณรัศมิ์ ไกรอัมราเกียรติ',
        '7-11(04619) ฉันทนา(ผู้จัดการ)',
        'บ.แสงฟ้า (Holiday Inn Express S.23)',
        'KTBนฤมล วรสรวง',
        'CTB34288 โรงเรียนคลองสองต้นนุ่น ภัคธินันท์',
        'บ.แสงฟ้าก่อสร้าง65N1 รามคำแหงฮิลส์',
        'CRA ฝ่ายโครงการตามพระดำริ',
        'แสงฟ้าก่อสร้าง V.ONE TOWER',
        'CTB48392 โรงเรียนผลลีรุ่งเรือง หนองจอก',
        'บางนาตราด กม.14',
        'จารุวรรณ ลีระกุล',
        'AKA เซ็นทรัลลาดพร้าว',
        'ตลาดมีนบุรี จันท์',
        'AKA เซ็นทรัลพระราม 9',
        'OTT เซ็นทรัลลาดพร้าว',
        'บริษัท โฮมเพ้นท์ จำกัด สาขาที่ 00016 สาขารังสิต-นครนายก คลอง4',
        'CTA21191ศศพร ภู่สุด',
        'Zen Group สำนักงานใหญ่',
        'CTB36309 VRB โรงเรียนวัดทัศนารุณสุนทริการาม',
        'OTT เซ็นทรัลพระราม 9',
        'AKA แฟชั่นไอส์แลนด์',
        'ZEN แฟชั่นไอส์แลนด์',
        'AKA เซ็นทรัล เวสต์เกต',
        'OTT เมกาบางนา',
        'ZEN เซ็นทรัลลาดพร้าว',
        'AKA เซ็นทรัลพระราม 2',
        'AKA เดอะมอลล์งามวงศ์วาน',
        'ธุมวดี ปลื้มใจ',
        '67M1 บุญมิตรสีลม บ.แสงฟ้าก่อสร้าง',
        'CTA10075 โรงเรียนวัดตลิ่งชัน (ปิ่นทองสัณฐาคาร) ตลิ่งชัน',
        'โรงเรียน วัดใหม่ลำนกแขวก',
        'CTA06039 โรงเรียนวัดไทร (ถาวรพรหมานุกูล) จอมทอง',
        'CTB31261 โรงเรียนพูนสิน เพชรสุขอุปถัมภ์',
        'CTB34294 โรงเรียนวัดทองสัมฤทธิ์ -',
        'ZEN เซ็นทรัลพระราม 9',
        'CTB35306 โรงเรียนวัดปริวาศ ยานนาวา',
        'CTB46380 โรงเรียนออเงิน วรนันทน์',
        'PTT Station สาขาพระราม 2 48',
        'AKA เซ็นทรัลเวิลด์',
        'ZEN เซ็นทรัลเวิลด์',
        'AKA เดอะมอลล์ บางแค',
        'AKA ฟิวเจอร์พาร์ค รังสิต',
        'AKA เซ็นทรัล เวสต์วิลล์',
        'ศศิภรณ์ ศุภรมย์',
        'บ.แสงฟ้าก่อสร้าง 67U0 อาคารจอดรถยนต์ 2 รพ.ยันฮี',
        'CTA12090 โรงเรียนคลองรางจาก เขตทุ่งครุ',
        'ZEN เซ็นทรัลอีสต์วิลล์',
        'OTT เซ็นทรัลเวิลด์',
        'OTT เมืองทองธานี',
        'ZEN เซ็นทรัล เวสต์วิลล์',
        'ZEN เซ็นทรัลพระราม 2',
        'ZEN เดอะมอลล์ บางแค',
        'ZEN เดอะมอลล์งามวงศ์วาน',
        'Pop mart เทอร์มินอล 21',
        'OTT เดอะมอลล์งามวงศ์วาน',
        'โรงเรียน วัดเจ้าอาม',
        'นิติฯ Happy Condo G',
        'CTB28246 โรงเรียนวัดตะกล่ำ นางพัชนี คำใส',
        'OTT เซ็นทรัล เวสต์วิลล์',
        'AKA เดอะมอลล์บางกะปิ',
        'ZEN เมกาบางนา',
        'ศรัณญู หยิบศรีศิลป์',
        'ณัฐพล โพธิ์นาง',
        'OTT เซ็นทรัล เวสต์เกต',
        'OTT Zpell ฟิวเจอร์พาร์ค รังสิต',
        'AKA เซ็นทรัลปิ่นเกล้า',
        'OTT เซ็นทรัลพระราม 2',
        'ZEN Zpell ฟิวเจอร์พาร์ค รังสิต',
        'OTT เซ็นทรัลพระราม 3',
        'AKA สามย่าน',
        'AKA เมกาบางนา',
        'บริษัท สยามมิชลิน จำกัด The9 tower',
        'ZEN เดอะมอลล์บางกะปิ',
        'LAO เซ็นทรัลปิ่นเกล้า',
        'OTT เดอะมอลล์บางกะปิ',
        'OTT ศูนย์สิริกิติ์',
        'CTB26227 โรงเรียนประภาสวิทยา บึงกุ่ม',
        'บริษัท เจเนซีส เฟอร์ทิลีตี เซ็นเตอร์ จำกัด (มหาชน) สาขาสำนักงานใหญ่',
        'OTT โรบินสันลาดกระบัง',
        'อรนิชชา วรรณสุทธิ์',
        'สุพจน์ สันเพชร',
        'ZEN1 เซ็นทรัลปิ่นเกล้า',
        'CTA03017 โรงเรียนวัดคู้บอน (วัฒนานันท์อุทิศ) คลองสามวา',
        'OTT เซ็นทรัลปิ่นเกล้า',
        'CTA21191 โรงเรียนวัดเลียบราษฎร์บำรุง บางซื่อ',
        'LAO เซ็นทรัลพระราม 3',
        'ZEN เซ็นทรัลพระราม 3',
        'ZEN เมืองทองธานี',
        'OTT เซ็นทรัลอีสต์วิลล์',
        'OTT สามย่าน',
        'CTB33279 โรงเรียนวัดชัยฉิมพลี เขตภาษีเจริญ_ครูชนกนันท์',
        'วรรณิญา ศรีซังส้ม',
        'ZEN พาซิโอ ลาดกระบัง',
        'AKA เซ็นทรัลพระราม 3',
        'ZEN เซ็นทรัล เวสต์เกต',
        'Samoan Kevixien',
        'TUM สามย่าน',
        'AKA เซ็นทรัลรามอินทรา',
        'AKA เซ็นทรัลอีสต์วิลล์',
        'LINE Mum',
        'AKA โรบินสันลาดกระบัง',
        'เซ็นทรัล รามอินทรา',
        'LINE Pinnie',
        'พัชราภรณ์ รัตนโสภา',
        'CTB41349 โรงเรียนวิจิตรวิทยา วัฒนา',
        'LINE Kasemsook',
        'CTA10069 โรงเรียนชุมทางตลิ่งชัน ตลิ่งชัน',
        'บจก.แสงฟ้าก่อสร้าง โครงการไซมิส พระราม 9',
        'ZEN เพลินนารี่',
        'ZEN ศูนย์สิริกิติ์',
        'LINE 3Sondad',
        'OTT เพลินนารี่',
        'ZEN เซ็นทรัลรามอินทรา',
        'OTT เอ็มควอเทียร์',
        'ZEN เซ็นทรัลบางนา',
        'PTT Station สาขาบางบอน',
        'CTA030029 โรงเรียนสุเหร่าแสนแสบ คลองสามวา',
        'วิมล ศรีสุวรรณ',
        'PTT_.แยกประชาอุทิศ-ลาดพร้าว 102880',
        'PTT Station กล้วยน้ำไท',
        'AKA เซ็นทรัลบางนา',
        'ชาลิสา นิยมราษฎร์',
        'Kmrl 1/6 ครูนุต',
        'ปภาอร  ตันเจริญ',
        'Emmi Ssw',
        'LINE Navaporn',
        'LINE  KT',
        'ชญาน์นัทช์ พึ่งบุญ',
        'LINE  Phanphas',
        'CYU เซ็นทรัลเวิลด์',
        '(ปิด)ZEN2 เซ็นทรัลปิ่นเกล้า',
        'AKA เอ็มควอเทียร์',
        'PTT สามย่าน 103012',
        'AP Grande Pleno รามอินทรา-วงแหวน 2 (จตุโชติ24)',
        'Kmrl3/1 ครูแอร์',
        'เอื้อมพร พันธุ์ดารา',
        'natt issariyaopas',
        'LINE T JeNJi',
        'นางสาวอรทัย อาญาเมือง',
        'AKA เซ็นทรัลแจ้งวัฒนะ',
        'LY ศูนย์สิริกิติ์',
        'Melต/1 ครูนุช',
        'มณัสนันท์ สุวรรณหงษ์',
        'LINE Vira',
        'Kmrl1/7 ครูชลธิชา',
        'โรงเรียนไขศรีปราโมชอนุสรณ์ วนิดา พัฒเพ็ง',
        'LINE Penphak456',
        'Kmrl3/3 ครูทิพย์',
        'อารียา บุญอยู่',
        'Kmrl1/5 ครูเกษ',
        'Kmrl 1/1 ครูเล็ก',
        'มฆวัน  พุมดวง',
        'Kmrl2/3 ครูมณ',
        'ZEN ซีดีซี',
        'Kmrl1/2 ครูสา',
        'LINE Pin  Zaken',
        'สุทธินันท์ คําภา',
        'Kridsadathan Tiabprakhon',
        'ZEN Paseo รามคำแหง',
        'AKA ยูเนี่ยนมอลล์',
        'Kmrl 2/4 ครูอ้อ',
        'AKA ซีคอน ศรีนครินทร์',
        'เทวินทร์ นารอด',
        'ชนาภา คำทา',
        'LINE Nattanont',
        'AKA ซีคอน บางแค',
        'พรวีณา อยู่ดีรัมย์',
        'LINE Kik_PlernCheese',
        'GPMED HOUSE',
        'ZEN บีไฮฟ',
        'ZEN เซ็นทรัลแจ้งวัฒนะ',
        'KmrlALC Teacherlaoshi',
        'ZEN เดอะแจ๊ส วังหิน',
        'Nitchakarn Prapaspon',
        'OTT ราชพฤกษ์',
        'ขัติยาพร ผางเวช',
        'CYU เอ็มควอเทียร์',
        'kmrl3/4 ครูเล็ก',
        'Kmrl3/7  ครูแต๋ง',
        'LINE tabz789',
        'จิณณ์ แซ่หยาง',
        'Pandora_AAA_1300 มากทอง',
        'Kmrl ธุรการ ธิตินันท์',
        'เค คลินิกเวชกรรม สาขาอ่อนนุช',
        'ดวงฤทัย ดาวเรือง',
        'จุฑารัตน์ เจตนเสน',
        'สมชาย อัศวัตน์',
        'Markro42 รามอินทรา',
        'เตรียม2 ครูฝน',
        'OTT เดอะพรอมานาด',
        'Kmrlcafe Nattarika',
        'Pandora_AAA_8939 salee',
        'LINE D03155665',
        'LINE RinKung',
        'Kmrl1/3  ครูโสภา',
        'LINE WI2307',
        'LINE WINNER',
        'CTA24210 วัดคฤหบดี (จันทรสถิตย์)',
        'ลัดดาวรรณ บำรุงย้าน',
        'Kmrl 2/1 ครูออยจิ',
        'อ.2/8 พรรณพร หฤษฎีเกรียงไกร',
        'Kmrl1/4 K.Bell',
        'Kmrl2/5 ครูขวัญ',
        'ครูนุ่น Kmrl3/9',
        'ครูอัญญ์ Mrl 2/2',
        'บุบผา สีภูงา',
        'Kmrl3/6 ครูพัชร์',
        'อ.2/7 บุษบา  เนียมมั่นคง',
        'Kmrl3/8 K.sujitta',
        'LINE Sherry',
        'จิรพัฒน์ ฐานสันโเดษ',
        'Pandora_AAA_03326 บุตตะโยธี',
        'รสริน 3/2',
        'pandora_aaa_18618 คะดุน'
    );
    IF leftover <> 0 THEN
        RAISE EXCEPTION 'ยังเหลือ location ชื่อเก่า % แถว', leftover;
    END IF;
    RAISE NOTICE 'OK: แก้ชื่อครบ ไม่เหลือชื่อเก่า';
END $$;

COMMIT;
