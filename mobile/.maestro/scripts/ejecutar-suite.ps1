<#
.SYNOPSIS
  Ejecuta una suite de Maestro contra Expo Go en el telefono Android conectado por USB.
.DESCRIPTION
  Suite A = modo simulado (flows\simulado, la principal). Suite B = backend real local, SOLO LECTURA (flows\real).
  Antes de lanzar Maestro comprueba: adb ve un dispositivo en estado 'device', Metro responde en /status y, en la suite B,
  que adb reverse este activo y que existan las credenciales de prueba. Si algo falla, termina con un mensaje claro.
  La URL de Expo se recibe con -ExpoUrl (exp://<IP de la PC>:8081) o se detecta en tiempo de ejecucion (no se guarda).
  -Rapido desactiva las animaciones del telefono durante la suite y las restaura al terminar (animaciones.ps1).
  Suite C (escrituras reales) exige -ConfirmoEscrituras, el backend levantado con docker-compose.e2e-real.yml y cuentas de prueba.
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .maestro\scripts\ejecutar-suite.ps1 -Suite A -ExpoUrl exp://<IP de la PC>:8081
  powershell -ExecutionPolicy Bypass -File .maestro\scripts\ejecutar-suite.ps1 -Suite A -Flujo 07-medico-toma-con-riesgo
  powershell -ExecutionPolicy Bypass -File .maestro\scripts\ejecutar-suite.ps1 -Suite A -Etiquetas smoke
#>
param(
    [Parameter(Mandatory = $true)][ValidateSet('A', 'B', 'C')][string]$Suite,
    [string]$ExpoUrl,
    [string]$Flujo,
    [string]$Etiquetas,
    [switch]$ConOtpSimulado,
    [switch]$Rapido,
    [switch]$ConfirmoEscrituras
)

. "$PSScriptRoot\comun.ps1"

if ($Suite -eq 'C' -and -not $ConfirmoEscrituras) {
    Fallar 'La suite C ESCRIBE en la base de Supabase de desarrollo y llama al chatbot real. Para ejecutarla agrega -ConfirmoEscrituras (lee docs/e2e.md, seccion Suite C).'
}

$maestro = Buscar-Maestro
if (-not $maestro) { Fallar 'No encuentro Maestro (ver docs/e2e.md: instalacion y PATH). No lo instalo por ti.' }
$adb = Buscar-Adb
if (-not $adb) { Fallar 'No encuentro adb (ver docs/e2e.md: Android platform-tools).' }

Exigir-Dispositivo $adb
$url = Resolver-ExpoUrl $ExpoUrl
if (-not (Probar-Metro $url)) {
    Fallar ("Metro no responde en " + (Url-StatusDeExpo $url) + ". Arranca Metro con iniciar-expo.ps1 y comprueba que el telefono y la PC se ven (o usa el cable, docs/e2e.md).")
}

$carpeta = switch ($Suite) { 'A' { 'simulado' } 'B' { 'real' } 'C' { 'real-escritura' } }
Verificar-NombresDeFlujos @((Join-Path $script:MobileDir ".maestro\flows\$carpeta"), (Join-Path $script:MobileDir '.maestro\subflows'))
$ruta = ".maestro/flows/$carpeta"
$argsMaestro = @('-e', "EXPO_URL=$url")

if ($Suite -eq 'B') {
    # Defensa en profundidad: la suite B es SOLO LECTURA. Se niega a correr si un flujo usa controles que escriben.
    $prohibidos = 'registro-enviar|registro-confirmar|medico-toma-|inicio-registrar-toma|detalle-registrar-toma|solicitud-activar|admin-activar|alertas-enviar|alertas-confirmar|editar-guardar|medico-editar-guardar|registro-paciente-enviar|registro-medico-enviar'
    $malos = Get-ChildItem (Join-Path $script:MobileDir '.maestro\flows\real') -Filter *.yaml | Select-String -Pattern $prohibidos
    if ($malos) { Fallar 'Un flujo de la suite B usa un control que escribe. La suite B es solo de lectura.' }
    Preparar-Reverse $adb
    $claves = @('PACIENTE_CORREO', 'PACIENTE_CLAVE', 'MEDICO_CORREO', 'MEDICO_CLAVE')
    $cred = Leer-Credenciales $claves
    $faltan = @($claves | Where-Object { -not $cred.ContainsKey($_) })
    if ($faltan.Count -gt 0) {
        Fallar ("Faltan credenciales de prueba: " + ($faltan -join ', ') + ". Definelas como variables de entorno o en .maestro\.env.e2e.local (ignorado por git; ver .maestro\env.e2e.ejemplo).")
    }
    foreach ($k in $claves) { $argsMaestro += @('-e', "$k=$($cred[$k])") }
    Write-Host 'Aviso: el login real deja una fila de auditoria en Supabase (lo hace el backend en cada login).' -ForegroundColor Yellow
} elseif ($Suite -eq 'C') {
    Preparar-Reverse $adb
    $requeridas = @('PACIENTE_CORREO', 'PACIENTE_CLAVE', 'MEDICO_CORREO', 'MEDICO_CLAVE', 'E2E_PACIENTE_ID', 'E2E_CUENTAS_DE_PRUEBA')
    $cred = Leer-Credenciales ($requeridas + @('E2E_CHAT_ACTIVO', 'E2E_ESPERA_RIESGO', 'E2E_PACIENTE_NOMBRE_REGEX'))
    $faltan = @($requeridas | Where-Object { -not $cred.ContainsKey($_) })
    if ($faltan.Count -gt 0) {
        Fallar ("Faltan datos de la suite C: " + ($faltan -join ', ') + ". Definelos como variables de entorno o en .maestro\.env.e2e.local (ignorado por git; ver .maestro\env.e2e.ejemplo).")
    }
    if ($cred['E2E_CUENTAS_DE_PRUEBA'] -ne 'si') { Fallar "E2E_CUENTAS_DE_PRUEBA debe valer 'si': confirma que PACIENTE_* y MEDICO_* son cuentas de prueba." }
    if ($cred['E2E_PACIENTE_ID'] -notmatch '^[0-9]+$') { Fallar 'E2E_PACIENTE_ID debe ser el id numerico del paciente de prueba.' }
    $chatActivo = ($cred['E2E_CHAT_ACTIVO'] -eq 'si')
    if ($Flujo -match 'C4' -and -not $chatActivo) { Fallar 'El flujo C4 llama a Gemini (plan gratuito): define E2E_CHAT_ACTIVO=si para ejecutarlo.' }
    Verificar-ModoE2eReal
    Verificar-CuentaDePrueba $cred['E2E_PACIENTE_ID'] $cred['PACIENTE_CORREO']
    Mostrar-PlanDeEscrituras $chatActivo
    foreach ($k in $requeridas) { $argsMaestro += @('-e', "$k=$($cred[$k])") }
    $espera = if ($cred['E2E_ESPERA_RIESGO'] -eq 'si') { 'si' } else { 'no' }
    $argsMaestro += @('-e', "E2E_ESPERA_RIESGO=$espera")
    if ($cred.ContainsKey('E2E_PACIENTE_NOMBRE_REGEX') -and $cred['E2E_PACIENTE_NOMBRE_REGEX']) { $argsMaestro += @('-e', "E2E_PACIENTE_NOMBRE_REGEX=$($cred['E2E_PACIENTE_NOMBRE_REGEX'])") }
    if (-not $chatActivo) { $argsMaestro += @('--exclude-tags', 'chat-gemini') }
} else {
    if ($ConOtpSimulado) {
        Write-Host 'Incluye el flujo del OTP simulado (Metro debe haberse iniciado con -ConOtpSimulado).'
    } else {
        $argsMaestro += @('--exclude-tags', 'otp')
    }
}

if ($Etiquetas) { $argsMaestro += @('--include-tags', $Etiquetas) }
if ($Flujo) {
    $f = Get-ChildItem (Join-Path $script:MobileDir ".maestro\flows\$carpeta") -Filter "*$Flujo*.yaml" | Select-Object -First 1
    if (-not $f) { Fallar "No existe un flujo que contenga '$Flujo' en flows\$carpeta." }
    $ruta = ".maestro/flows/$carpeta/$($f.Name)"
}

$marca = Get-Date -Format 'yyyyMMdd-HHmmss'
$salida = ".maestro/reports/$($Suite.ToLower())-$marca"
New-Item -ItemType Directory -Force -Path (Join-Path $script:MobileDir '.maestro\reports'), (Join-Path $script:MobileDir '.maestro\screenshots') | Out-Null

Set-Location $script:MobileDir
Write-Host "Suite $Suite -> $ruta"
Write-Host "Reporte JUnit: $salida.xml | artefactos: $salida"
# En la salida de Maestro pueden verse los valores de las variables -e: usa SOLO cuentas de prueba.
$codigo = 1
try {
    if ($Rapido) { & "$PSScriptRoot\animaciones.ps1" -Desactivar }
    & $maestro test @argsMaestro --format junit --output "$salida.xml" "--test-output-dir=$salida" $ruta
    $codigo = $LASTEXITCODE
} finally {
    if ($Rapido) { & "$PSScriptRoot\animaciones.ps1" -Restaurar }
}
exit $codigo
