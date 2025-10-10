# Payment System Deployment Guide

This guide walks through deploying the payment system to production.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Pre-Deployment Checklist](#pre-deployment-checklist)
- [Database Setup](#database-setup)
- [Stripe Configuration](#stripe-configuration)
- [Environment Variables](#environment-variables)
- [Deployment Steps](#deployment-steps)
- [Post-Deployment Verification](#post-deployment-verification)
- [Rollback Procedure](#rollback-procedure)
- [Monitoring Setup](#monitoring-setup)

## Prerequisites

### Required Accounts
- [x] Cloudflare account with Pages access
- [x] Stripe account (live mode enabled)
- [x] Domain configured for your application
- [x] Wrangler CLI installed (\`npm install -g wrangler\`)

### Required Permissions
- [x] Cloudflare: Write access to D1, KV, R2, Pages
- [x] Stripe: Full API access, webhook management

### Local Setup
\`\`\`bash
# Verify wrangler authentication
wrangler whoami

# Verify you're in the correct directory
cd /path/to/Fitbit2Garmin/frontend

# Verify build works
npm run build
\`\`\`

## Pre-Deployment Checklist

### Code Review
- [ ] All TypeScript type checks pass
- [ ] Production build completes successfully
- [ ] No console errors or warnings
- [ ] All tests pass (if applicable)

### Stripe Setup
- [ ] Stripe account activated (live mode)
- [ ] Payment methods tested in test mode
- [ ] Webhook endpoint configured
- [ ] API keys generated (live mode)
- [ ] Tax settings configured (if applicable)

### Database Planning
- [ ] Backup existing D1 database
- [ ] Review schema changes
- [ ] Plan for zero-downtime migration
- [ ] Verify database ID in wrangler.toml

## Database Setup

### Step 1: Backup Existing Database

\`\`\`bash
# Export current database
wrangler d1 execute RATE_LIMITS_DB --command "SELECT * FROM rate_limits" > backup_rate_limits.sql
wrangler d1 execute RATE_LIMITS_DB --command "SELECT * FROM client_reputation" > backup_client_reputation.sql

# Save backup with timestamp
DATE=\$(date +%Y%m%d_%H%M%S)
mkdir -p backups
mv backup_*.sql backups/backup_\${DATE}/
\`\`\`

### Step 2: Deploy New Schema

The schema includes two new tables: \`user_passes\` and \`daily_usage\`.

\`\`\`bash
# Deploy schema (creates tables if not exist)
wrangler d1 execute RATE_LIMITS_DB --file=frontend/functions/db/schema.sql

# Expected output:
# 🌀 Executing on RATE_LIMITS_DB (9365a27e-4026-46a2-9a45-a989c5c786e2):
# ✅ Executed 16 commands in 0.234s
\`\`\`

### Step 3: Verify Tables

\`\`\`bash
# List all tables
wrangler d1 execute RATE_LIMITS_DB --command ".tables"

# Expected output should include:
# - rate_limits
# - client_reputation
# - user_passes          (NEW)
# - daily_usage          (NEW)

# Verify user_passes schema
wrangler d1 execute RATE_LIMITS_DB --command "PRAGMA table_info(user_passes)"

# Verify daily_usage schema
wrangler d1 execute RATE_LIMITS_DB --command "PRAGMA table_info(daily_usage)"

# Check indexes
wrangler d1 execute RATE_LIMITS_DB --command "SELECT name FROM sqlite_master WHERE type='index'"
\`\`\`

## Stripe Configuration

### Step 1: Create Live API Keys

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Switch to **Live mode** (toggle in top-right)
3. Navigate to **Developers** → **API keys**
4. Locate your **Publishable key** (starts with \`pk_live_\`)
5. Click **Create secret key**
   - Name: "Fitbit2Garmin Production"
   - Copy the secret key (starts with \`sk_live_\`)
   - **IMPORTANT**: Store securely, cannot be viewed again

### Step 2: Set Up Webhook Endpoint

1. Navigate to **Developers** → **Webhooks**
2. Click **Add endpoint**
3. Configure:
   - **Endpoint URL**: \`https://your-domain.com/api/stripe-webhook\`
   - **Description**: Fitbit2Garmin Payment Events
   - **Events to send**:
     - \`checkout.session.completed\`
     - \`charge.refunded\`
4. Copy the signing secret (starts with \`whsec_\`)

## Environment Variables

### Step 1: Update wrangler.toml

Edit \`wrangler.toml\`:

\`\`\`toml
[vars]
STRIPE_PUBLISHABLE_KEY = "pk_live_YOUR_ACTUAL_KEY_HERE"
\`\`\`

### Step 2: Set Secret Keys

\`\`\`bash
# Set Stripe secret key
wrangler secret put STRIPE_SECRET_KEY
# When prompted, paste: sk_live_YOUR_ACTUAL_KEY

# Set Stripe webhook secret
wrangler secret put STRIPE_WEBHOOK_SECRET
# When prompted, paste: whsec_YOUR_ACTUAL_SECRET
\`\`\`

## Deployment Steps

### Deploy to Production

\`\`\`bash
# Build
npm run build

# Deploy
npx wrangler pages deploy
\`\`\`

## Post-Deployment Verification

### Test Payment Flow

1. Visit your site
2. Click "Upgrade" button
3. Complete test payment
4. Verify pass activation
5. Check database:

\`\`\`bash
wrangler d1 execute RATE_LIMITS_DB --command "SELECT * FROM user_passes ORDER BY created_at DESC LIMIT 1"
\`\`\`

### Test Webhook

\`\`\`bash
# Use Stripe CLI
stripe trigger checkout.session.completed --webhook-url https://your-domain.com/api/stripe-webhook
\`\`\`

## Support

For deployment issues, see [PAYMENT_SYSTEM.md](./PAYMENT_SYSTEM.md).
