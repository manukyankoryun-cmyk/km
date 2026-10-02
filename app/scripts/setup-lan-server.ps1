# KM LAN Server — Static IP + Firewall setup (Windows)
# Run as Administrator
#
# Usage:
#   .\setup-lan-server.ps1 -StaticIp 192.168.1.100 -Gateway 192.168.1.1 -InterfaceAlias "Ethernet"
#   .\setup-lan-server.ps1 -FirewallOnly

param(
  [string]$StaticIp = "",
  [string]$Gateway = "192.168.1.1",
  [string]$PrefixLength = "24",
  [string]$InterfaceAlias = "",
  [switch]$FirewallOnly
)

$ErrorActionPreference = "Stop"
$HttpPort = 18094
$UdpPort = 18095
$WsPort = 18096

function Write-Step($msg) {
  Write-Host "==> $msg" -ForegroundColor Cyan
}

Write-Step "KM LAN Server Setup"
Write-Host "  HTTP port : $HttpPort"
Write-Host "  UDP port  : $UdpPort"
Write-Host "  WS port   : $WsPort"
Write-Host ""

if (-not $FirewallOnly -and $StaticIp) {
  if (-not $InterfaceAlias) {
    $InterfaceAlias = (Get-NetAdapter | Where-Object { $_.Status -eq "Up" -and $_.HardwareInterface } | Select-Object -First 1).Name
  }
  if (-not $InterfaceAlias) {
    Write-Host "No active network adapter found. Set -InterfaceAlias manually." -ForegroundColor Red
    exit 1
  }
  Write-Step "Setting static IP $StaticIp on '$InterfaceAlias'"
  try {
    Remove-NetIPAddress -InterfaceAlias $InterfaceAlias -Confirm:$false -ErrorAction SilentlyContinue
  } catch {}
  New-NetIPAddress -InterfaceAlias $InterfaceAlias -IPAddress $StaticIp -PrefixLength $PrefixLength -DefaultGateway $Gateway -ErrorAction Stop
  Set-DnsClientServerAddress -InterfaceAlias $InterfaceAlias -ServerAddresses $Gateway, "8.8.8.8"
  Write-Host "  Static IP configured: $StaticIp" -ForegroundColor Green
}

Write-Step "Configuring Windows Firewall rules"
$rules = @(
  @{ Name = "KM LAN HTTP"; Port = $HttpPort; Proto = "TCP" },
  @{ Name = "KM LAN UDP"; Port = $UdpPort; Proto = "UDP" },
  @{ Name = "KM LAN WS"; Port = $WsPort; Proto = "TCP" }
)
foreach ($r in $rules) {
  $existing = Get-NetFirewallRule -DisplayName $r.Name -ErrorAction SilentlyContinue
  if ($existing) {
    Set-NetFirewallRule -DisplayName $r.Name -Direction Inbound -Action Allow -Profile Any -Enabled True | Out-Null
    Write-Host "  Rule updated (Any profile): $($r.Name)" -ForegroundColor Yellow
    continue
  }
  New-NetFirewallRule -DisplayName $r.Name -Direction Inbound -Protocol $r.Proto -LocalPort $r.Port -Action Allow -Profile Any | Out-Null
  Write-Host "  Created: $($r.Name) ($($r.Proto) $($r.Port))" -ForegroundColor Green
}

Write-Step "Creating sample client config"
$sampleClient = @"
{
  "role": "client",
  "serverUrl": "http://$(if ($StaticIp) { $StaticIp } else { '192.168.1.100' }):$HttpPort",
  "wsUrl": "ws://$(if ($StaticIp) { $StaticIp } else { '192.168.1.100' }):$WsPort",
  "autoReconnect": true,
  "realtimeSync": true
}
"@
$outPath = Join-Path $PSScriptRoot "..\data\km_lan_config.client.sample.json"
$sampleClient | Set-Content -Path $outPath -Encoding UTF8
Write-Host "  Sample client config: $outPath"

Write-Host ""
Write-Step "Done"
Write-Host "  1. Open KM Desktop on this PC"
Write-Host "  2. Network -> Start listening -> Enable 'Hub server'"
Write-Host "  3. On clients: copy sample config to %LOCALAPPDATA%\KM\UserData\km_lan_config.json"
Write-Host "  4. Test: curl http://$(if ($StaticIp) { $StaticIp } else { 'SERVER_IP' }):$HttpPort/km/hello"
