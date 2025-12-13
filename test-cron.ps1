# Test script for the restore timer cron endpoint
# This allows you to test the cron function locally before deploying

Write-Host "Testing Restore Timer Cron Endpoint..." -ForegroundColor Cyan
Write-Host ""

# Read CRON_SECRET from .env.local
$envFile = ".env.local"
if (Test-Path $envFile) {
    $cronSecret = (Get-Content $envFile | Select-String "CRON_SECRET=").ToString().Split("=")[1]
    Write-Host "✅ Found CRON_SECRET in .env.local" -ForegroundColor Green
} else {
    Write-Host "❌ .env.local file not found. Please create it with CRON_SECRET variable." -ForegroundColor Red
    exit 1
}

# Test endpoint
$url = "http://localhost:3000/api/cron/restore-timer"
$headers = @{
    "Authorization" = "Bearer $cronSecret"
}

Write-Host "📡 Sending request to: $url" -ForegroundColor Yellow
Write-Host ""

try {
    $response = Invoke-RestMethod -Uri $url -Method GET -Headers $headers
    Write-Host "✅ SUCCESS!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Response:" -ForegroundColor Cyan
    $response | ConvertTo-Json -Depth 10
    Write-Host ""
    Write-Host "Previous Counter: $($response.previousCounter)" -ForegroundColor Yellow
    Write-Host "New Counter: $($response.newCounter)" -ForegroundColor Green
    Write-Host "Timestamp: $($response.timestamp)" -ForegroundColor Cyan
} catch {
    Write-Host "❌ ERROR!" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    Write-Host "Make sure:" -ForegroundColor Yellow
    Write-Host "1. Dev server is running (npm run dev)" -ForegroundColor Yellow
    Write-Host "2. Database migration has been run" -ForegroundColor Yellow
    Write-Host "3. CRON_SECRET is set in .env.local" -ForegroundColor Yellow
}
