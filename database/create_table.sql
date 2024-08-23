
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
	foreign KEY (id_amphures) REFERENCES (id),
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
	foreign KEY (id_amphures) REFERENCES (id),
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

