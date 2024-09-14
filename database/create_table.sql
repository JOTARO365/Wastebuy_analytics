
-- CREATE DATE TABLE WASTEBUY ANALYSIS


-- companies table

create TABLE companies (
    id serial PRIMARY KEY,
    name_company text
);


-- GENDER TABLE

CREATE table genders (
    id serial PRIMARY KEY,
    gender VARCHAR(100)
);

-- CUSTUMER GROUP TABLE

CREATE TABLE custumer_groups ( 
	id serial PRIMARY KEY,
	customer_group text
);

-- DEPARTMENT GROUP TABLE

CREATE TABLE department_groups (
	id serial PRIMARY KEY,
	department_group text
);


-- EMAIL TABLE

create TABLE emails (
	id serial PRIMARY KEY,
	email VARCHAR(100)
);

-- STATUS TABLE

create TABLE status (
	id serial PRIMARY KEY,
	status varchar(10)
);

-- Material group table

create table material_groups (
	id serial PRIMARY KEY,
	material_group text
);

SELECT pg_sleep(2);

-- CUSTUMER TABLE

create table custumers (
	id serial primary key,
	fname varchar(100) not null,
	lname varchar(100) not null,
	phone varchar(50) not null,
	id_customer int,
	id_gender int,
	id_email int,
	adress text,
	id_company int,
	id_provinces int,
	id_amphures int,
	id_tambons int,
	id_status int,
	foreign key (id_provinces) REFERENCES thai_provinces(id),
	foreign KEY (id_amphures) REFERENCES id_amphures(id),
	foreign KEY (id_tambons) REFERENCES thai_tambons(id),

	constraint fk_gender 
	foreign KEY (id_gender) REFERENCES genders(id)
	ON UPDATE CASCADE,

	constraint fk_company
	foreign KEY (id_company) REFERENCES companies(id)
	ON UPDATE CASCADE,

	constraint fk_customer
	foreign KEY (id_customer) REFERENCES custumer_groups(id)
	ON UPDATE CASCADE,

	constraint fk_emails
	foreign KEY (id_email) REFERENCES emails(id)
	ON UPDATE CASCADE,

	constraint fk_status
	foreign KEY (id_status) REFERENCES status(id)
	ON UPDATE CASCADE
);

-- IMPLOYEE TABLE

create TABLE imployies (
	id serial primary key,
	fname varchar(100) not null,
	lname varchar(100) not null,
	phone varchar(50) not null,
	id_department int,
	id_email int,
	id_gender int,
	adress text,
	id_company int,
	id_provinces int,
	id_amphures int,
	id_tambons int,
	id_status int,
	foreign key (id_provinces) REFERENCES thai_provinces(id),
	foreign KEY (id_amphures) REFERENCES id_amphures(id),
	foreign KEY (id_tambons) REFERENCES thai_tambons(id),

	constraint fk_gender 
	foreign KEY (id_gender) REFERENCES genders(id)
	ON UPDATE CASCADE,

	constraint fk_company
	foreign KEY (id_company) REFERENCES companies(id)
	ON UPDATE CASCADE,

	constraint fk_customer
	foreign KEY (id_department) REFERENCES department_groups(id)
	ON UPDATE CASCADE,

	constraint fk_emails
	foreign KEY (id_email) REFERENCES emails(id)
	ON UPDATE CASCADE,

	constraint fk_status
	foreign KEY (id_status) REFERENCES status(id)
	ON UPDATE CASCADE
);


-- MATERIALS TABLE 

create table materials (
	id serial PRIMARY KEY,
	name_mat varchar(50),
	id_group_mat int,
	unit varchar(20),
	price_delivery int,
	price_station int,
	price_factory INT,
	GHG int,
	constraint fk_materials
	FOREIGN KEY (id_group_mat) REFERENCES material_groups(id)
	ON UPDATE CASCADE
);



CREATE TABLE customer_branchs (
    id serial PRIMARY KEY,
    id_company int,
    name_branch varchar(20),
    code_branch VARCHAR(20),
    id_geographies int,
    num_branch int,
    address text,
    id_status INT,
    constraint fk_geographies FOREIGN KEY (id_geographies) REFERENCES thai_geographies(id) ON UPDATE CASCADE,
    constraint fk_status FOREIGN KEY (id_status) REFERENCES status(id) ON UPDATE CASCADE
);

INSERT INTO customer_branchs (id_company, name_branch, code_branch, id_geographies, num_branch, address, id_status)
VALUES 
    (1, 'S11', 'WB0001', 2, 1, '4/14 หมู่ที่ 6', 1),
    (1, 'S11', 'WB0002', 2, 2, '1288 ถนนลาดกระบัง', 1);

create table employees (
	id serial primary key,
	employee_code varchar(10) unique not null,
	fname varchar(255) not null,
	lname varchar(255) not null,
	phone varchar(50),
	id_email int,
	birth_date date,
	id_gender int,
	address text,
	id_provinces int,
	id_tambons int,
	id_amphures int,
	id_department_group int,
	id_company int,
	id_status int,
	
	constraint fk_email foreign key (id_email) references emails(id)
	on update CASCADE,
	
	constraint fk_gender foreign key (id_gender) references genders(id)
	on update CASCADE,
	
	constraint fk_department_group foreign key (id_department_group) references department_groups(id)
	on update CASCADE,
	
	constraint fk_company foreign KEY (id_company) REFERENCES companies(id)
	ON UPDATE CASCADE,

	constraint fk_status
	foreign KEY (id_status) REFERENCES status(id)
	ON UPDATE CASCADE
);

create table drivers (
	id serial primary key,
	license_code varchar(50)
);

create table scales (
	id serial primary key,
	scale_code varchar(50),
	serial_number varchar(100)
);


begin;

insert into drivers (id, license_code) values (1 ,'3ฒภ-6334');
insert into drivers (id, license_code) values (2 ,'3ฒศ-4616');
insert into drivers (id, license_code) values (3 ,'3ฒศ-4617');
insert into drivers (id, license_code) values (4 ,'3ฒศ-4619');
insert into drivers (id, license_code) values (5 ,'3ฒศ-4620');
insert into drivers (id, license_code) values (6 ,'3ฒศ-4621');
insert into drivers (id, license_code) values (7 ,'3ฒศ-6332');
insert into drivers (id, license_code) values (8 ,'3ฒศ-8614');
insert into drivers (id, license_code) values (9 ,'3ฒศ-8615');
insert into drivers (id, license_code) values (10, '3ฒศ-8616');
insert into drivers (id, license_code) values (11, '3ฒศ-8617');
insert into drivers (id, license_code) values (12, '3ฒศ-8618');
insert into drivers (id, license_code) values (13, '3ฒษ-6042');
insert into drivers (id, license_code) values (14, '3ฒษ-6043');
insert into drivers (id, license_code) values (15, '3ฒษ-6044');
insert into drivers (id, license_code) values (16, '3ฒษ-6045');
insert into drivers (id, license_code) values (17, '3ฒษ-6046');
insert into drivers (id, license_code) values (18, '3ฒษ-6047');
insert into drivers (id, license_code) values (19, '3ฒษ-6048');
insert into drivers (id, license_code) values (20, '3ฒษ-6050');
insert into drivers (id, license_code) values (21, '3ฒษ-6051');
insert into drivers (id, license_code) values (22, '3ฒส-7062');
insert into drivers (id, license_code) values (23, '3ฒส-7063');
insert into drivers (id, license_code) values (24, '3ฒส-7064');
insert into drivers (id, license_code) values (25, '3ฒส-7082');
insert into drivers (id, license_code) values (26, '3ฒส-7084');
insert into drivers (id, license_code) values (27, '3ฒส-7086');
insert into drivers (id, license_code) values (28, '3ฒส-7087');
insert into drivers (id, license_code) values (29, '3ฒส-7088');
insert into drivers (id, license_code) values (30, '3ฒส-7089');
insert into drivers (id, license_code) values (31, '3ฒส-7091');
insert into drivers (id, license_code) values (32, '3ฒห-8630');
insert into drivers (id, license_code) values (33, '3ฒห-8631');
insert into drivers (id, license_code) values (34, '3ฒห-8633');
insert into drivers (id, license_code) values (35, '3ฒห-8634');
insert into drivers (id, license_code) values (36, '3ฒห-8635');
insert into drivers (id, license_code) values (37, '3ฒห-8636');
insert into drivers (id, license_code) values (38, '3ฒห-8637');
insert into drivers (id, license_code) values (39, '3ฒห-8638');
insert into drivers (id, license_code) values (40, '3ฒห-8639');
insert into drivers (id, license_code) values (41, '3ฒห-8921');
insert into drivers (id, license_code) values (42, '3ฒฬ-7929');
insert into drivers (id, license_code) values (43, '3ฒฬ-7930');
insert into drivers (id, license_code) values (44, '3ฒฬ-7931');
insert into drivers (id, license_code) values (45, '3ฒฬ-7934');
insert into drivers (id, license_code) values (46, '3ฒฬ-7935');
insert into drivers (id, license_code) values (47, '3ฒฬ-7937');
insert into drivers (id, license_code) values (48, '3ฒฬ-7938');
insert into drivers (id, license_code) values (49, '3ฒฬ-7941');
insert into drivers (id, license_code) values (50, '3ฒฬ-8286');
insert into drivers (id, license_code) values (51, '3ฒฬ-8287');

insert into scales (id, scale_code, serial_number) values (1, 'WBS0001', NULL);
insert into scales (id, scale_code, serial_number) values (2, 'WBS0002', NULL);
insert into scales (id, scale_code, serial_number) values (3, 'WBS0003', NULL);
insert into scales (id, scale_code, serial_number) values (4, 'WBS0004', NULL);
insert into scales (id, scale_code, serial_number) values (5, 'WBS0005', NULL);
insert into scales (id, scale_code, serial_number) values (6, 'WBS0006', NULL);
insert into scales (id, scale_code, serial_number) values (7, 'WBS0007', NULL);
insert into scales (id, scale_code, serial_number) values (8, 'WBS0008', NULL);
insert into scales (id, scale_code, serial_number) values (9, 'WBS0009', NULL);
insert into scales (id, scale_code, serial_number) values (10,'WBS0010', NULL);
insert into scales (id, scale_code, serial_number) values (11,'WBS0011', NULL);
insert into scales (id, scale_code, serial_number) values (12,'WBS0012', NULL);
insert into scales (id, scale_code, serial_number) values (13,'WBS0013', NULL);
insert into scales (id, scale_code, serial_number) values (14,'WBS0014', NULL);
insert into scales (id, scale_code, serial_number) values (15,'WBS0015', NULL);
insert into scales (id, scale_code, serial_number) values (16,'WBS0016', NULL);
insert into scales (id, scale_code, serial_number) values (17,'WBS0017', NULL);
insert into scales (id, scale_code, serial_number) values (18,'WBS0018', NULL);
insert into scales (id, scale_code, serial_number) values (19,'WBS0019', NULL);
insert into scales (id, scale_code, serial_number) values (20,'WBS0020', NULL);
insert into scales (id, scale_code, serial_number) values (21,'WBS0021', NULL);
insert into scales (id, scale_code, serial_number) values (22,'WBS0022', NULL);
insert into scales (id, scale_code, serial_number) values (23,'WBS0023', NULL);
insert into scales (id, scale_code, serial_number) values (24,'WBS0024', NULL);
insert into scales (id, scale_code, serial_number) values (25,'WBS0025', NULL);
insert into scales (id, scale_code, serial_number) values (26,'WBS0026', NULL);
insert into scales (id, scale_code, serial_number) values (27,'WBS0027', NULL);
insert into scales (id, scale_code, serial_number) values (28,'WBS0028', NULL);
insert into scales (id, scale_code, serial_number) values (29,'WBS0029', NULL);
insert into scales (id, scale_code, serial_number) values (30,'WBS0030', NULL);
insert into scales (id, scale_code, serial_number) values (31,'WBS0031', NULL);
insert into scales (id, scale_code, serial_number) values (32,'WBS0032', NULL);
insert into scales (id, scale_code, serial_number) values (33,'WBS0033', NULL);
insert into scales (id, scale_code, serial_number) values (34,'WBS0034', NULL);
insert into scales (id, scale_code, serial_number) values (35,'WBS0035', NULL);
insert into scales (id, scale_code, serial_number) values (36,'WBS0036', NULL);
insert into scales (id, scale_code, serial_number) values (37,'WBS0037', NULL);
insert into scales (id, scale_code, serial_number) values (38,'WBS0038', NULL);
insert into scales (id, scale_code, serial_number) values (39,'WBS0039', NULL);
insert into scales (id, scale_code, serial_number) values (40,'WBS0040', NULL);
insert into scales (id, scale_code, serial_number) values (41,'WBS0041', NULL);
insert into scales (id, scale_code, serial_number) values (42,'WBS0042', NULL);
insert into scales (id, scale_code, serial_number) values (43,'WBS0043', NULL);
insert into scales (id, scale_code, serial_number) values (44,'WBS0044', NULL);
insert into scales (id, scale_code, serial_number) values (45,'WBS0045', NULL);
insert into scales (id, scale_code, serial_number) values (46,'WBS0046', NULL);
insert into scales (id, scale_code, serial_number) values (47,'WBS0047', NULL);
insert into scales (id, scale_code, serial_number) values (48,'WBS0048', NULL);
insert into scales (id, scale_code, serial_number) values (49,'WBS0049', NULL);
insert into scales (id, scale_code, serial_number) values (50,'WBS0050', NULL);
insert into scales (id, scale_code, serial_number) values (51,'WBS0051', NULL);

commit;


('เชียงใหม่','เชียงใหม่'),
('นครราชสีมา',	'นครราชสีมา'),
('กาญจนบุรี'	,'กาญจนบุรี'),
('ตาก'	,'ตาก'),
('อุบลราชธานี'	,'อุบลราชธานี'),
('สุราษฎร์ธานี'	,'สุราษฎร์ธานี'),
('ชัยภูมิ'	,'ชัยภูมิ'),
('แม่ฮ่องสอน',	'แม่ฮ่องสอน'),
('เพชรบูรณ์'	,'เพชรบูรณ์'),
('ลำปาง'	,'ลำปาง'),
('อุดรธานี',	'อุดรธานี'),
('เชียงราย',	'เชียงราย'),
('น่าน'	,'น่าน'),
('เลย'	,'เลย'),
('ขอนแก่น',	'ขอนแก่น'),
('พิษณุโลก',	'พิษณุโลก'),
('บุรีรัมย์',	'บุรีรัมย์'),
('นครศรีธรรมราช',	'นครศรีธรรมราช'),
('สกลนคร'	,'สกลนคร'),
('นครสวรรค์'	,'นครสวรรค์'),
('ศรีสะเกษ'	,'ศรีสะเกษ'),
('กำแพงเพชร'	,'กำแพงเพชร'),
('ร้อยเอ็ด'	,'ร้อยเอ็ด'),
('สุรินทร์'	,'สุรินทร์'),
('อุตรดิตถ์'	,'อุตรดิตถ์'),
('สงขลา'	,'สงขลา'),
('สระแก้ว',	'สระแก้ว'),
('กาฬสินธุ์'	,'กาฬสินธุ์'),
('อุทัยธานี'	,'อุทัยธานี'),
('สุโขทัย',	'สุโขทัย'),
('แพร่',	'แพร่'),
('ประจวบคีรีขันธ์',	'ประจวบคีรีขันธ์'),
('จันทบุรี'	,'จันทบุรี'),
('พะเยา'	,'พะเยา'),
('เพชรบุรี',	'เพชรบุรี'),
('ลพบุรี'	,'ลพบุรี'),
('ชุมพร'	,'ชุมพร'),
('นครพนม',	'นครพนม'),
('สุพรรณบุรี'	,'สุพรรณบุรี'),
('มหาสารคาม',	'มหาสารคาม'),
('ฉะเชิงเทรา',	'ฉะเชิงเทรา'),
('ราชบุรี'	,'ราชบุรี'),
('ตรัง'	,'ตรัง'),
('ปราจีนบุรี',	'ปราจีนบุรี'),
('กระบี่'	,'กระบี่'),
('พิจิตร'	,'พิจิตร'),
('ยะลา',	'ยะลา'),
('ลำพูน',	'ลำพูน'),
('นราธิวาส',	'นราธิวาส'),
('ชลบุรี'	,'ชลบุรี'),
('มุกดาหาร',	'มุกดาหาร'),
('บึงกาฬ',	'บึงกาฬ'),
('พังงา'	,'พังงา'),
('ยโสธร',	'ยโสธร'),
('หนองบัวลำภู',	'หนองบัวลำภู'),
('สระบุรี',	'สระบุรี'),
('ระยอง',	'ระยอง'),
('พัทลุง'	,'พัทลุง'),
('ระนอง',	'ระนอง'),
('อำนาจเจริญ',	'อำนาจเจริญ'),
('หนองคาย',	'หนองคาย'),
('ตราด'	,'ตราด'),
('พระนครศรีอยุธยา',	'พระนครศรีอยุธยา'),
('สตูล'	,'สตูล'),
('ชัยนาท',	'ชัยนาท'),
('นครปฐม'	,'นครปฐม'),
('นครนายก'	,'นครนายก'),
('ปัตตานี'	,'ปัตตานี'),
('กรุงเทพมหานคร',	'กรุงเทพมหานคร'),
('ปทุมธานี'	,'ปทุมธานี'),
('สมุทรปราการ'	,'สมุทรปราการ'),
('อ่างทอง'	,'อ่างทอง'),
('สมุทรสาคร'	,'สมุทรสาคร'),
('สิงห์บุรี',	'สิงห์บุรี'),
('นนทบุรี',	'นนทบุรี'),
('ภูเก็ต'	,'ภูเก็ต'),
('สมุทรสงคราม',	'สมุทรสงคราม');
