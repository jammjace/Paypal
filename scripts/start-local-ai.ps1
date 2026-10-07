$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$runtimeRoot = Join-Path $projectRoot '.local\ollama'
$executable = Join-Path $runtimeRoot 'runtime\ollama.exe'
if (-not (Test-Path -LiteralPath $executable)) {
  throw 'Portable Ollama is missing. See docs/AI_DESIGN.md for setup.'
}
try {
  $null = Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/version' -TimeoutSec 2
  Write-Output 'Ollama is already running at 127.0.0.1:11434.'
  exit 0
} catch { }
$env:OLLAMA_HOST = '127.0.0.1:11434'
$env:OLLAMA_MODELS = Join-Path $runtimeRoot 'models'
$env:OLLAMA_NO_CLOUD = '1'
$env:OLLAMA_MAX_LOADED_MODELS = '1'
$env:OLLAMA_NUM_PARALLEL = '1'
New-Item -ItemType Directory -Force -Path $env:OLLAMA_MODELS | Out-Null
Start-Process -FilePath $executable -ArgumentList 'serve' -WindowStyle Hidden `
  -RedirectStandardOutput (Join-Path $runtimeRoot 'server.stdout.log') `
  -RedirectStandardError (Join-Path $runtimeRoot 'server.stderr.log') | Out-Null
Write-Output 'Started local-only Ollama. Model: qwen3:4b. No sign-in or payment required.'
