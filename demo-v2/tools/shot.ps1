# Screenshot helper: fresh Edge profile per run, retries until the file is written.
param([string]$Url, [string]$Out, [int]$Budget = 4000)
# append &shot=1 so the page pins virtual time until it has rendered (see demo.html)
$Url = $Url + $(if ($Url.Contains('?')) { '&shot=1' } else { '?shot=1' })
$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
for ($i = 0; $i -lt 3; $i++) {
  $profDir = Join-Path $env:TEMP ("edge-poc-" + [guid]::NewGuid().ToString("N").Substring(0, 8))
  if (Test-Path $Out) { Remove-Item $Out -Force }
  & $edge --headless=new --disable-gpu --hide-scrollbars --user-data-dir="$profDir" `
    --virtual-time-budget=$Budget --window-size=1280,800 --screenshot="$Out" "$Url" 2>$null | Out-Null
  Remove-Item -Recurse -Force $profDir -ErrorAction SilentlyContinue
  if ((Test-Path $Out) -and ((Get-Item $Out).Length -gt 20000)) { Write-Output "OK $Out"; exit 0 }
}
Write-Output "FAILED $Out"
exit 1
