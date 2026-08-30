<#
.SYNOPSIS
    คำนวณ cache ของหน้าวิเคราะห์ใหม่ — รันหลังโหลดข้อมูลเดือนใหม่ทุกครั้ง

.DESCRIPTION
    หน้าวิเคราะห์อ่านจาก materialized view ไม่ใช่ตารางสด
    (ดูเหตุผลและตัวเลขที่วัดได้ในหัวไฟล์ database/analysis_cache.sql)
    ไม่รันตัวนี้ ตัวเลขบนหน้าเว็บจะค้างอยู่ที่รอบก่อน

    ใช้ REFRESH ... CONCURRENTLY ทีละตัว คนที่เปิดหน้าอยู่ระหว่างนี้
    ยังเห็นตัวเลขของรอบก่อนได้ ไม่ค้างรอ
    (ฟังก์ชัน refresh_analysis_cache() ใน SQL ใช้ CONCURRENTLY ไม่ได้
     เพราะทั้งฟังก์ชันคือทรานแซกชันเดียว)

.EXAMPLE
    .\scripts\refresh-cache.ps1

.EXAMPLE
    .\scripts\refresh-cache.ps1 -Full
    ใช้ REFRESH ธรรมดา เร็วกว่าเล็กน้อยแต่ล็อกตารางระหว่างทำ
#>
[CmdletBinding()]
param(
    [string]$DbHost = $(if ($env:DB_HOST) { $env:DB_HOST } else { 'localhost' }),
    [int]$DbPort    = $(if ($env:DB_PORT) { [int]$env:DB_PORT } else { 5432 }),
    [string]$DbName = $(if ($env:DB_NAME) { $env:DB_NAME } else { 'wastebuy-analytics' }),
    [string]$DbUser = $(if ($env:DB_USER) { $env:DB_USER } else { 'postgres' }),
    [switch]$Full
)

$ErrorActionPreference = 'Stop'

$psqlCmd = Get-Command psql -ErrorAction SilentlyContinue
$psql = if ($psqlCmd) { $psqlCmd.Source } else {
    Get-ChildItem 'C:\Program Files\PostgreSQL\*\bin\psql.exe' -ErrorAction SilentlyContinue |
        Sort-Object FullName -Descending | Select-Object -First 1 -ExpandProperty FullName
}
if (-not $psql) { throw 'ไม่พบ psql — ติดตั้ง PostgreSQL หรือใส่ bin ลง PATH' }

if (-not $env:PGPASSWORD) {
    $secure = Read-Host "รหัสผ่านของ $DbUser" -AsSecureString
    $env:PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
        [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
}

$args = @('-h', $DbHost, '-p', $DbPort, '-U', $DbUser, '-d', $DbName, '-v', 'ON_ERROR_STOP=1')

# ลำดับเดียวกับ refresh_analysis_cache() — ราคากลางต้องมาก่อนผลงานคนขับ
# ไม่งั้นคนขับถูกวัดด้วยราคากลางของรอบก่อน
$views = @(
    'v_item_price_benchmark',
    'mv_item_category',
    'mv_unknown_items',
    'mv_member_activity',
    'mv_station_performance',
    'mv_station_materials',
    'mv_station_monthly',
    'mv_station_coverage',
    'mv_month_facts',
    'mv_driver_performance',
    'mv_driver_monthly',
    'mv_zone_member_summary',
    'mv_booking_by_ring'
)

Write-Host "refresh cache ที่ $DbHost`:$DbPort/$DbName`n" -ForegroundColor Cyan

$total = [Diagnostics.Stopwatch]::StartNew()
$skipped = 0
$failed = @()

foreach ($v in $views) {
    $exists = & $psql @args -Atc "SELECT to_regclass('public.$v') IS NOT NULL"
    if ($exists -ne 't') {
        Write-Host "  ข้าม  $v (ยังไม่มี)" -ForegroundColor DarkGray
        $skipped++
        continue
    }

    # v_item_price_benchmark ไม่มี unique index จึงใช้ CONCURRENTLY ไม่ได้
    $mode = if ($Full -or $v -eq 'v_item_price_benchmark') { '' } else { 'CONCURRENTLY ' }

    $sw = [Diagnostics.Stopwatch]::StartNew()
    $ErrorActionPreference = 'Continue'
    $out = & $psql @args -c "REFRESH MATERIALIZED VIEW $mode$v;" 2>&1
    $code = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'
    $sw.Stop()

    if ($code -eq 0) {
        Write-Host ("  ok    {0,-24} {1,6:N0} ms" -f $v, $sw.ElapsedMilliseconds) -ForegroundColor Green
    } else {
        Write-Host "  พลาด  $v" -ForegroundColor Red
        $out | ForEach-Object { Write-Host "        $_" -ForegroundColor DarkGray }
        $failed += $v
    }
}

$total.Stop()

# บันทึกเวลาไว้ให้หน้าเว็บบอกได้ว่าตัวเลขคำนวณเมื่อไร
if ($failed.Count -eq 0) {
    & $psql @args -c "INSERT INTO analysis_cache_log (detail) VALUES ('{""via"":""refresh-cache.ps1""}'::jsonb);" | Out-Null
}

Write-Host ""
if ($failed.Count) {
    Write-Host "เสร็จแบบมีปัญหา — พลาด $($failed -join ', ')" -ForegroundColor Red
    exit 1
}
Write-Host ("เสร็จ {0:N1} วินาที{1}" -f ($total.Elapsed.TotalSeconds),
            $(if ($skipped) { " · ข้าม $skipped ตัวที่ยังไม่มี" } else { '' })) -ForegroundColor Green
