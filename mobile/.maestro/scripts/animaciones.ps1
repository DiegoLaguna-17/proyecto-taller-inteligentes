<#
.SYNOPSIS
  Desactiva o restaura las animaciones del sistema Android del telefono conectado (acelera los recorridos de Maestro).
.DESCRIPTION
  Ajusta window_animation_scale, transition_animation_scale y animator_duration_scale con adb.
  -Desactivar guarda los valores previos en .maestro\reports\animaciones-previas.json (ignorado por git) y los pone en 0.
  -Restaurar vuelve a los valores guardados (o a 1.0 si no habia). Si olvidas restaurar, hazlo a mano en el telefono:
  Ajustes > Opciones de desarrollador > Escala de animacion de ventana / de transicion / de duracion del animador.
  Usalo solo con un telefono de pruebas y restauralo al terminar (ejecutar-suite.ps1 -Rapido lo hace por ti).
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .maestro\scripts\animaciones.ps1 -Desactivar
  powershell -ExecutionPolicy Bypass -File .maestro\scripts\animaciones.ps1 -Restaurar
#>
param(
    [switch]$Desactivar,
    [switch]$Restaurar
)

. "$PSScriptRoot\comun.ps1"

if (($Desactivar -and $Restaurar) -or (-not $Desactivar -and -not $Restaurar)) {
    Fallar 'Usa exactamente uno: -Desactivar o -Restaurar.'
}

$adb = Buscar-Adb
if (-not $adb) { Fallar 'No encuentro adb (ver docs/e2e.md: Android platform-tools).' }
Exigir-Dispositivo $adb

$ajustes = @('window_animation_scale', 'transition_animation_scale', 'animator_duration_scale')
$archivo = Join-Path $script:MobileDir '.maestro\reports\animaciones-previas.json'

function Leer-Ajuste([string]$nombre) {
    $v = (Invocar-Nativo $adb @('shell', 'settings', 'get', 'global', $nombre) | Select-Object -First 1)
    if ($null -eq $v) { return '1.0' }
    $v = "$v".Trim()
    if ($v -match '^\d+(\.\d+)?$') { return $v }
    return '1.0'   # "null" = valor por defecto del sistema
}

function Poner-Ajuste([string]$nombre, [string]$valor) {
    Invocar-Nativo $adb @('shell', 'settings', 'put', 'global', $nombre, $valor) | Out-Null
}

if ($Desactivar) {
    $dir = Split-Path $archivo
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    # No se pisan los valores previos si ya estaban desactivadas (una segunda llamada no debe perder los originales)
    if (-not (Test-Path $archivo)) {
        $previos = @{}
        foreach ($a in $ajustes) { $previos[$a] = Leer-Ajuste $a }
        $previos | ConvertTo-Json | Set-Content -Path $archivo -Encoding ASCII
    }
    foreach ($a in $ajustes) { Poner-Ajuste $a '0' }
    Write-Host 'Animaciones desactivadas (escala 0). Restauralas con: animaciones.ps1 -Restaurar' -ForegroundColor Yellow
} else {
    $previos = @{}
    if (Test-Path $archivo) {
        $obj = Get-Content $archivo -Raw | ConvertFrom-Json
        foreach ($a in $ajustes) { if ($obj.$a) { $previos[$a] = [string]$obj.$a } }
    }
    foreach ($a in $ajustes) {
        $valor = if ($previos.ContainsKey($a)) { $previos[$a] } else { '1.0' }
        Poner-Ajuste $a $valor
    }
    if (Test-Path $archivo) { Remove-Item $archivo -Force }
    Write-Host 'Animaciones restauradas.' -ForegroundColor Green
}
foreach ($a in $ajustes) { Write-Host ("  {0} = {1}" -f $a, (Leer-Ajuste $a)) }
