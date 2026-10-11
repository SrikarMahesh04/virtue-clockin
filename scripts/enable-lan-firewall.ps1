# Run once from an Administrator PowerShell if Windows blocks the phone connection.
# Allows only local-subnet inbound TCP traffic on the two application ports.
# Does not change your Wi-Fi trust category or disable the firewall.
$ErrorActionPreference = 'Stop'
$taskPrincipal = [Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $taskPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Open PowerShell as Administrator, then run this script again.'
}
$taskRuleName = 'VirtueClockIn-LocalSubnet'
$taskRule = Get-NetFirewallRule -Name $taskRuleName -ErrorAction SilentlyContinue
if ($taskRule) {
    Set-NetFirewallRule -Name $taskRuleName -Enabled True -Direction Inbound -Action Allow -Profile Private,Public -RemoteAddress LocalSubnet -Protocol TCP -LocalPort 3000,8000
} else {
    New-NetFirewallRule -Name $taskRuleName -DisplayName 'Virtue ClockIn - local subnet only' -Direction Inbound -Action Allow -Enabled True -Profile Private,Public -Protocol TCP -LocalPort 3000,8000 -RemoteAddress LocalSubnet | Out-Null
}
Write-Host 'Local-subnet access enabled for ports 3000 and 8000.'
Write-Host "To undo: Remove-NetFirewallRule -Name '$taskRuleName'"
