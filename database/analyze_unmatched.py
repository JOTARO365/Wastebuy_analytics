"""จัดกลุ่ม location ใน weight_query ที่หา customer ไม่เจอ ว่าแก้ได้ทางไหนบ้าง"""
import os
import re
import sys

import pandas as pd
import psycopg2
from dotenv import load_dotenv

sys.stdout.reconfigure(encoding="utf-8")
load_dotenv(r"D:\claude_workspace\wastebuy_pass_automation\.env")

CSV = r"D:\claude_workspace\wastebuy_pass_automation\exports\จัดการสมาชิก.csv"
DIFF = r"D:\claude_workspace\wastebuy_pass_automation\tools\sql\insert_customers_20260814.diff.txt"
OUT = r"D:\Projects\wastebuy_e\unmatched_locations.csv"


def norm(s):
    """ตัดช่องว่างหัวท้าย ยุบช่องว่างซ้ำ ตัดวรรคตอนที่ไม่มีความหมาย"""
    s = re.sub(r"\s+", " ", str(s)).strip()
    return s.replace("\u200b", "")


conn = psycopg2.connect(
    host=os.getenv("DB_HOST"), port=os.getenv("DB_PORT"), dbname=os.getenv("DB_NAME"),
    user=os.getenv("DB_USER"), password=os.getenv("DB_PASSWORD"))
cur = conn.cursor()

cur.execute("""
    SELECT wq.location, count(*), round(sum(wq.price_per_kg)::numeric, 0),
           max(wq.purchase_date)
      FROM weight_query wq
     WHERE wq.location IS NOT NULL AND btrim(wq.location) <> ''
       AND NOT EXISTS (SELECT 1 FROM customers c WHERE c.fullname = wq.location)
     GROUP BY 1 ORDER BY 3 DESC NULLS LAST
""")
unmatched = cur.fetchall()

cur.execute("SELECT fullname, username FROM customers WHERE fullname IS NOT NULL")
by_exact, by_norm = {}, {}
for fullname, username in cur.fetchall():
    by_exact[fullname] = username
    by_norm.setdefault(norm(fullname), username)
conn.close()

# ชื่อเก่า -> ชื่อใหม่ จาก diff รอบนี้ (สมาชิกที่เปลี่ยนชื่อ)
renames = {}
if os.path.exists(DIFF):
    section = False
    for line in open(DIFF, encoding="utf-8"):
        if line.startswith("เปลี่ยนชื่อ ("):
            section = True
            continue
        if section:
            if line.startswith(("สมาชิกใหม่", "ไม่มีใน CSV", "⚠️")):
                break
            m = re.match(r"\s+(\S+):\s*(.*?)\s+->\s+(.*?)\s*$", line)
            if m:
                renames[norm(m.group(2))] = (m.group(1), m.group(3))

csv_names = set()
if os.path.exists(CSV):
    df = pd.read_csv(CSV, encoding="utf-8-sig", low_memory=False)
    csv_names = {norm(v) for v in df[df.columns[2]] if str(v).strip() not in ("", "nan")}

rows = []
buckets = {"whitespace": 0, "renamed": 0, "doubled": 0, "unknown": 0}
for location, n, kg, last_seen in unmatched:
    key = norm(location)
    verdict, target, username = "unknown", "", ""

    if key in by_norm:
        verdict, username = "whitespace", by_norm[key]
        target = next(f for f in by_exact if norm(f) == key)
    elif key in renames:
        username, target = renames[key]
        verdict = "renamed"
    else:
        half = key[: len(key) // 2].strip()
        if half and key.startswith(half) and key.endswith(half) and half in by_norm:
            verdict, username, target = "doubled", by_norm[half], half

    buckets[verdict] += 1
    rows.append({"location": location, "rows": n, "kg": kg, "last_seen": last_seen,
                 "verdict": verdict, "suggested_name": target, "username": username})

pd.DataFrame(rows).to_csv(OUT, index=False, encoding="utf-8-sig")

print(f"location ที่หา customer ไม่เจอ: {len(unmatched)} ชื่อ")
print(f"  whitespace ต่างกันเฉย ๆ : {buckets['whitespace']}")
print(f"  ชื่อถูกเปลี่ยนรอบนี้        : {buckets['renamed']}")
print(f"  ชื่อซ้ำสองรอบในช่องเดียว   : {buckets['doubled']}")
print(f"  ยังไม่รู้                 : {buckets['unknown']}")
print(f"\nรายละเอียด: {OUT}")
print(f"\nน้ำหนักรวมที่หลุดกลุ่ม: {sum(r['kg'] or 0 for r in rows):,.0f} kg")
print("\n10 อันดับแรก:")
for r in rows[:10]:
    print(f"  [{r['verdict']:<10}] {r['kg']:>8,.0f} kg  {r['location'][:44]:<44}"
          f" -> {r['suggested_name'][:30]}")
