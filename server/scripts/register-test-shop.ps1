[CmdletBinding()]
param(
  [string]$ApiBaseUrl
)

if ([string]::IsNullOrWhiteSpace($ApiBaseUrl)) {
  $ApiBaseUrl = $env:VOICEMUNIM_API_URL
}
if ([string]::IsNullOrWhiteSpace($ApiBaseUrl)) {
  $ApiBaseUrl = "http://localhost:5000"
}

$registrationUri = "$($ApiBaseUrl.TrimEnd('/'))/api/v1/auth/register"
$emailSuffix = [guid]::NewGuid().ToString("N")
$email = "voice-test-$emailSuffix@example.test"
$random = [System.Security.Cryptography.RandomNumberGenerator]::Create()
try {
  $phoneBytes = New-Object byte[] 10
  $random.GetBytes($phoneBytes)

  $phoneDigits = [System.Text.StringBuilder]::new()
  [void]$phoneDigits.Append([char](54 + ($phoneBytes[0] % 4)))
  for ($index = 1; $index -lt $phoneBytes.Length; $index++) {
    [void]$phoneDigits.Append([char](48 + ($phoneBytes[$index] % 10)))
  }

  $passwordBytes = New-Object byte[] 24
  $random.GetBytes($passwordBytes)
  $password = [Convert]::ToBase64String($passwordBytes).
    TrimEnd('=').
    Replace('+', '-').
    Replace('/', '_')
}
finally {
  $random.Dispose()
}

$requestBody = @{
  shopName = "VoiceMunim Test Shop $emailSuffix"
  ownerName = "VoiceMunim Test Owner"
  email = $email
  phone = "+91$phoneDigits"
  password = $password
} | ConvertTo-Json -Compress

try {
  $response = Invoke-RestMethod `
    -Uri $registrationUri `
    -Method Post `
    -ContentType "application/json" `
    -Body $requestBody `
    -ErrorAction Stop
}
catch {
  $apiMessage = $null
  if (-not [string]::IsNullOrWhiteSpace($_.ErrorDetails.Message)) {
    try {
      $errorResponse = $_.ErrorDetails.Message | ConvertFrom-Json -ErrorAction Stop
      $apiMessage = $errorResponse.error.message
    }
    catch {
      $apiMessage = $null
    }
  }

  if (-not [string]::IsNullOrWhiteSpace($apiMessage)) {
    throw "Registration failed: $apiMessage"
  }
  if ($_.Exception.Response) {
    throw "Registration failed: the API returned an unsuccessful HTTP response."
  }
  throw "Registration request failed: $($_.Exception.Message)"
}

if ($response.success -ne $true -or [string]::IsNullOrWhiteSpace($response.data.token)) {
  throw "Registration failed: the API response did not contain a token at data.token."
}

$global:token = [string]$response.data.token
Write-Output "Registration successful!"
Write-Output "Test email: $email"
Write-Output "JWT token received: $([bool]$global:token)"
