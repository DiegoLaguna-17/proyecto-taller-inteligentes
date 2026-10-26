# Funciones comunes de los scripts de E2E (docs/e2e.md). Se cargan con: . "$PSScriptRoot\comun.ps1"
# Windows PowerShell 5.1. Sin tildes a proposito (el archivo se lee con la codificacion del sistema).
# Ningun script escribe la IP de la PC ni credenciales en disco, y ninguno las imprime.

$ErrorActionPreference = 'Stop'
$script:MobileDir = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$script:PuertoMetro = 8081

function Fallar([string]$mensaje) {
    Write-Host ''
    Write-Host "ERROR: $mensaje" -ForegroundColor Red
    exit 1
}

function Buscar-Adb {
    $cmd = Get-Command adb -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $candidatos = @()
    foreach ($raiz in @($env:ANDROID_HOME, $env:ANDROID_SDK_ROOT, (Join-Path $env:LOCALAPPDATA 'Android\Sdk'))) {
        if ($raiz) { $candidatos += (Join-Path $raiz 'platform-tools\adb.exe') }
    }
    foreach ($c in $candidatos) { if (Test-Path $c) { return $c } }
    return $null
}

# Ejecuta un programa nativo y devuelve sus lineas (stdout y stderr) como texto, sin que el stderr aborte el script en PowerShell 5.1.
function Invocar-Nativo([string]$exe, [string[]]$argumentos) {
    $previo = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try { return @(& $exe @argumentos 2>&1 | ForEach-Object { "$_" }) } finally { $ErrorActionPreference = $previo }
}

function Buscar-Maestro {
    $cmd = Get-Command maestro -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $c = Join-Path $env:USERPROFILE '.maestro\bin\maestro.bat'
    if (Test-Path $c) { return $c }
    return $null
}

# Exige un dispositivo Android en estado "device" (no "unauthorized" ni "offline").
function Exigir-Dispositivo([string]$adb) {
    $lineas = @(Invocar-Nativo $adb @('devices') | Where-Object { $_ -match '\s(device|unauthorized|offline|no permissions)$' })
    $listos = @($lineas | Where-Object { $_ -match "\sdevice$" })
    if ($listos.Count -eq 0) {
        $estado = ($lineas | ForEach-Object { ($_ -split '\s+')[1] } | Select-Object -Unique) -join ', '
        if (-not $estado) { $estado = 'ninguno conectado' }
        Fallar "adb no ve ningun dispositivo en estado 'device' (estado: $estado). Conecta el telefono por USB, activa la depuracion USB y acepta la autorizacion en el telefono."
    }
    if ($listos.Count -gt 1) {
        Fallar 'Hay mas de un dispositivo conectado: deja solo uno (Maestro y adb usarian el equivocado).'
    }
}

# IPv4 de la PC en la red (la de la interfaz con puerta de enlace). No se guarda ni se imprime.
function Detectar-IpPc {
    try {
        $cfg = Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -and $_.IPv4Address }
        $ip = ($cfg | Select-Object -First 1).IPv4Address.IPAddress
        if ($ip -and $ip -notlike '169.254.*' -and $ip -ne '127.0.0.1') { return $ip }
    } catch { }
    return $null
}

# Devuelve la URL de Expo: la recibida por parametro o, si no, exp://<IP detectada>:8081
function Resolver-ExpoUrl([string]$expoUrl) {
    if ($expoUrl) {
        if ($expoUrl -notmatch '^exp://[^/:\s]+:\d+/?$') {
            Fallar "ExpoUrl invalida. Usa el formato exp://<IP de la PC>:$script:PuertoMetro"
        }
        return $expoUrl.TrimEnd('/')
    }
    $ip = Detectar-IpPc
    if (-not $ip) {
        Fallar "No pude detectar la IPv4 de la PC. Pasala con -ExpoUrl exp://<IP de la PC>:$script:PuertoMetro (la ves con ipconfig)."
    }
    return "exp://${ip}:$script:PuertoMetro"
}

# Content llega como texto (PowerShell 7) o como arreglo de bytes (Windows PowerShell 5.1): se convierte a texto en ambos casos.
function Convertir-ATexto($contenido) {
    if ($null -eq $contenido) { return '' }
    if ($contenido -is [string]) { return $contenido }
    if ($contenido -is [byte[]]) { return [System.Text.Encoding]::UTF8.GetString($contenido) }
    if ($contenido -is [System.Array]) {
        try { return [System.Text.Encoding]::UTF8.GetString([byte[]]$contenido) } catch { return (($contenido | ForEach-Object { "$_" }) -join '') }
    }
    return [string]$contenido
}

# exp://host:puerto  ->  http://host:puerto/status
function Url-StatusDeExpo([string]$expoUrl) {
    $hostPuerto = ($expoUrl -replace '^exp://', '').TrimEnd('/')
    return "http://$hostPuerto/status"
}

# Metro esta vivo si /status responde 200 y (el cuerpo dice packager-status:running o trae la cabecera X-React-Native-Project-Root).
function Probar-Metro([string]$expoUrl) {
    $url = Url-StatusDeExpo $expoUrl
    try {
        $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 5
    } catch { return $false }
    if ([int]$r.StatusCode -ne 200) { return $false }
    if ((Convertir-ATexto $r.Content) -match 'packager-status:running') { return $true }
    return [bool]($r.Headers -and ($r.Headers.Keys -contains 'X-React-Native-Project-Root'))
}

function Puerto-Ocupado([int]$puerto) {
    $c = Get-NetTCPConnection -LocalPort $puerto -State Listen -ErrorAction SilentlyContinue
    return [bool]$c
}

# adb reverse para el backend (8000) y el chatbot (8001): el telefono los ve en 127.0.0.1
function Preparar-Reverse([string]$adb) {
    foreach ($p in 8000, 8001) { Invocar-Nativo $adb @('reverse', "tcp:$p", "tcp:$p") | Out-Null }
    $lista = (Invocar-Nativo $adb @('reverse', '--list')) -join "`n"
    foreach ($p in 8000, 8001) {
        if ($lista -notmatch "tcp:$p\s+tcp:$p") { Fallar "adb reverse no quedo activo para el puerto $p (revisa 'adb reverse --list')." }
    }
}

# Lee KEY=VALUE de .maestro\.env.e2e.local (ignorado por git) y de variables de entorno. Nunca imprime valores.
function Leer-Credenciales([string[]]$claves) {
    $valores = @{}
    $archivo = Join-Path $script:MobileDir '.maestro\.env.e2e.local'
    if (Test-Path $archivo) {
        foreach ($l in Get-Content $archivo) {
            if ($l -match '^\s*([A-Z_]+)\s*=\s*(.*)$' -and $claves -contains $Matches[1]) { $valores[$Matches[1]] = $Matches[2].Trim() }
        }
    }
    foreach ($k in $claves) {
        if (-not $valores.ContainsKey($k) -or -not $valores[$k]) {
            $v = [Environment]::GetEnvironmentVariable($k)
            if ($v) { $valores[$k] = $v }
        }
    }
    return $valores
}

# Maestro crea una carpeta de reporte con el `name` de cada flujo: en Windows no admite : \ / * ? " < > | ni nombres que
# terminen en espacio o punto (InvalidPathException). Falla indicando archivo y nombre antes de ejecutar nada.
function Verificar-NombresDeFlujos([string[]]$carpetas) {
    $invalidos = '[:\/*?"<>|\x00-\x1f]'
    $problemas = @()
    foreach ($carpeta in $carpetas) {
        foreach ($f in Get-ChildItem $carpeta -Filter *.yaml -Recurse) {
            $linea = Get-Content $f.FullName -Encoding UTF8 | Where-Object { $_ -match '^name:\s*(.+?)\s*$' } | Select-Object -First 1
            if (-not $linea) { continue }
            $nombre = ($linea -replace '^name:\s*', '').Trim()
            if ($nombre.Length -ge 2 -and (($nombre.StartsWith('"') -and $nombre.EndsWith('"')) -or ($nombre.StartsWith("'") -and $nombre.EndsWith("'")))) {
                $nombre = $nombre.Substring(1, $nombre.Length - 2)
            }
            if ($nombre -match $invalidos -or $nombre -match '[ .]$') {
                $problemas += "  $($f.Name): $nombre"
            }
        }
    }
    if ($problemas.Count -gt 0) {
        Fallar ("Nombres de flujo invalidos en Windows (no usar : \ / * ? `" < > | ni terminar en espacio o punto; usa ' - ' en lugar de dos puntos):`n" + ($problemas -join "`n"))
    }
}
