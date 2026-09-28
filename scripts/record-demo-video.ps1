# PowerShell script to record 5-minute demo video
# Usage:
#   .\scripts\record-demo-video.ps1         (Full 5-minute recording)
#   .\scripts\record-demo-video.ps1 -Fast   (30-second fast verification preview)

param(
  [switch]$Fast
)

$Duration = if ($Fast) { "30" } else { "305" }
$env:DEMO_DURATION = $Duration

Write-Host "==========================================================" -ForegroundColor Green
Write-Host "   CirculaSync — 5-Minute Pitch Video Recorder" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "Recording duration: $Duration seconds" -ForegroundColor Yellow

node scripts/record-demo.mjs
