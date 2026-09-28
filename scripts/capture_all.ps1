$targets = @(
    @{ name = "landing"; url = "http://localhost:3000/" },
    @{ name = "user"; url = "http://localhost:3000/user" },
    @{ name = "collector"; url = "http://localhost:3000/collector" },
    @{ name = "collector-scan"; url = "http://localhost:3000/collector/scan" },
    @{ name = "municipal"; url = "http://localhost:3000/municipal" },
    @{ name = "medical"; url = "http://localhost:3000/medical" },
    @{ name = "producer"; url = "http://localhost:3000/producer" },
    @{ name = "government"; url = "http://localhost:3000/government" },
    @{ name = "track"; url = "http://localhost:3000/track/fca145e7875f1e6cb86e8dcf0bbd3229" }
)

foreach ($t in $targets) {
    Write-Host "Capturing desktop $($t.name)..."
    npx playwright screenshot --viewport-size="1440,900" --full-page --wait-for-timeout=1500 $t.url "playwright-audit/$($t.name)-desktop.png"
    Write-Host "Capturing mobile $($t.name)..."
    npx playwright screenshot --viewport-size="390,844" --full-page --wait-for-timeout=1500 $t.url "playwright-audit/$($t.name)-mobile.png"
}
Write-Host "All screenshots captured!"
