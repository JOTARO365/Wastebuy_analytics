/*
 Source Server         : rockpi
 Source Server Type    : MariaDB
 Source Server Version : 100808 (10.8.8-MariaDB-1:10.8.8+maria~ubu2204)
 Source Host           : rockpi.lan:3308
 Source Schema         : thai_data

 Target Server Type    : MariaDB
 Target Server Version : 100808 (10.8.8-MariaDB-1:10.8.8+maria~ubu2204)
 File Encoding         : 65001

 Date: 21/12/2023 19:32:13
*/

-- ----------------------------
-- Table structure for thai_geographies
-- ----------------------------
-- ลบตารางหากมีอยู่แล้ว
DROP TABLE IF EXISTS thai_geographies;

-- สร้างตารางใหม่
CREATE TABLE thai_geographies (
  id SERIAL PRIMARY KEY, -- ใช้ SERIAL สำหรับคอลัมน์ที่เพิ่มขึ้นอัตโนมัติ
  name VARCHAR(255) NOT NULL
);


-- ----------------------------
-- Records of thai_geographies
-- ----------------------------
-- เริ่มการทำงานในโหมด Transaction
BEGIN;

-- เพิ่มข้อมูลลงในตาราง
INSERT INTO thai_geographies (name) VALUES ('ภาคเหนือ');
INSERT INTO thai_geographies (name) VALUES ('ภาคกลาง');
INSERT INTO thai_geographies (name) VALUES ('ภาคตะวันออกเฉียงเหนือ');
INSERT INTO thai_geographies (name) VALUES ('ภาคตะวันตก');
INSERT INTO thai_geographies (name) VALUES ('ภาคตะวันออก');
INSERT INTO thai_geographies (name) VALUES ('ภาคใต้');

-- ยืนยันการทำงานของ Transaction
COMMIT;

