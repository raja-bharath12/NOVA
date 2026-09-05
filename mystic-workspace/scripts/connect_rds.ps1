# Connect to AWS RDS PostgreSQL via PowerShell using AWS CLI IAM Auth Token
$RDSHOST = "database-1.cluster-c7ey60g2wfh6.ap-south-1.rds.amazonaws.com"
$REGION = "ap-south-1"
$DBUSER = "postgres"
$DBNAME = "postgres"

Write-Host "Generating AWS RDS Auth Token for $RDSHOST ($REGION)..." -ForegroundColor Cyan
$TOKEN = aws rds generate-db-auth-token --hostname $RDSHOST --port 5432 --username $DBUSER --region $REGION

if ($TOKEN) {
    Write-Host "Token generated successfully. Connecting via psql..." -ForegroundColor Green
    $env:PGPASSWORD = $TOKEN
    psql "host=$RDSHOST port=5432 dbname=$DBNAME user=$DBUSER sslmode=require"
} else {
    Write-Host "Failed to generate token. Ensure AWS CLI is configured with 'aws configure'." -ForegroundColor Red
}
