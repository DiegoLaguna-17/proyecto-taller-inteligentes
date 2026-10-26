<#
.SYNOPSIS
  Arranca Metro (Expo) para los recorridos de Maestro. Dejar esta ventana abierta mientras corren las suites.
.DESCRIPTION
  Usa 'npx expo start -c --port 8081' (SIN --localhost: dejo a Metro sin responder en 127.0.0.1) y no acepta otro puerto.
  -Modo simulado : EXPO_PUBLIC_USE_MOCK=true (suite A; no llama a ningun servidor).
  -Modo real     : backend y chatbot por USB (adb reverse 8000 y 8001, URLs 127.0.0.1) para la suite B (solo lectura).
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .maestro\scripts\iniciar-expo.ps1 -Modo simulado
#>
param(
    [Parameter(Mandatory = $true)][ValidateSet('simulado', 'real')][string]$Modo,
    [switch]$ConOtpSimulado
)

. "$PSScriptRoot\comun.ps1"

# Variable LOCAL para el puerto: los argumentos de npx no deben llevar variables $script: (npx.ps1 las evalua en otro ambito)
$puerto = [int]$script:PuertoMetro

if (Puerto-Ocupado $puerto) {
    Fallar "El puerto $puerto ya esta en uso (otro Metro abierto?). Cierralo: este flujo exige el 8081 fijo."
}

if ($Modo -eq 'simulado') {
    $env:EXPO_PUBLIC_USE_MOCK = 'true'
    $env:EXPO_PUBLIC_CHAT_ANIMACION = 'inmediato'   # el chatbot responde de golpe: los flujos no esperan la animacion
    $env:EXPO_PUBLIC_MOCK_LATENCIA = '0'            # sin esperas artificiales en los servicios simulados
    if ($ConOtpSimulado) { $env:EXPO_PUBLIC_SIN_OTP = 'false' } else { Remove-Item Env:\EXPO_PUBLIC_SIN_OTP -ErrorAction SilentlyContinue }
    Write-Host 'Modo SIMULADO: la app no llama a ningun servidor.' -ForegroundColor Green
} else {
    $adb = Buscar-Adb
    if (-not $adb) { Fallar 'No encuentro adb (ver docs/e2e.md: Android platform-tools).' }
    Exigir-Dispositivo $adb
    Preparar-Reverse $adb
    $env:EXPO_PUBLIC_USE_MOCK = 'false'
    $env:EXPO_PUBLIC_API_URL = 'http://127.0.0.1:8000'
    $env:EXPO_PUBLIC_NLP_URL = 'http://127.0.0.1:8001'
    Remove-Item Env:\EXPO_PUBLIC_SIN_OTP -ErrorAction SilentlyContinue
    Remove-Item Env:\EXPO_PUBLIC_CHAT_ANIMACION -ErrorAction SilentlyContinue
    Remove-Item Env:\EXPO_PUBLIC_MOCK_LATENCIA -ErrorAction SilentlyContinue
    Write-Host 'Modo REAL (solo lectura): backend en 127.0.0.1:8000 y chatbot en 127.0.0.1:8001 por adb reverse.' -ForegroundColor Yellow
    Write-Host 'El backend debe estar levantado con: docker compose -f docker-compose.yml -f docker-compose.prueba.yml up -d' -ForegroundColor Yellow
}

# Valor efectivo de las variables que deciden el modo de la app (sin secretos)
function Valor-Efectivo([string]$nombre) {
    $v = [Environment]::GetEnvironmentVariable($nombre)
    if ($v) { return $v } else { return '(no definida)' }
}
Write-Host "EXPO_PUBLIC_USE_MOCK        = $(Valor-Efectivo 'EXPO_PUBLIC_USE_MOCK')"
Write-Host "EXPO_PUBLIC_CHAT_ANIMACION  = $(Valor-Efectivo 'EXPO_PUBLIC_CHAT_ANIMACION')"
Write-Host "EXPO_PUBLIC_SIN_OTP         = $(Valor-Efectivo 'EXPO_PUBLIC_SIN_OTP')"
Write-Host "EXPO_PUBLIC_MOCK_LATENCIA  = $(Valor-Efectivo 'EXPO_PUBLIC_MOCK_LATENCIA')"

Set-Location $script:MobileDir
Write-Host "Arrancando Metro en el puerto $puerto (Ctrl+C para detener)..."
# npx.cmd (no npx.ps1): el script npx.ps1 de Node falla al evaluar variables del ambito del script llamador
& npx.cmd expo start -c --port $puerto
exit $LASTEXITCODE
