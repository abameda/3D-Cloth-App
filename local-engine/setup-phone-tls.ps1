param([Parameter(Mandatory=$true)][string]$ComputerIp)
$ErrorActionPreference = 'Stop'
# Files only: this script never installs a CA in Windows or changes certificate trust.
if ($PSVersionTable.PSVersion.Major -lt 7) { throw 'Run this with PowerShell 7 (pwsh).' }
$address = [System.Net.IPAddress]::Parse($ComputerIp)
if ($address.AddressFamily -ne [System.Net.Sockets.AddressFamily]::InterNetwork -or $ComputerIp -notmatch '^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)') { throw 'Use the private LAN IPv4 address of your computer.' }
$project = Split-Path $PSScriptRoot -Parent
$folder = Join-Path $project '.data/phone-tls'
if (Test-Path (Join-Path $folder 'server-key.pem')) { throw 'Local phone certificates already exist. Keep them; replacing them requires trusting a new root on the phone.' }
New-Item -ItemType Directory -Force -Path $folder | Out-Null
$rootKey = [System.Security.Cryptography.RSA]::Create(3072)
$serverKey = [System.Security.Cryptography.RSA]::Create(2048)
try {
 $rootRequest = [System.Security.Cryptography.X509Certificates.CertificateRequest]::new('CN=Thread Private Computer Root', $rootKey, [System.Security.Cryptography.HashAlgorithmName]::SHA256, [System.Security.Cryptography.RSASignaturePadding]::Pkcs1)
 $rootRequest.CertificateExtensions.Add([System.Security.Cryptography.X509Certificates.X509BasicConstraintsExtension]::new($true,$false,0,$true))
 $rootRequest.CertificateExtensions.Add([System.Security.Cryptography.X509Certificates.X509KeyUsageExtension]::new([System.Security.Cryptography.X509Certificates.X509KeyUsageFlags]::KeyCertSign,$true))
 $start = [DateTimeOffset]::UtcNow.AddMinutes(-5)
 $rootCertificate = $rootRequest.CreateSelfSigned($start, $start.AddYears(2))
 $request = [System.Security.Cryptography.X509Certificates.CertificateRequest]::new('CN=Thread Private Computer', $serverKey, [System.Security.Cryptography.HashAlgorithmName]::SHA256, [System.Security.Cryptography.RSASignaturePadding]::Pkcs1)
 $request.CertificateExtensions.Add([System.Security.Cryptography.X509Certificates.X509BasicConstraintsExtension]::new($false,$false,0,$true))
 $san = [System.Security.Cryptography.X509Certificates.SubjectAlternativeNameBuilder]::new()
 $san.AddIpAddress($address); $san.AddIpAddress([System.Net.IPAddress]::Loopback); $san.AddDnsName('localhost')
 $request.CertificateExtensions.Add($san.Build())
 $oids = [System.Security.Cryptography.OidCollection]::new()
 $null = $oids.Add([System.Security.Cryptography.Oid]::new('1.3.6.1.5.5.7.3.1'))
 $request.CertificateExtensions.Add([System.Security.Cryptography.X509Certificates.X509EnhancedKeyUsageExtension]::new($oids,$true))
 $serial = [byte[]]::new(16); [System.Security.Cryptography.RandomNumberGenerator]::Fill($serial)
 $serverCertificate = $request.Create($rootCertificate,$start,$start.AddDays(365),$serial)
 [System.IO.File]::WriteAllText((Join-Path $folder 'server.pem'),$serverCertificate.ExportCertificatePem())
 [System.IO.File]::WriteAllText((Join-Path $folder 'server-key.pem'),$serverKey.ExportPkcs8PrivateKeyPem())
 [System.IO.File]::WriteAllText((Join-Path $folder 'root.pem'),$rootCertificate.ExportCertificatePem())
 [System.IO.File]::WriteAllBytes((Join-Path $folder 'thread-private-root.cer'),$rootCertificate.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert))
 Write-Output "Local certificates created in $folder. Keep server-key.pem private."
 Write-Output "Transfer only thread-private-root.cer directly to your iPhone. Install its profile, then enable this specific root in Settings > General > About > Certificate Trust Settings."
 Write-Output "Add to .env.local-reconstruction: THREAD_RECONSTRUCTION_HOST=$ComputerIp, THREAD_RECONSTRUCTION_TLS_CERT=.data/phone-tls/server.pem, THREAD_RECONSTRUCTION_TLS_KEY=.data/phone-tls/server-key.pem (one per line)."
 Write-Output "Restart the engine. In Thread, pair https://${ComputerIp}:8790 using your existing private token. Do not upload captures or keys to a tunnel service."
} finally { $rootKey.Dispose(); $serverKey.Dispose() }
