# Connect to AWS RDS PostgreSQL via PowerShell
$RDSHOST = "database-1.c7ey60g2wfh6.ap-south-1.rds.amazonaws.com"
$REGION = "ap-south-1"
$DBUSER = "postgres"
$DBNAME = "postgres"

if (-not (Test-Path "./global-bundle.pem")) {
    Write-Host "Downloading AWS RDS global-bundle.pem certificate..." -ForegroundColor Cyan
    Invoke-WebRequest -Uri "https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem" -OutFile "./global-bundle.pem"
}

Write-Host "Connecting to AWS RDS PostgreSQL at $RDSHOST..." -ForegroundColor Green
psql "host=$RDSHOST port=5432 dbname=$DBNAME user=$DBUSER sslmode=verify-full sslrootcert=./global-bundle.pem"
