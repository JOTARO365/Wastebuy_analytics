<#
.SYNOPSIS
    ดัมป์ฐานข้อมูลจากเครื่องที่ใช้งานอยู่ เพื่อเอาไปตั้งเครื่องใหม่

.DESCRIPTION
    repo ไม่มีข้อมูลตั้งต้น — create_table.sql สร้างได้แค่ 14 จาก 25 ตาราง
    และไม่มีข้อมูลอ้างอิงอย่าง thai_provinces (7,451 ตำบล) หรือ materials
    ทางเดียวที่ตั้งเครื่องใหม่ได้ครบคือดัมป์จากเครื่องที่มีข้อมูลอยู่

    ไฟล์ที่ได้ใหญ่หลายร้อยเมกะไบต์ (weight_query 1.3M แถว) — ห้าม commit
    ให้ส่งผ่าน USB / network share แทน

.EXAMPLE
    .\scripts\dump-seed.ps1
    ดัมป์ทั้งฐานไปที่ wastebuy-seed-<วันที่>.dump

.EXAMPLE
    .\scripts\dump-seed.ps1 -SchemaOnly
    เอาแค่โครงสร้าง ไม่เอาข้อมูล (ไฟล์เล็ก ใช้ดูว่า schema ต่างกันตรงไหน)
#>
[CmdletBinding()]
param(
    [string]$OutFile,
    [string]$DbHost = $(if ($env:DB_HOST) { $env:DB_HOST } else { 'localhost' }),
    [int]$DbPort = $(if ($env:DB_PORT) { [int]$env:DB_PORT } else { 5432 }),
    [string]$DbName = $(if ($env:DB_NAME) { $env:DB_NAME } else { 'wastebuy-analytics' }),
    [string]$DbUser = $(if ($env:DB_USER) { $env:DB_USER } else { 'postgres' }),
    [switch]$SchemaOnly
)

$ErrorActionPreference = 'Stop'

$dumpCmd = Get-Command pg_dump -ErrorAction SilentlyContinue
$dump = if ($dumpCmd) { $dumpCmd.Source } else { $null }
if (-not $dump) {
    $dump = Get-ChildItem 'C:\Program Files\PostgreSQL\*\bin\pg_dump.exe' -ErrorAction SilentlyContinue |
            Sort-Object FullName -Descending | Select-Object -First 1 -ExpandProperty FullName
}
if (-not $dump) { throw 'ไม่พบ pg_dump — ติดตั้ง PostgreSQL หรือใส่ bin ลง PATH' }

if (-not $OutFile) {
    $stamp = Get-Date -Format 'yyyyMMdd'
    $suffix = if ($SchemaOnly) { 'schema' } else { 'seed' }
    $OutFile = Join-Path (Get-Location) "wastebuy-$suffix-$stamp.dump"
}

if (-not $env:PGPASSWORD) {
    $secure = Read-Host "รหัสผ่านของ $DbUser" -AsSecureString
    $env:PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
        [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
}

Write-Host "ดัมป์ $DbName -> $OutFile" -ForegroundColor Cyan

# -Fc = custom format บีบอัดในตัว และ pg_restore เลือกกู้ทีละตารางได้
$args = @('-h', $DbHost, '-p', $DbPort, '-U', $DbUser, '-Fc', '--no-owner',
          '--no-privileges', '-f', $OutFile)
if ($SchemaOnly) { $args += '--schema-only' }
$args += $DbName

& $dump @args
if ($LASTEXITCODE -ne 0) { throw "pg_dump ล้มเหลว (exit $LASTEXITCODE)" }

$size = (Get-Item $OutFile).Length / 1MB
Write-Host ("เสร็จ — {0:N1} MB" -f $size) -ForegroundColor Green
Write-Host @"

เอาไฟล์นี้ไปเครื่องใหม่แล้วสั่ง:
    .\scripts\setup.ps1 -DumpFile <path>\$(Split-Path -Leaf $OutFile)

อย่า commit ไฟล์นี้ลง git
"@
