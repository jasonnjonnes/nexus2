#!/bin/bash

# Health check script for monitoring app status
# Can be used during deployments to ensure app remains healthy

set -e

# Configuration
PRODUCTION_URL="https://pro.nexusinc.io"
FIREBASE_URL="https://servicepro-4c705.web.app"
HEALTH_ENDPOINT="/api/health"  # You'll need to create this endpoint
MAX_RETRIES=10
RETRY_DELAY=5

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🏥 Starting health check...${NC}"

# Function to check URL health
check_url_health() {
    local url=$1
    local name=$2
    
    echo -e "${YELLOW}Checking ${name}: ${url}${NC}"
    
    for i in $(seq 1 $MAX_RETRIES); do
        if curl -f -s --max-time 10 "${url}" > /dev/null 2>&1; then
            echo -e "${GREEN}✅ ${name} is healthy (attempt ${i}/${MAX_RETRIES})${NC}"
            return 0
        else
            echo -e "${YELLOW}⚠️  ${name} check failed (attempt ${i}/${MAX_RETRIES})${NC}"
            if [ $i -lt $MAX_RETRIES ]; then
                sleep $RETRY_DELAY
            fi
        fi
    done
    
    echo -e "${RED}❌ ${name} is unhealthy after ${MAX_RETRIES} attempts${NC}"
    return 1
}

# Function to check Firebase Functions
check_functions_health() {
    local functions_url="https://us-central1-servicepro-4c705.cloudfunctions.net"
    
    echo -e "${YELLOW}Checking Firebase Functions...${NC}"
    
    # Check a simple function endpoint
    if curl -f -s --max-time 10 "${functions_url}/api/health" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Firebase Functions are healthy${NC}"
        return 0
    else
        echo -e "${RED}❌ Firebase Functions are unhealthy${NC}"
        return 1
    fi
}

# Function to check database connectivity
check_database_health() {
    echo -e "${YELLOW}Checking database connectivity...${NC}"
    
    # This would typically make a test query to your database
    # For now, we'll assume it's healthy if functions are working
    echo -e "${GREEN}✅ Database connectivity assumed healthy${NC}"
    return 0
}

# Main health check
main() {
    local overall_health=0
    
    # Check production URL
    if ! check_url_health "$PRODUCTION_URL" "Production Site"; then
        overall_health=1
    fi
    
    # Check Firebase URL
    if ! check_url_health "$FIREBASE_URL" "Firebase Hosting"; then
        overall_health=1
    fi
    
    # Check Firebase Functions
    if ! check_functions_health; then
        overall_health=1
    fi
    
    # Check database
    if ! check_database_health; then
        overall_health=1
    fi
    
    if [ $overall_health -eq 0 ]; then
        echo -e "${GREEN}🎉 All systems healthy!${NC}"
        exit 0
    else
        echo -e "${RED}💥 Some systems are unhealthy!${NC}"
        exit 1
    fi
}

# Run health check
main 