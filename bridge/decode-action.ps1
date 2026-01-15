$response = Invoke-RestMethod -Uri 'http://localhost:3000/api/action'
if ($response.hasAction) {
    $decoded = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($response.sqf))
    Write-Host "=== DECODED SQF ==="
    Write-Host $decoded
    Write-Host "=== END SQF ==="
    Write-Host "Length: $($decoded.Length) characters"
} else {
    Write-Host "No action in queue"
}
