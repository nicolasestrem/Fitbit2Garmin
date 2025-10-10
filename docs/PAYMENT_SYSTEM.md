# Payment System Documentation

## Overview

The Fitbit2Garmin application implements a freemium model with daily limits for free users and time-based unlimited passes for premium users. This document provides comprehensive details about the payment system implementation.

## Table of Contents

- [Business Model](#business-model)
- [Architecture](#architecture)
- [Database Schema](#database-schema)
- [Backend Components](#backend-components)
- [Frontend Components](#frontend-components)
- [API Endpoints](#api-endpoints)
- [Payment Flow](#payment-flow)
- [Security](#security)
- [Testing](#testing)
- [Deployment](#deployment)

## Business Model

### Free Tier
- **Limit**: 3 files per day
- **Reset**: Midnight UTC daily
- **Restrictions**: Subject to hourly rate limits (10 conversions/hour)
- **Tracking**: IP-based client identification (no account required)

### Premium Passes

#### 24-Hour Pass
- **Price**: €2.49
- **Duration**: 24 hours from purchase
- **Benefits**: Unlimited file conversions
- **Use Case**: One-time bulk imports

#### 7-Day Pass
- **Price**: €5.99 (€0.86/day)
- **Duration**: 7 days (168 hours) from purchase
- **Benefits**: Unlimited file conversions
- **Savings**: 65% vs daily 24-hour passes
- **Use Case**: Multiple exports or ongoing migrations

### Key Features
- No subscription required (one-time payments)
- Instant activation upon payment
- No user account needed (IP-based)
- Secure Stripe payment processing
- Automatic expiration handling

## Architecture

### System Components

```
┌─────────────────┐
│   Frontend      │
│  (React/TS)     │
│                 │
│ - FileUpload    │
│ - PassStatus    │
│ - UpgradeModal  │
└────────┬────────┘
         │
         │ API Calls
         ▼
┌─────────────────┐
│  Pages Function │
│   (Node.js)     │
│                 │
│ - payment.js    │
│ - [[path]].js   │
└────────┬────────┘
         │
         │ Dependencies
         ▼
┌──────────────────────────────────┐
│   Business Logic Services        │
│                                   │
│ ┌────────────────────────────┐  │
│ │  PassManager               │  │
│ │  - hasActivePass()         │  │
│ │  - createPass()            │  │
│ │  - getPassStatus()         │  │
│ └────────────────────────────┘  │
│                                   │
│ ┌────────────────────────────┐  │
│ │  DailyLimitTracker         │  │
│ │  - canConvert()            │  │
│ │  - recordConversion()      │  │
│ │  - getUsage()              │  │
│ └────────────────────────────┘  │
│                                   │
│ ┌────────────────────────────┐  │
│ │  StripeHandler             │  │
│ │  - createCheckoutSession() │  │
│ │  - handleWebhook()         │  │
│ │  - verifySignature()       │  │
│ └────────────────────────────┘  │
└──────────────────────────────────┘
         │
         │ Storage
         ▼
┌──────────────────────────────────┐
│   Cloudflare Storage             │
│                                   │
│ ┌────────────────────────────┐  │
│ │  D1 Database               │  │
│ │  - user_passes             │  │
│ │  - daily_usage             │  │
│ └────────────────────────────┘  │
│                                   │
│ ┌────────────────────────────┐  │
│ │  KV Storage                │  │
│ │  - Pass cache              │  │
│ │  - Rate limit state        │  │
│ └────────────────────────────┘  │
│                                   │
│ ┌────────────────────────────┐  │
│ │  Stripe API                │  │
│ │  - Checkout sessions       │  │
│ │  - Webhooks                │  │
│ └────────────────────────────┘  │
└──────────────────────────────────┘
```

### Data Flow

```
User Upload Request
    │
    ▼
Rate Limiter Check (existing hourly/burst limits)
    │
    ▼
Pass Check ─────► KV Cache ──► D1 Database
    │                │
    │ Has Pass?      │ Cache Hit: Return immediately
    │                │ Cache Miss: Query D1, cache result
    ▼                ▼
Daily Limit Check (if no pass)
    │
    ▼
D1 Daily Usage Query (YYYY-MM-DD key)
    │
    ▼
Allow/Deny Decision
    │
    ├─► DENY: Return 429 with upgrade info
    │
    └─► ALLOW: Process conversion
            │
            ▼
        Record Usage (if free tier)
```

## Database Schema

### user_passes Table

Stores purchased passes for premium users.

```sql
CREATE TABLE user_passes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id TEXT NOT NULL,              -- IP-based fingerprint
    pass_type TEXT NOT NULL,              -- '24h' or '7d'
    stripe_session_id TEXT UNIQUE,        -- Stripe checkout session
    stripe_payment_intent TEXT,           -- Stripe payment ID
    amount_cents INTEGER NOT NULL,        -- Price in cents
    currency TEXT DEFAULT 'eur',          -- Currency code
    purchased_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,         -- Calculated: purchased_at + duration
    status TEXT DEFAULT 'active',         -- 'active', 'expired', 'refunded'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_passes_client_status
    ON user_passes(client_id, status, expires_at);
CREATE INDEX idx_user_passes_stripe_session
    ON user_passes(stripe_session_id);
```

**Key Points:**
- `client_id`: Same fingerprint used for rate limiting (IP + User-Agent hash)
- `expires_at`: UTC timestamp when pass becomes invalid
- `status`: Active passes checked via `status = 'active' AND expires_at > NOW()`
- Indexes optimize the frequent "does user have active pass?" query

### daily_usage Table

Tracks file conversion usage for free tier users.

```sql
CREATE TABLE daily_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id TEXT NOT NULL,              -- IP-based fingerprint
    date TEXT NOT NULL,                   -- YYYY-MM-DD format (UTC)
    files_converted INTEGER DEFAULT 0,    -- Count of files converted
    conversions INTEGER DEFAULT 0,        -- Count of conversion operations
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(client_id, date)               -- One row per user per day
);

CREATE INDEX idx_daily_usage_lookup
    ON daily_usage(client_id, date);
```

**Key Points:**
- `date`: Stored in YYYY-MM-DD format for easy daily boundaries
- `UNIQUE(client_id, date)`: Prevents duplicate rows, enables UPSERT
- Reset logic: New date = new row = fresh limit
- `files_converted`: The actual limit counter (max 3 for free tier)

### Analytics View

```sql
CREATE VIEW daily_usage_analytics AS
SELECT
    date,
    COUNT(DISTINCT client_id) as unique_users,
    SUM(files_converted) as total_files,
    SUM(conversions) as total_conversions,
    AVG(files_converted) as avg_files_per_user
FROM daily_usage
GROUP BY date
ORDER BY date DESC;
```

## Backend Components

### PassManager (`frontend/functions/api/pass-manager.js`)

Manages user pass lifecycle and validation.

#### Constructor
```javascript
constructor(env) {
  this.env = env;
  this.KV_PREFIX = 'pass:';
  this.CACHE_TTL = 300; // 5 minutes
}
```

#### Methods

##### `hasActivePass(clientId)`
Checks if user has a valid unlimited pass.

**Flow:**
1. Check KV cache first (`pass:${clientId}`)
2. If cache hit: Return boolean
3. If cache miss: Query D1 database
4. Cache result in KV (5 min TTL)
5. Return boolean

**SQL Query:**
```sql
SELECT COUNT(*) as count
FROM user_passes
WHERE client_id = ?
  AND status = 'active'
  AND expires_at > datetime('now')
LIMIT 1
```

**Returns:** `Promise<boolean>`

##### `getPassStatus(clientId)`
Returns detailed pass information.

**Returns:**
```javascript
{
  hasPass: boolean,
  passType: '24h' | '7d' | null,
  expiresAt: string | null,      // ISO 8601 timestamp
  hoursRemaining: number,         // Rounded hours until expiry
  purchasedAt: string | undefined // ISO 8601 timestamp
}
```

**Logic:**
- Queries most recent active pass for user
- Calculates `hoursRemaining` = Math.ceil((expires - now) / 3600000)
- Returns default "no pass" object if none found

##### `createPass(clientId, passType, stripeSessionId, paymentIntent, amountCents)`
Creates a new pass after successful payment.

**Parameters:**
- `clientId`: User's fingerprint
- `passType`: '24h' or '7d'
- `stripeSessionId`: Checkout session ID
- `paymentIntent`: Payment intent ID
- `amountCents`: Amount paid in cents

**Logic:**
1. Calculate expiration: `new Date(Date.now() + duration_hours * 3600000)`
2. Insert into D1 database
3. Clear KV cache for user (`DELETE pass:${clientId}`)
4. Return created pass details

**SQL:**
```sql
INSERT INTO user_passes (
  client_id, pass_type, stripe_session_id,
  stripe_payment_intent, amount_cents, expires_at
) VALUES (?, ?, ?, ?, ?, ?)
RETURNING *
```

### DailyLimitTracker (`frontend/functions/api/daily-limit-tracker.js`)

Enforces 3 files/day limit for free tier users.

#### Constructor
```javascript
constructor(env) {
  this.env = env;
  this.dailyLimit = 3; // Files per day
}
```

#### Methods

##### `canConvert(clientId, filesCount)`
Checks if user can convert N files without exceeding daily limit.

**Parameters:**
- `clientId`: User's fingerprint
- `filesCount`: Number of files in this conversion request

**Returns:**
```javascript
{
  allowed: boolean,
  filesConverted: number,      // Files already used today
  filesRemaining: number,      // Files left for today
  limit: number,               // Daily limit (3)
  resetTime: number,           // Unix timestamp of next midnight UTC
  wouldExceed: boolean        // Would this request exceed limit?
}
```

**Logic:**
1. Get current UTC date (YYYY-MM-DD)
2. Query `daily_usage` for today's usage
3. Check: `(filesConverted + filesCount) <= dailyLimit`
4. Calculate reset time: Next midnight UTC
5. Return detailed status

**SQL:**
```sql
SELECT files_converted, conversions
FROM daily_usage
WHERE client_id = ? AND date = ?
```

##### `recordConversion(clientId, filesCount)`
Atomically increments daily usage counters.

**Parameters:**
- `clientId`: User's fingerprint
- `filesCount`: Number of files converted

**SQL (UPSERT):**
```sql
INSERT INTO daily_usage (client_id, date, files_converted, conversions)
VALUES (?, ?, ?, 1)
ON CONFLICT(client_id, date)
DO UPDATE SET
  files_converted = files_converted + ?,
  conversions = conversions + 1,
  updated_at = CURRENT_TIMESTAMP
```

**Atomicity:** The `ON CONFLICT` clause ensures race-free updates

##### `getUsage(clientId)`
Retrieves current day's usage statistics.

**Returns:**
```javascript
{
  filesConverted: number,
  conversions: number,
  filesRemaining: number,
  resetTime: number  // Unix timestamp
}
```

### StripeHandler (`frontend/functions/api/stripe-handler.js`)

Handles all Stripe payment operations.

#### Constructor
```javascript
constructor(env) {
  this.stripe = new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: '2023-10-16'
  });

  this.pricing = {
    '24h': {
      cents: 249,
      currency: 'eur',
      name: '24-hour pass',
      duration: 24
    },
    '7d': {
      cents: 599,
      currency: 'eur',
      name: '7-day pass',
      duration: 168
    }
  };
}
```

#### Methods

##### `createCheckoutSession(passType, clientId, successUrl, cancelUrl)`
Creates Stripe checkout session.

**Stripe Configuration:**
```javascript
{
  mode: 'payment',  // One-time payment (not subscription)
  line_items: [{
    price_data: {
      currency: pricing.currency,
      unit_amount: pricing.cents,
      product_data: {
        name: pricing.name,
        description: `Unlimited conversions for ${duration} hours`
      }
    },
    quantity: 1
  }],
  success_url: `${successUrl}?payment_success=true`,
  cancel_url: `${cancelUrl}?payment_canceled=true`,
  expires_at: Math.floor(Date.now() / 1000) + 1800, // 30 min
  metadata: {
    pass_type: passType,
    client_id: clientId,
    duration_hours: pricing.duration
  }
}
```

**Returns:**
```javascript
{
  sessionId: string,
  url: string  // Redirect user here
}
```

##### `verifyWebhookSignature(payload, signature)`
Verifies Stripe webhook authenticity.

**Purpose:** Prevent webhook spoofing attacks

**Implementation:**
```javascript
this.stripe.webhooks.constructEvent(
  payload,
  signature,
  env.STRIPE_WEBHOOK_SECRET
);
```

**Throws:** Error if signature invalid

##### `handleCheckoutCompleted(session, passManager, clientId)`
Processes successful payment.

**Flow:**
1. Extract metadata from session
2. Get payment intent details
3. Call `passManager.createPass()`
4. Return created pass

**Called by:** Webhook handler on `checkout.session.completed` event

##### `handleChargeRefunded(charge, passManager)`
Processes refund events.

**Flow:**
1. Find pass by payment intent ID
2. Update status to 'refunded'
3. Clear KV cache

**SQL:**
```sql
UPDATE user_passes
SET status = 'refunded', updated_at = CURRENT_TIMESTAMP
WHERE stripe_payment_intent = ?
```

## Frontend Components

### PassStatus Component (`frontend/src/components/PassStatus.tsx`)

Displays user's current tier and usage status.

#### Props
```typescript
interface PassStatusProps {
  onUpgradeClick?: () => void;
}
```

#### State Management
```typescript
const [passStatus, setPassStatus] = useState<PassStatusType | null>(null);
const [isLoading, setIsLoading] = useState(true);
```

#### Auto-Refresh
Polls `/api/pass-status` every 5 minutes to keep status current:
```typescript
useEffect(() => {
  loadPassStatus();
  const interval = setInterval(loadPassStatus, 5 * 60 * 1000);
  return () => clearInterval(interval);
}, []);
```

#### UI States

**Loading:**
```tsx
<div className="bg-gray-100 border rounded-lg p-3">
  <div className="animate-spin ..."></div>
  <span>Loading status...</span>
</div>
```

**Free Tier:**
```tsx
<div className="bg-blue-50 border-blue-200 rounded-lg p-4">
  <h3>Free Tier</h3>
  <p>3 files per day • Resets at midnight UTC</p>
  <button onClick={onUpgradeClick}>Upgrade</button>
</div>
```

**Premium (Active Pass):**
```tsx
<div className="bg-gradient-to-r from-green-50 to-emerald-50
                border-green-200 rounded-lg p-4">
  <h3>{passTypeName} Pass Active</h3>
  <span className="badge">UNLIMITED</span>
  <p>{hoursRemaining} hours remaining</p>
  <p>Expires {expiresAt.toLocaleString(...)}</p>
  <p>Convert as many files as you need!</p>
</div>
```

### UpgradeModal Component (`frontend/src/components/UpgradeModal.tsx`)

Pricing display and checkout initiation.

#### Props
```typescript
interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  filesUsed?: number;
  filesRemaining?: number;
  resetTime?: number;
}
```

#### State
```typescript
const [pricing, setPricing] = useState<Pricing | null>(null);
const [isLoading, setIsLoading] = useState(false);
const [selectedPass, setSelectedPass] = useState<'24h' | '7d' | null>(null);
```

#### Pricing Load
```typescript
useEffect(() => {
  if (isOpen) {
    loadPricing(); // Calls /api/pricing
  }
}, [isOpen]);
```

#### Checkout Flow
```typescript
const handleUpgrade = async (passType: '24h' | '7d') => {
  setIsLoading(true);
  setSelectedPass(passType);

  try {
    await redirectToCheckout(passType); // Redirects to Stripe
  } catch (error) {
    console.error('Checkout failed:', error);
    alert('Failed to start checkout. Please try again.');
    setIsLoading(false);
    setSelectedPass(null);
  }
};
```

#### UI Layout

**Header:**
- Shows files used (e.g., "You've used 2 of 3 free files today")
- Displays reset countdown
- Close button

**Pricing Cards:**
- Side-by-side 24h and 7d options
- "BEST VALUE" badge on 7-day pass
- Feature lists with checkmarks
- Loading states during checkout

**Features Section:**
- Highlights: No file size limits, Priority processing, Secure payment, Instant activation

### FileUpload Component Updates (`frontend/src/components/FileUpload.tsx`)

Integrated payment UI into main upload component.

#### New Imports
```typescript
import { PassStatus } from './PassStatus';
import { UpgradeModal } from './UpgradeModal';
```

#### New State
```typescript
const [showUpgradeModal, setShowUpgradeModal] = useState(false);
```

#### Stripe Redirect Handling
```typescript
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const success = params.get('payment_success');
  const canceled = params.get('payment_canceled');

  if (success === 'true') {
    alert('Payment successful! Your unlimited pass is now active.');
    window.history.replaceState({}, '', window.location.pathname);
  } else if (canceled === 'true') {
    window.history.replaceState({}, '', window.location.pathname);
  }
}, []);
```

#### UI Integration
```tsx
<div className="w-full">
  {/* Pass Status Display */}
  <div className="mb-6">
    <PassStatus onUpgradeClick={() => setShowUpgradeModal(true)} />
  </div>

  {/* Existing upload area */}
  {/* ... */}

  {/* Upgrade Modal */}
  <UpgradeModal
    isOpen={showUpgradeModal}
    onClose={() => setShowUpgradeModal(false)}
  />
</div>
```

## API Endpoints

### POST `/api/create-checkout-session`

Creates Stripe checkout session.

**Request:**
```json
{
  "passType": "24h" | "7d"
}
```

**Response (200):**
```json
{
  "sessionId": "cs_test_...",
  "url": "https://checkout.stripe.com/..."
}
```

**Errors:**
- `400`: Invalid pass type
- `500`: Stripe API error

**Implementation:**
```javascript
const { passType } = await request.json();
const clientId = getClientId(request);
const successUrl = `${origin}/?payment_success=true`;
const cancelUrl = `${origin}/?payment_canceled=true`;

const session = await stripeHandler.createCheckoutSession(
  passType, clientId, successUrl, cancelUrl
);

return new Response(JSON.stringify(session), {
  status: 200,
  headers: { 'Content-Type': 'application/json', ...corsHeaders }
});
```

### POST `/api/stripe-webhook`

Receives Stripe webhook events.

**Headers Required:**
- `stripe-signature`: Webhook signature for verification

**Supported Events:**
- `checkout.session.completed`: Payment successful
- `charge.refunded`: Refund processed

**Response:**
- `200`: Event processed
- `400`: Invalid signature
- `500`: Processing error

**Implementation:**
```javascript
const signature = request.headers.get('stripe-signature');
const payload = await request.text();

const event = stripeHandler.verifyWebhookSignature(payload, signature);

switch (event.type) {
  case 'checkout.session.completed':
    await stripeHandler.handleCheckoutCompleted(
      event.data.object, passManager, clientId
    );
    break;

  case 'charge.refunded':
    await stripeHandler.handleChargeRefunded(
      event.data.object, passManager
    );
    break;
}

return new Response(JSON.stringify({ received: true }), {
  status: 200
});
```

### GET `/api/pass-status`

Returns user's current pass status.

**Response (200):**
```json
{
  "hasPass": true,
  "passType": "7d",
  "expiresAt": "2025-10-17T00:00:00Z",
  "hoursRemaining": 156,
  "purchasedAt": "2025-10-10T00:00:00Z"
}
```

**No Active Pass:**
```json
{
  "hasPass": false,
  "passType": null,
  "expiresAt": null,
  "hoursRemaining": 0
}
```

**Implementation:**
```javascript
const clientId = getClientId(request);
const status = await passManager.getPassStatus(clientId);

return new Response(JSON.stringify(status), {
  status: 200,
  headers: { 'Content-Type': 'application/json', ...corsHeaders }
});
```

### GET `/api/pricing`

Returns pricing information.

**Response (200):**
```json
{
  "24h": {
    "cents": 249,
    "currency": "eur",
    "name": "24-hour pass",
    "duration": 24,
    "priceFormatted": "€2.49"
  },
  "7d": {
    "cents": 599,
    "currency": "eur",
    "name": "7-day pass",
    "duration": 168,
    "priceFormatted": "€5.99"
  }
}
```

## Payment Flow

### Complete User Journey

```
┌──────────────────────────────────────────────────────────┐
│ 1. User Visits Site (Free Tier)                         │
│    - PassStatus shows "Free Tier: 3 files per day"      │
│    - Can upload and convert 3 files                     │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│ 2. User Hits Daily Limit (3 files converted)            │
│    - 4th conversion attempt returns 429 error            │
│    - Error message: "Daily limit reached. Upgrade?"      │
│    - Shows reset time (midnight UTC)                    │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│ 3. User Clicks "Upgrade" Button                         │
│    - UpgradeModal opens                                  │
│    - Displays pricing: 24h (€2.49) vs 7d (€5.99)       │
│    - Shows current usage stats                          │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│ 4. User Selects Pass Type (e.g., 7d)                    │
│    - Frontend calls /api/create-checkout-session         │
│    - Backend creates Stripe session with metadata       │
│    - Returns checkout URL                               │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│ 5. Redirect to Stripe Checkout                          │
│    - User enters payment details                        │
│    - Stripe processes payment                           │
│    - Session expires in 30 minutes if not completed     │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ├──► Cancel ──────────────────────┐
                     │                                 │
                     ▼                                 ▼
┌──────────────────────────────────────┐   ┌────────────────────┐
│ 6a. Payment Success                  │   │ 6b. Payment Cancel │
│     - Redirect to success_url        │   │     - Redirect to  │
│     - Stripe fires webhook           │   │       cancel_url   │
└──────────────────┬───────────────────┘   └────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────┐
│ 7. Webhook: checkout.session.completed                  │
│    - Verify signature (security)                         │
│    - Extract session metadata                           │
│    - Create pass in database                            │
│    - Calculate expiration (now + duration)              │
│    - Clear KV cache for user                            │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│ 8. User Returns to Site                                  │
│    - URL param: ?payment_success=true                   │
│    - Alert: "Payment successful!"                       │
│    - PassStatus refreshes automatically                 │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│ 9. Premium User Experience                               │
│    - PassStatus shows "7-Day Pass Active"               │
│    - Badge: "UNLIMITED"                                 │
│    - Countdown: "156 hours remaining"                   │
│    - Expiration date displayed                          │
│    - Upload limit checks skip daily limits              │
│    - Can convert unlimited files for 7 days             │
└──────────────────────────────────────────────────────────┘
```

### Daily Limit Check Flow

```
Conversion Request
    │
    ▼
┌─────────────────────────────┐
│ RateLimiter.checkDailyLimit │
└──────────┬──────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│ PassManager.hasActivePass()      │
│ (Check KV → D1)                  │
└──────────┬───────────────────────┘
           │
           ├──► YES: Return { allowed: true, hasPass: true }
           │         (Skip daily limit check)
           │
           └──► NO: Continue to daily limit check
                     │
                     ▼
           ┌─────────────────────────────────┐
           │ DailyLimitTracker.canConvert()  │
           │ - Get today's usage (YYYY-MM-DD)│
           │ - Check: used + request <= 3    │
           └──────────┬──────────────────────┘
                      │
                      ├──► ALLOWED: Return { allowed: true, ... }
                      │              Process conversion
                      │              Record usage in D1
                      │
                      └──► DENIED: Return { allowed: false, ... }
                                    Return 429 with upgrade info
```

## Security

### Webhook Verification

All webhook requests must pass signature verification:

```javascript
// Prevents spoofed webhook calls
const event = stripe.webhooks.constructEvent(
  payload,
  signature,
  STRIPE_WEBHOOK_SECRET
);
```

**Attack Prevention:**
- Attackers cannot forge valid signatures without the secret
- Replay attacks prevented by Stripe's timestamp checking
- Man-in-the-middle attacks mitigated by HTTPS + signatures

### Client Identification

Uses same fingerprinting as rate limiting:

```javascript
function getClientId(request) {
  const ip = request.headers.get('CF-Connecting-IP');
  const userAgent = request.headers.get('User-Agent');
  return hashFunction(ip + userAgent);
}
```

**Privacy:**
- No personal data stored
- No cookies required
- No user accounts
- IP hashes are one-way (cannot reverse)

### Payment Security

- All payments processed by Stripe (PCI DSS Level 1)
- No credit card data touches our servers
- HTTPS required for all checkout flows
- Webhook endpoint protected by signature verification

### Rate Limiting Integration

Premium users still subject to:
- Hourly conversion limits (anti-abuse)
- Burst limits (DDoS protection)
- Client reputation scoring

Daily limits bypassed, but system integrity maintained.

## Testing

### Unit Tests

Test individual components in isolation:

```javascript
// Example: PassManager tests
describe('PassManager', () => {
  test('hasActivePass returns true for valid pass', async () => {
    // Mock D1 database with active pass
    // Call hasActivePass()
    // Assert true
  });

  test('hasActivePass returns false for expired pass', async () => {
    // Mock D1 database with expired pass
    // Call hasActivePass()
    // Assert false
  });

  test('createPass calculates correct expiration', async () => {
    // Call createPass with 24h type
    // Assert expires_at = now + 24 hours
  });
});
```

### Integration Tests

Test component interactions:

```javascript
describe('Daily Limit Flow', () => {
  test('free user blocked after 3 files', async () => {
    // Simulate 3 conversions (should succeed)
    // Simulate 4th conversion (should fail with 429)
    // Assert error message includes upgrade info
  });

  test('premium user unlimited conversions', async () => {
    // Create active pass
    // Simulate 10 conversions (should all succeed)
    // Assert daily_usage table not updated
  });
});
```

### Stripe Testing

Use Stripe test mode:

**Test Cards:**
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- 3D Secure: `4000 0027 6000 3184`

**Webhook Testing:**
```bash
stripe listen --forward-to https://your-domain.com/api/stripe-webhook
stripe trigger checkout.session.completed
```

### Manual Testing Checklist

- [ ] Free user can convert 3 files
- [ ] 4th file blocked with 429 error
- [ ] Upgrade modal displays correct pricing
- [ ] 24h checkout redirects to Stripe
- [ ] 7d checkout redirects to Stripe
- [ ] Payment success returns to site with success param
- [ ] Pass status updates after payment
- [ ] Premium user can convert unlimited files
- [ ] Pass expires at correct time
- [ ] Expired pass reverts to free tier
- [ ] Refund marks pass as refunded
- [ ] Daily limit resets at midnight UTC
- [ ] KV cache invalidates on pass creation

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for complete deployment guide.

### Quick Start

1. **Deploy Database Schema:**
   ```bash
   wrangler d1 execute RATE_LIMITS_DB --file=frontend/functions/db/schema.sql
   ```

2. **Configure Stripe Secrets:**
   ```bash
   wrangler secret put STRIPE_SECRET_KEY
   # Paste your sk_live_... key

   wrangler secret put STRIPE_WEBHOOK_SECRET
   # Paste your whsec_... secret
   ```

3. **Update `wrangler.toml`:**
   ```toml
   [vars]
   STRIPE_PUBLISHABLE_KEY = "pk_live_YOUR_KEY_HERE"
   ```

4. **Deploy:**
   ```bash
   npm run build
   npx wrangler pages deploy
   ```

5. **Configure Webhook:**
   - Stripe Dashboard → Developers → Webhooks
   - Add endpoint: `https://your-domain.com/api/stripe-webhook`
   - Events: `checkout.session.completed`, `charge.refunded`

## Monitoring

### Key Metrics

**Business Metrics:**
- Daily conversion rate (free → premium)
- Average pass type preference (24h vs 7d)
- Revenue per day
- Refund rate

**Technical Metrics:**
- Daily limit hit rate
- Pass expiration curve
- Webhook success rate
- Cache hit rate (KV)

### Database Queries

**Daily revenue:**
```sql
SELECT
  DATE(purchased_at) as date,
  COUNT(*) as passes_sold,
  SUM(amount_cents) / 100.0 as revenue_eur,
  pass_type
FROM user_passes
WHERE status = 'active'
  AND purchased_at >= datetime('now', '-30 days')
GROUP BY DATE(purchased_at), pass_type
ORDER BY date DESC;
```

**Free tier usage:**
```sql
SELECT
  date,
  COUNT(DISTINCT client_id) as unique_users,
  AVG(files_converted) as avg_files,
  COUNT(CASE WHEN files_converted >= 3 THEN 1 END) as hit_limit_count
FROM daily_usage
WHERE date >= date('now', '-7 days')
GROUP BY date
ORDER BY date DESC;
```

**Pass expiration forecast:**
```sql
SELECT
  DATE(expires_at) as expiry_date,
  COUNT(*) as passes_expiring,
  pass_type
FROM user_passes
WHERE status = 'active'
  AND expires_at >= datetime('now')
  AND expires_at <= datetime('now', '+7 days')
GROUP BY DATE(expires_at), pass_type
ORDER BY expiry_date ASC;
```

## Troubleshooting

### Common Issues

**Issue: Webhook not receiving events**
- Check webhook URL is publicly accessible
- Verify STRIPE_WEBHOOK_SECRET matches dashboard
- Check Stripe Dashboard → Webhooks → Logs
- Ensure endpoint returns 200 status

**Issue: Pass not activating after payment**
- Check webhook event logged in Stripe
- Verify `checkout.session.completed` event subscribed
- Check D1 database for pass record
- Verify KV cache cleared after creation

**Issue: User still sees daily limit with active pass**
- Check `expires_at` is in the future
- Verify `status = 'active'`
- Clear KV cache: `DELETE pass:${clientId}`
- Check `hasActivePass()` return value

**Issue: Daily limit not resetting**
- Verify server time is UTC
- Check `date` column format (YYYY-MM-DD)
- Ensure new date creates new row
- Check UNIQUE constraint on (client_id, date)

## Future Enhancements

### Potential Features

1. **Subscription Plans**
   - Monthly unlimited: €9.99/month
   - Annual unlimited: €99/year
   - Requires Stripe subscription mode

2. **Usage Analytics Dashboard**
   - Show users their conversion history
   - Track files per day over time
   - Export usage reports

3. **Gift Codes**
   - Generate promo codes
   - Redeem for free passes
   - Track redemption rates

4. **Team Plans**
   - Shared pass pools
   - Multi-user access
   - Usage attribution

5. **API Access**
   - Programmatic conversions
   - API keys for premium users
   - Higher rate limits

6. **Email Notifications**
   - Pass expiration reminders (24h before)
   - Payment receipts
   - Refund confirmations

## Support

For issues or questions:
- GitHub Issues: [github.com/nicolasestrem/Fitbit2Garmin/issues](https://github.com/nicolasestrem/Fitbit2Garmin/issues)
- Email: support@fitbit2garmin.app (if configured)

## License

Same as main project license.
