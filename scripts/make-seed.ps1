<#
.SYNOPSIS
    สร้าง database/seed_reference.sql ใหม่จากฐานข้อมูลปัจจุบัน

.DESCRIPTION
    ข้อมูลอ้างอิง (ที่อยู่ไทย ทะเบียนสินค้า หน่วยนับ วันหยุด) มากับ repo
    เพื่อให้เครื่องใหม่ไม่ต้องรอ dump สำหรับส่วนนี้ — เหลือแค่สองตารางธุรกรรม
    ที่ต้องมาจากเครื่องที่ใช้งานอยู่

    รันตัวนี้เมื่อข้อมูลอ้างอิงเปลี่ยน (เพิ่มสินค้า เพิ่มหมวด sync วันหยุดปีใหม่)
    แล้ว commit ไฟล์ที่ได้

    **ห้ามใส่ตารางที่มีชื่อ เบอร์โทร หรือที่อยู่ของคนลงใน $TABLES**
    ไฟล์นี้ถูก commit ขึ้น git — ข้อมูลส่วนบุคคลออกไปแล้วเอากลับไม่ได้

.EXAMPLE
    .\scripts\make-seed.ps1
#>
[CmdletBinding()]
param(
    [string]$DbHost = $(if ($env:DB_HOST) { $env:DB_HOST } else { 'localhost' }),
    [int]$DbPort    = $(if ($env:DB_PORT) { [int]$env:DB_PORT } else { 5432 }),
    [string]$DbName = $(if ($env:DB_NAME) { $env:DB_NAME } else { 'wastebuy-analytics' }),
    [string]$DbUser = $(if ($env:DB_USER) { $env:DB_USER } else { 'postgres' })
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$outFile = Join-Path $root 'database\seed_reference.sql'

# ตารางที่ไม่มีข้อมูลส่วนบุคคลและไม่ใหญ่ — อ่านหมายเหตุใน .DESCRIPTION ก่อนเพิ่ม
$TABLES = @(
    'thai_geographies', 'thai_provinces', 'thai_amphures', 'thai_tambons',
    'lookup_provinces',
    'status', 'genders', 'units', 'type_materials', 'category_materials',
    'group_materials', 'materials', 'contaminations',
    'customer_groups', 'department_groups',
    'holidays'
)

$pgDumpCmd = Get-Command pg_dump -ErrorAction SilentlyContinue
$pgDump = if ($pgDumpCmd) { $pgDumpCmd.Source } else {
    Get-ChildItem 'C:\Program Files\PostgreSQL\*\bin\pg_dump.exe' -ErrorAction SilentlyContinue |
        Sort-Object FullName -Descending | Select-Object -First 1 -ExpandProperty FullName
}
if (-not $pgDump) { throw 'ไม่พบ pg_dump — ติดตั้ง PostgreSQL หรือใส่ bin ลง PATH' }
$psql = Join-Path (Split-Path -Parent $pgDump) 'psql.exe'

if (-not $env:PGPASSWORD) {
    $secure = Read-Host "รหัสผ่านของ $DbUser" -AsSecureString
    $env:PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
        [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
}
$env:PGCLIENTENCODING = 'UTF8'

$tableArgs = @()
foreach ($t in $TABLES) { $tableArgs += @('-t', "public.$t") }
$base = @('-h', $DbHost, '-p', $DbPort, '-U', $DbUser, '-d', $DbName,
          '--no-owner', '--no-privileges')

Write-Host "อ่านโครงสร้างและข้อมูลจาก $DbName ($($TABLES.Count) ตาราง)"

$schemaRaw = & $pgDump @base '--schema-only' '--no-comments' @tableArgs
if ($LASTEXITCODE -ne 0) { throw 'pg_dump --schema-only ล้มเหลว' }
$dataRaw = & $pgDump @base '--data-only' '--inserts' @tableArgs
if ($LASTEXITCODE -ne 0) { throw 'pg_dump --data-only ล้มเหลว' }

# ── โครงสร้าง: ทำให้รันซ้ำได้ ────────────────────────────────────
# แยกเป็นคำสั่งทีละอันก่อน เพราะ CREATE TABLE กินหลายบรรทัด
$statements = @()
$buf = [System.Collections.Generic.List[string]]::new()
$inStmt = $false
foreach ($line in ($schemaRaw -split "`n")) {
    $trim = $line.TrimEnd("`r").Trim()
    if (-not $inStmt -and ($trim -eq '' -or $trim.StartsWith('SET ') -or
        $trim.StartsWith('SELECT pg_catalog.set_config') -or $trim.StartsWith('--'))) {
        continue
    }
    [void]$buf.Add($line.TrimEnd("`r"))
    $inStmt = -not $trim.EndsWith(';')
    if (-not $inStmt) {
        $statements += ($buf -join "`n").Trim()
        $buf.Clear()
    }
}

$schemaOut = foreach ($stmt in $statements) {
    $s = $stmt -replace 'CREATE TABLE public\.', 'CREATE TABLE IF NOT EXISTS public.'
    $s = $s -replace 'CREATE SEQUENCE public\.', 'CREATE SEQUENCE IF NOT EXISTS public.'
    $s = $s -replace 'CREATE INDEX ', 'CREATE INDEX IF NOT EXISTS '
    $s = $s -replace 'CREATE UNIQUE INDEX ', 'CREATE UNIQUE INDEX IF NOT EXISTS '

    if ($s -match 'ADD CONSTRAINT (\S+)') {
        # ADD CONSTRAINT ไม่มี IF NOT EXISTS และดักด้วย EXCEPTION ก็ไม่พอ
        # (PK ซ้ำขึ้น invalid_table_definition ไม่ใช่ duplicate_object)
        # จึงเช็คชื่อใน pg_constraint ก่อน
        $name = $Matches[1]
        $indented = ($s -split "`n" | ForEach-Object { '        ' + $_ }) -join "`n"
        @"
DO `$c`$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '$name') THEN
$indented
    END IF;
END `$c`$;
"@
    } else {
        $s
    }
}

# ── ข้อมูล: ทุก INSERT ต้องไม่ทับของเดิม ────────────────────────
#
# ปิดบังเบอร์โทรที่หลุดมาอยู่ในช่องชื่อ — ต้นทางมีคนกรอกเบอร์ลูกค้าลงช่อง
# "ชื่อกลุ่มสมาชิก" ซึ่งเป็นข้อมูลส่วนบุคคล ไฟล์นี้ commit ขึ้น git จึงเอาออก
# เก็บ id กับรหัสกลุ่มไว้เหมือนเดิม สมาชิกที่อ้างกลุ่มนั้นจึงไม่หลุดการอ้างอิง
# (ควรให้ฝ่ายปฏิบัติการแก้ที่ต้นทางด้วย ไม่ใช่ปิดบังอย่างเดียว)
$masked = 0
$dataOut = foreach ($line in ($dataRaw -split "`n")) {
    $trim = $line.TrimEnd("`r").Trim()
    if (-not $trim.StartsWith('INSERT INTO')) { continue }
    if ($trim -match "^INSERT INTO public\.customer_groups .*'(0[689][0-9]{8})'") {
        $trim = $trim -replace "'0[689][0-9]{8}'", "'(ชื่อกลุ่มถูกปิดบัง — ต้นทางกรอกเบอร์โทร)'"
        $masked++
    }
    if ($trim.EndsWith(');')) {
        $trim.Substring(0, $trim.Length - 1) + ' ON CONFLICT DO NOTHING;'
    } else {
        $trim
    }
}

# ── sequence: ตั้งต่อจากแถวสุดท้าย เฉพาะตารางที่มีคอลัมน์ id ────
$seqOut = foreach ($t in $TABLES) {
    $hasId = & $psql '-h' $DbHost '-p' $DbPort '-U' $DbUser '-d' $DbName '-Atc' `
        "SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='$t' AND column_name='id'"
    if ($hasId -ne '1') { continue }
    "SELECT setval(pg_get_serial_sequence('public.$t', 'id'), GREATEST((SELECT max(id) FROM public.$t), 1)) WHERE pg_get_serial_sequence('public.$t', 'id') IS NOT NULL;"
}

$tableList = ($TABLES | ForEach-Object { "--     $_" }) -join "`n"

$header = @"
-- ============================================================
-- seed_reference.sql — ข้อมูลตั้งต้นที่ไม่ใช่ข้อมูลลูกค้า
--
-- เครื่องใหม่ที่ clone มาได้ตารางอ้างอิงครบทันที ไม่ต้องรอ dump
-- เหลือแค่ 2 ตารางธุรกรรมที่ยังต้องมาจากเครื่องที่ใช้งานอยู่:
--     weight_query            บิลรับซื้อจากรถ
--     weight_query_station    บิลรับซื้อที่หน้าคลัง
--
-- รันซ้ำได้ — CREATE ... IF NOT EXISTS, ADD CONSTRAINT เช็คก่อนเพิ่ม
-- และทุก INSERT มี ON CONFLICT DO NOTHING
-- ฐานที่มีข้อมูลอยู่แล้วจึงไม่ถูกแตะแม้แต่แถวเดียว
--
-- **สร้างด้วย scripts/make-seed.ps1 — อย่าแก้ไฟล์นี้ด้วยมือ**
--
-- ── ตารางในไฟล์นี้ ──
$tableList
--
-- ── ที่ไม่เอาเข้า git ──
--     weight_query, weight_query_station   ธุรกรรมจริง ใหญ่เกินกว่าจะอยู่ใน git
--     customers, booking_queue             ชื่อ เบอร์โทร ที่อยู่ของสมาชิก
--     employees, drivers, emails           ข้อมูลส่วนบุคคลของพนักงาน
--     cancelled_documents, commission_entries   ธุรกรรม + ชื่อคน
--     companies, customer_branchs          ข้อมูลบริษัทและที่ตั้งสาขา
--     stations, district_centroids         มาจาก zone_analysis ของ repo automation
--     recurring_*, item_category_overrides, ai_*   ผู้ใช้กรอกเองหรือระบบสร้างเอง
-- ============================================================

SET client_encoding = 'UTF8';

BEGIN;

SET client_min_messages = warning;

-- ── โครงสร้าง ──────────────────────────────────────────────
"@

$footer = @"

COMMIT;

DO `$seed`$
DECLARE n_tambons int; n_materials int;
BEGIN
    SELECT count(*) INTO n_tambons FROM thai_tambons;
    SELECT count(*) INTO n_materials FROM materials;
    RAISE NOTICE 'seed: thai_tambons % แถว, materials % แถว', n_tambons, n_materials;
END
`$seed`$;
"@

$body = @()
$body += $schemaOut
$body += ''
$body += '-- ── ข้อมูล ────────────────────────────────────────────────'
$body += $dataOut
$body += ''
$body += '-- ── ตั้ง sequence ต่อจากแถวสุดท้าย กัน id ชนตอนเพิ่มแถวใหม่ ──'
$body += $seqOut

$content = $header + "`n" + ($body -join "`n") + $footer
[System.IO.File]::WriteAllText($outFile, $content, [System.Text.UTF8Encoding]::new($false))

$sizeKb = [math]::Round((Get-Item $outFile).Length / 1KB)
Write-Host ""
Write-Host "เขียน database\seed_reference.sql — $sizeKb KB, $($dataOut.Count) INSERT" -ForegroundColor Green
if ($masked -gt 0) {
    Write-Host "ปิดบังเบอร์โทรที่อยู่ในช่องชื่อกลุ่ม $masked แถว" -ForegroundColor Yellow
    Write-Host "  (ต้นทางกรอกผิดช่อง — ควรแจ้งฝ่ายปฏิบัติการให้แก้ด้วย)"
}
Write-Host "ตรวจก่อน commit ว่าไม่มีชื่อ เบอร์โทร หรือที่อยู่ของคนหลุดเข้าไป"
