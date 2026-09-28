# Capture desktop and mobile screenshots for all pages in light mode using Playwright CLI

$storage = "playwright-audit/storage-light.json"

$pages = @(
  @{ Name = "landing"; Url = "http://localhost:3000/" },
  @{ Name = "user"; Url = "http://localhost:3000/user" },
  @{ Name = "collector"; Url = "http://localhost:3000/collector" },
  @{ Name = "collector-scan"; Url = "http://localhost:3000/collector/scan.html" },
  @{ Name = "municipal"; Url = "http://localhost:3000/municipal" },
  @{ Name = "medical"; Url = "http://localhost:3000/medical" },
  @{ Name = "producer"; Url = "http://localhost:3000/producer" },
  @{ Name = "gov"; Url = "http://localhost:3000/government" },
  @{ Name = "track"; Url = "http://localhost:3000/track/6f5e615e7174ad5a85870ea3f58f2965" }
)

Write-Host "Capturing Light Mode Desktop Screenshots (1440x900)..."
foreach ($p in $pages) {
  $out = "playwright-audit/$($p.Name)-light-desktop.png"
  Write-Host "-> $($p.Name): $($p.Url)"
  npx playwright screenshot --load-storage="$storage" --viewport-size="1440,900" --wait-for-timeout=1200 $p.Url $out
}

Write-Host "Capturing Light Mode Mobile Screenshots (390x844)..."
foreach ($p in $pages) {
  $out = "playwright-audit/$($p.Name)-light-mobile.png"
  Write-Host "-> $($p.Name) [mobile]: $($p.Url)"
  npx playwright screenshot --load-storage="$storage" --viewport-size="390,844" --wait-for-timeout=1200 $p.Url $out
}

Write-Host "All screenshots captured successfully!"
