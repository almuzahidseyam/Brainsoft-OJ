$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
Write-Host 'Starting the backend in this terminal. Open a second terminal and run: npm run dev --prefix frontend'
Write-Host 'Configure JUDGE_ENABLED and JUDGE_ACCESS_TOKEN first to enable container judging. See README.md.'
npm start --prefix backend
