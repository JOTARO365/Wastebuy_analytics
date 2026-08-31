<#
.SYNOPSIS
    ตั้งค่าเครื่องใหม่ให้รัน Wastebuy Analytics ได้

.DESCRIPTION
    รันซ้ำได้ ไม่ลบอะไรทิ้งโดยไม่ถาม ทำตามลำดับ:
      1. ตรวจว่ามี node / npm / psql
      2. npm install
      3. สร้าง .env จาก .env.example ถ้ายังไม่มี
      4. สร้างฐานข้อมูลถ้ายังไม่มี
      5. กู้ข้อมูลจาก dump (เฉพาะเครื่องเปล่า)
      6. โหลดตารางวิเคราะห์โซน ถ้าระบุ -ZoneSql (ต้องมาก่อนข้อ 7)
      7. รัน database/migrate.sql — ตาราง view และ cache ทั้งหมดในไฟล์เดียว
      8. ตรวจว่าตาราง/view ครบไหม

    เครื่องที่มีข้อมูลอยู่แล้วใช้แค่ข้อ 1-3 และ 6-8 — ไม่ต้องมี dump

.EXAMPLE
    .\scripts\setup.ps1
    เครื่องที่มีข้อมูลอยู่แล้ว — ลงเฉพาะของที่เพิ่มมาใหม่ (กรณีปกติ)

.EXAMPLE
    .\scripts\setup.ps1 -ZoneSql D:\zone_analysis_20260829.sql
    ลงของใหม่พร้อมโหลดตารางวิเคราะห์โซน

.EXAMPLE
    .\scripts\setup.ps1 -DumpFile D:\wastebuy-seed.dump
    เครื่องเปล่าที่ยังไม่มีฐานข้อมูลเลย
#>
[CmdletBinding()]
param(
    [string]$DumpFile,
    [string]$ZoneSql,
    [string]$DbHost = $(if ($env:DB_HOST) { $env:DB_HOST } else { 'localhost' }),
    [int]$DbPort = $(if ($env:DB_PORT) { [int]$env:DB_PORT } else { 5432 }),
    [string]$DbName = $(if ($env:DB_NAME) { $env:DB_NAME } else { 'wastebuy-analytics' }),
    [string]$DbUser = $(if ($env:DB_USER) { $env:DB_USER } else { 'postgres' }),
    [switch]$SkipInstall,
    [switch]$SkipDatabase
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

# psql เขียน NOTICE/WARNING ลง stderr ซึ่ง PowerShell นับเป็น error เมื่อ
# ErrorActionPreference = Stop ทำให้สคริปต์หยุดทั้งที่ SQL สำเร็จ
# (เช่น "relation ... already exists, skipping" ตอนรันซ้ำ)
# จึงรวม stderr เข้า stdout แล้วตัดสินจาก exit code เท่านั้น
function Invoke-SqlFile {
    param([string]$Exe, [string[]]$BaseArgs, [string]$Database, [string]$File)
    # ต้องตั้งในขอบเขตของฟังก์ชันเอง ค่า Stop จากสโคปนอกยังมีผลกับ 2>&1
    $ErrorActionPreference = 'Continue'
    $output = & $Exe @BaseArgs -d $Database -f $File 2>&1
    if ($LASTEXITCODE -ne 0) {
        $output | ForEach-Object { Write-Host "      $_" -ForegroundColor DarkGray }
        return $false
    }
    return $true
}

function Write-Step($text) { Write-Host "`n=== $text" -ForegroundColor Cyan }
function Write-Ok($text)   { Write-Host "  [ok] $text" -ForegroundColor Green }
function Write-Warn($text) { Write-Host "  [!]  $text" -ForegroundColor Yellow }
function Write-Fail($text) { Write-Host "  [x]  $text" -ForegroundColor Red }

# ── 1. เครื่องมือที่ต้องมี ──────────────────────────────────────
Write-Step 'ตรวจเครื่องมือ'

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) { throw 'ไม่พบ node — ติดตั้ง Node.js 18 ขึ้นไปก่อน https://nodejs.org' }
Write-Ok "node $(node --version)"

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { throw 'ไม่พบ npm' }
Write-Ok "npm $(npm --version)"

# psql ไม่ได้อยู่ใน PATH เสมอบน Windows — หาในที่ที่ installer วางไว้ด้วย
$psqlCmd = Get-Command psql -ErrorAction SilentlyContinue
$psql = if ($psqlCmd) { $psqlCmd.Source } else { $null }
if (-not $psql) {
    $psql = Get-ChildItem 'C:\Program Files\PostgreSQL\*\bin\psql.exe' -ErrorAction SilentlyContinue |
            Sort-Object FullName -Descending | Select-Object -First 1 -ExpandProperty FullName
}
if (-not $psql -and -not $SkipDatabase) {
    throw 'ไม่พบ psql — ติดตั้ง PostgreSQL 15+ หรือใส่ bin ลง PATH แล้วรันใหม่'
}
if ($psql) {
    $pgBin = Split-Path -Parent $psql
    Write-Ok "psql $psql"
}

# ── 2. npm install ────────────────────────────────────────────
if ($SkipInstall) {
    Write-Step 'ข้าม npm install (-SkipInstall)'
} else {
    Write-Step 'ติดตั้ง dependency'
    Push-Location $root
    try {
        # ci ใช้ package-lock.json ตรง ๆ ได้ผลเหมือนกันทุกเครื่อง
        if (Test-Path (Join-Path $root 'package-lock.json')) { npm ci } else { npm install }
        if ($LASTEXITCODE -ne 0) { throw "npm ล้มเหลว (exit $LASTEXITCODE)" }
    } finally { Pop-Location }
    Write-Ok 'ติดตั้งครบ'
}

# ── 3. .env ───────────────────────────────────────────────────
Write-Step 'ไฟล์ตั้งค่า'
$envPath = Join-Path $root '.env'
$examplePath = Join-Path $root '.env.example'
if (Test-Path $envPath) {
    Write-Ok '.env มีอยู่แล้ว ไม่แตะ'
} elseif (Test-Path $examplePath) {
    Copy-Item $examplePath $envPath
    Write-Ok 'สร้าง .env จาก .env.example — ต้องใส่ DB_PASSWORD เอง'
} else {
    Write-Warn 'ไม่พบ .env.example'
}

if ($SkipDatabase) {
    Write-Step 'ข้ามขั้นตอนฐานข้อมูล (-SkipDatabase)'
    Write-Host "`nเสร็จ — สั่ง npm run dev และ npm run dev:web`n"
    exit 0
}

# ── 4. ฐานข้อมูล ──────────────────────────────────────────────
Write-Step "ฐานข้อมูล $DbName ที่ $DbHost`:$DbPort"

if (-not $env:PGPASSWORD) {
    $secure = Read-Host "รหัสผ่านของ $DbUser" -AsSecureString
    $env:PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
        [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
}

$psqlArgs = @('-h', $DbHost, '-p', $DbPort, '-U', $DbUser, '-v', 'ON_ERROR_STOP=1')

$exists = & $psql @psqlArgs -d postgres -Atc `
    "SELECT 1 FROM pg_database WHERE datname = '$DbName'"
if ($LASTEXITCODE -ne 0) { throw 'เชื่อมต่อ PostgreSQL ไม่ได้ — ตรวจ host/port/รหัสผ่าน' }

if ($exists -eq '1') {
    Write-Ok 'ฐานข้อมูลมีอยู่แล้ว'
} else {
    # ใช้ createdb แทน psql -c "CREATE DATABASE ..." เพราะ Windows PowerShell
    # ตัดเครื่องหมายคำพูดใน argument ที่ส่งให้ native exe ชื่อฐานที่มีขีดกลาง
    # จึงกลายเป็น syntax error ส่วน createdb รับชื่อเป็น argument ตรง ๆ
    $createdb = Join-Path $pgBin 'createdb.exe'
    & $createdb -h $DbHost -p $DbPort -U $DbUser -E UTF8 $DbName
    if ($LASTEXITCODE -ne 0) { throw 'สร้างฐานข้อมูลไม่สำเร็จ' }
    Write-Ok 'สร้างฐานข้อมูลแล้ว'
}

# ── 5. กู้ข้อมูลจาก dump ──────────────────────────────────────
if ($DumpFile) {
    Write-Step "กู้ข้อมูลจาก $DumpFile"
    if (-not (Test-Path $DumpFile)) { throw "ไม่พบไฟล์ $DumpFile" }

    $tableCount = & $psql @psqlArgs -d $DbName -Atc `
        "SELECT count(*) FROM pg_tables WHERE schemaname = 'public'"
    if ([int]$tableCount -gt 0) {
        Write-Warn "ฐานข้อมูลมี $tableCount ตารางอยู่แล้ว การกู้จะเขียนทับของเดิม"
        $answer = Read-Host 'พิมพ์ yes เพื่อกู้ทับ (อย่างอื่น = ข้าม)'
        if ($answer -ne 'yes') {
            Write-Warn 'ข้ามการกู้ข้อมูล'
            $DumpFile = $null
        }
    }

    if ($DumpFile) {
        $restore = Join-Path $pgBin 'pg_restore.exe'
        # --clean ให้รันซ้ำได้ --no-owner กันปัญหาชื่อ role ต่างเครื่อง
        & $restore -h $DbHost -p $DbPort -U $DbUser -d $DbName `
            --clean --if-exists --no-owner --no-privileges $DumpFile 2>&1 |
            Out-Null
        # pg_restore คืน 1 เมื่อมี warning ที่ไม่ร้ายแรง (เช่น DROP ของที่ไม่มี)
        if ($LASTEXITCODE -gt 1) { throw "pg_restore ล้มเหลว (exit $LASTEXITCODE)" }
        Write-Ok 'กู้ข้อมูลแล้ว'
    }
} else {
    # ไม่มี dump ไม่ได้แปลว่าผิด — เครื่องที่ใช้งานอยู่มีข้อมูลอยู่แล้ว
    # ต้องแยกให้ออกว่าฐานมีของอยู่ (ปกติ) หรือว่างเปล่าจริง (ต้องหา dump)
    $hasBase = & $psql @psqlArgs -d $DbName -Atc `
        "SELECT to_regclass('public.weight_query') IS NOT NULL"
    if ($hasBase -eq 't') {
        Write-Step 'ฐานข้อมูลมีอยู่แล้ว — ลงเฉพาะของที่เพิ่มมาใหม่'
        Write-Ok 'ไม่ต้องใช้ dump'
    } else {
        Write-Step 'ฐานข้อมูลว่าง และไม่ได้ระบุ -DumpFile'
        Write-Warn 'repo สร้างฐานเองไม่ได้ — create_table.sql ทำได้แค่ 14 จาก 25 ตาราง'
        Write-Host '       และไม่มีข้อมูลอ้างอิงอย่าง thai_provinces / materials อยู่ใน git'
        Write-Host '       ให้เครื่องที่ใช้งานอยู่รัน scripts\dump-seed.ps1 แล้วส่งไฟล์มา'
    }
}

# ── 6. ตารางวิเคราะห์โซน (ถ้ามีไฟล์) ─────────────────────────
# ต้องมาก่อน migrate.sql เสมอ ไฟล์นี้ขึ้นต้นด้วย DROP TABLE ... CASCADE
# ซึ่งลบ view ที่ migrate สร้างไว้ทิ้ง — รันสลับกันแล้ว view หายเงียบ ๆ
$hasWeight = & $psql @psqlArgs -d $DbName -Atc `
    "SELECT to_regclass('public.weight_query') IS NOT NULL"

if ($ZoneSql) {
    Write-Step 'โหลดตารางวิเคราะห์โซน'
    if (-not (Test-Path $ZoneSql)) { throw "ไม่พบไฟล์ $ZoneSql" }
    if (-not (Invoke-SqlFile $psql $psqlArgs $DbName $ZoneSql)) {
        throw 'โหลดตารางโซนไม่สำเร็จ'
    }
    Write-Ok 'ตารางโซนพร้อม'
} else {
    Write-Step 'ไม่ได้ระบุ -ZoneSql'
    Write-Host '       หน้า Zone Coverage / Zone Members จะยังว่าง (ส่วนอื่นใช้ได้ปกติ)'
    Write-Host '       ไฟล์มาจาก repo automation: tools\scripts\generate_zone_analysis_sql.py'
    Write-Host '       โหลดเมื่อไรให้รัน .\scripts\setup.ps1 ซ้ำ ระบบจะเติมส่วนที่เหลือให้เอง'
}

# ── 7. ฐานข้อมูลทั้งชุด ───────────────────────────────────────
# migrate.sql รวมทุกไฟล์ไว้ตามลำดับที่ถูกต้องแล้ว (ดูหัวไฟล์นั้น)
# ที่นี่จึงเหลือเรียกตัวเดียว — เพิ่มไฟล์ SQL ใหม่ให้ไปต่อใน migrate.sql
# ไม่ใช่มาเพิ่มขั้นตอนตรงนี้ ไม่งั้นสองที่จะเริ่มไม่ตรงกัน
Write-Step 'สร้างตาราง/view ทั้งหมด'

if ($hasWeight -eq 't') {
    $migrateSql = Join-Path $root ('database' + [char]92 + 'migrate.sql')
    if (-not (Invoke-SqlFile $psql $psqlArgs $DbName $migrateSql)) {
        throw 'migrate.sql ไม่สำเร็จ — ดู log ด้านบนว่าหยุดที่ขั้นไหน'
    }
    Write-Ok 'ตาราง view และ cache พร้อมครบ'

    # วันหยุดว่างอยู่ ปฏิทินจะไม่รู้ว่าวันไหนหยุด
    $holidayCount = & $psql @psqlArgs -d $DbName -Atc 'SELECT count(*) FROM holidays'
    if ([int]$holidayCount -eq 0) {
        Write-Warn 'ยังไม่มีวันหยุดในฐาน — กดปุ่ม "ดึงวันหยุด" ในหน้า Recurring Jobs'
        Write-Host '       หรือเพิ่มเองทีละวันด้วยปุ่ม + วันหยุด'
    } else {
        Write-Ok "วันหยุด $holidayCount วัน"
    }

    Write-Host '       cache คำนวณครั้งแรกไว้แล้ว'
    Write-Host '       หลังจากนี้ระบบตรวจและคำนวณใหม่เองทุก 15 นาทีเมื่อข้อมูลเปลี่ยน'
} else {
    Write-Warn 'ยังไม่มีตาราง weight_query — ข้าม (ต้องกู้ข้อมูลจาก dump ก่อน)'
}

# ── 8. ตรวจความพร้อม ─────────────────────────────────────────
Write-Step 'ตรวจความพร้อม'

$checks = @(
    @{ name = 'weight_query';          kind = 'table'; need = $true  },
    @{ name = 'customers';             kind = 'table'; need = $true  },
    @{ name = 'materials';             kind = 'table'; need = $true  },
    @{ name = 'thai_amphures';         kind = 'table'; need = $true  },
    @{ name = 'v_driver_performance';  kind = 'view';  need = $true  },
    @{ name = 'recurring_jobs';        kind = 'table'; need = $true  },
    @{ name = 'holidays';              kind = 'table'; need = $true  },
    @{ name = 'v_recurring_status';    kind = 'view';  need = $true  },
    @{ name = 'item_category_overrides'; kind = 'table'; need = $true },
    @{ name = 'mv_member_activity';    kind = 'view';  need = $true  },
    @{ name = 'mv_month_facts';        kind = 'view';  need = $true  },
    @{ name = 'booking_queue';         kind = 'table'; need = $false },
    @{ name = 'stations';              kind = 'table'; need = $false },
    @{ name = 'v_zone_member_summary'; kind = 'view';  need = $false }
)

$missingRequired = 0
foreach ($check in $checks) {
    $rows = & $psql @psqlArgs -d $DbName -Atc `
        "SELECT CASE WHEN to_regclass('public.$($check.name)') IS NULL THEN 'missing'
                     ELSE 'ok' END"
    if ($rows -eq 'ok') {
        $count = & $psql @psqlArgs -d $DbName -Atc "SELECT count(*) FROM $($check.name)"
        Write-Ok "$($check.name) — $count แถว"
    } elseif ($check.need) {
        Write-Fail "$($check.name) ไม่มี (จำเป็น)"
        $missingRequired++
    } else {
        Write-Warn "$($check.name) ไม่มี (ไม่บังคับ — มาจาก zone_analysis_*.sql)"
    }
}

Write-Host ''
if ($missingRequired -gt 0) {
    Write-Fail "ยังขาดของจำเป็น $missingRequired อย่าง"
    if ($hasBase -ne 't' -and -not $DumpFile) {
        Write-Host '  ฐานยังว่าง — ขอ dump จากเครื่องที่ใช้งานอยู่ แล้วรันซ้ำด้วย -DumpFile'
    } else {
        Write-Host '  ตรวจ log ด้านบนว่าขั้นไหนพลาด แล้วรันสคริปต์นี้ซ้ำ'
    }
} else {
    Write-Host 'พร้อมใช้งาน' -ForegroundColor Green
}

Write-Host @'

เปิดใช้งาน:
    npm start          เปิดทั้ง API และเว็บให้เอง
                       แล้วเข้า http://localhost:3000 (ปิดด้วย Ctrl+C ทีเดียว)

สำหรับคนที่แก้โค้ด:
    npm run dev        API  :4000  (รีสตาร์ทเองเมื่อแก้ไฟล์)
    npm run dev:web    เว็บ :3000
หรือ
    pm2 start ecosystem.config.cjs

ตรวจสถานะ: http://localhost:3000/health
'@
