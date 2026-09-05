#!/bin/bash
export RDSHOST="database-1.c7ey60g2wfh6.ap-south-1.rds.amazonaws.com"
export REGION="ap-south-1"
export DBUSER="postgres"
export DBNAME="postgres"

# If global-bundle.pem is not present, download it from AWS truststore
if [ ! -f "./global-bundle.pem" ]; then
    echo "Downloading AWS RDS global-bundle.pem certificate..."
    curl -sS -o ./global-bundle.pem https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem
fi

echo "Connecting to AWS RDS PostgreSQL at $RDSHOST..."
psql "host=$RDSHOST port=5432 dbname=$DBNAME user=$DBUSER sslmode=verify-full sslrootcert=./global-bundle.pem"
