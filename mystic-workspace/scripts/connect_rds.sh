#!/bin/bash
export RDSHOST="database-1.cluster-c7ey60g2wfh6.ap-south-1.rds.amazonaws.com"
export REGION="ap-south-1"
export DBUSER="postgres"
export DBNAME="postgres"

echo "Generating AWS RDS DB Auth Token..."
export PGPASSWORD=$(aws rds generate-db-auth-token --hostname $RDSHOST --port 5432 --username $DBUSER --region $REGION)

echo "Connecting to AWS RDS PostgreSQL at $RDSHOST..."
psql "host=$RDSHOST port=5432 dbname=$DBNAME user=$DBUSER sslmode=require"
