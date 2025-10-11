/**
 * @file D1 Database Schema
 * @description This SQL script defines the complete database schema for the TrackerSync
 * application, including tables for rate limiting, user passes, and analytics.
 * It is designed to be used with Cloudflare's D1 database service.
 */

-- =============================================================================
-- Schema for TrackerSync Rate Limiting & Usage Database
-- =============================================================================
-- This schema defines the tables, indexes, views, and triggers for managing
-- API rate limiting, user passes, and analytics for the TrackerSync application.
-- It is designed for use with Cloudflare D1.
--
-- Tables:
--   - rate_limits: Tracks individual requests for sliding window rate limiting.
--   - rate_limit_violations: Logs instances where rate limits are exceeded.
--   - client_reputation: Scores clients based on their request behavior.
--   - rate_limit_config: Defines dynamic rate limit rules.
--   - user_passes: Stores information about purchased premium passes.
--   - daily_usage: Tracks daily file conversion counts for free tier users.
--
-- Views:
--   - rate_limit_analytics: Aggregates request data for monitoring.
--   - violation_analytics: Aggregates violation data.
--   - client_analytics: Provides a summary of client behavior and reputation.
--   - pass_analytics: Aggregates revenue and sales data for passes.
-- =============================================================================


-- =============================================================================
-- TABLE: rate_limits
-- =============================================================================
-- Tracks individual requests within time windows for rate limiting.
-- Each row represents a bucket of requests from a specific client to an endpoint.
CREATE TABLE rate_limits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id TEXT NOT NULL,                -- Unique identifier for the client (e.g., IP address hash)
    endpoint TEXT NOT NULL,                 -- The API endpoint being accessed (e.g., 'uploads', 'conversions')
    timestamp INTEGER NOT NULL,             -- Unix timestamp of the last request in this bucket
    window_start INTEGER NOT NULL,          -- The start of the time window bucket for aggregation (e.g., rounded to the minute)
    request_count INTEGER DEFAULT 1,        -- The number of requests aggregated in this bucket
    metadata TEXT,                          -- JSON object for storing additional request metadata (e.g., user agent)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for efficient lookups and cleanup operations.
CREATE INDEX idx_rate_limits_lookup ON rate_limits(client_id, endpoint, window_start);
CREATE INDEX idx_rate_limits_timestamp ON rate_limits(timestamp);
CREATE INDEX idx_rate_limits_cleanup ON rate_limits(client_id, endpoint, timestamp);


-- =============================================================================
-- TABLE: rate_limit_violations
-- =============================================================================
-- Logs every time a client exceeds a defined rate limit.
-- Used for security analysis and adjusting client reputation.
CREATE TABLE rate_limit_violations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    violation_type TEXT NOT NULL,           -- Type of violation (e.g., 'RATE_EXCEEDED', 'BURST_ATTACK')
    timestamp INTEGER NOT NULL,             -- Unix timestamp of the violation
    current_count INTEGER NOT NULL,         -- The number of requests the client had made
    limit_exceeded INTEGER NOT NULL,        -- The limit that was exceeded
    window_size INTEGER NOT NULL,           -- The duration of the rate limit window in seconds
    client_fingerprint TEXT,                -- Additional browser/client fingerprint hash
    user_agent TEXT,
    country_code TEXT,
    details TEXT,                           -- JSON object for extra details
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_violations_client ON rate_limit_violations(client_id, timestamp);
CREATE INDEX idx_violations_type ON rate_limit_violations(violation_type, timestamp);
CREATE INDEX idx_violations_analysis ON rate_limit_violations(client_id, violation_type, timestamp);


-- =============================================================================
-- TABLE: client_reputation
-- =============================================================================
-- Stores a reputation score for each client to enable adaptive rate limiting.
-- Scores are adjusted based on request patterns and violations.
CREATE TABLE client_reputation (
    client_id TEXT PRIMARY KEY,
    reputation_score INTEGER DEFAULT 100,  -- Score from 0-100 (100 = excellent, 0 = blocked)
    total_requests INTEGER DEFAULT 0,
    violation_count INTEGER DEFAULT 0,
    last_violation DATETIME,
    last_request DATETIME,
    risk_level TEXT DEFAULT 'LOW',         -- 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
    first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_reputation_score ON client_reputation(reputation_score, risk_level);
CREATE INDEX idx_reputation_updated ON client_reputation(updated_at);


-- =============================================================================
-- TABLE: rate_limit_config
-- =============================================================================
-- Defines the specific rate limit rules for different endpoints.
-- Allows for dynamic and client-specific overrides.
CREATE TABLE rate_limit_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id TEXT,                         -- If NULL, this is a default configuration for the endpoint
    endpoint TEXT NOT NULL,
    max_requests INTEGER NOT NULL,
    window_size INTEGER NOT NULL,           -- Window size in seconds
    burst_allowance INTEGER DEFAULT 0,      -- Additional burst capacity (not yet implemented)
    enabled BOOLEAN DEFAULT 1,
    priority INTEGER DEFAULT 0,             -- Higher priority rules override lower ones
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_config_client_endpoint ON rate_limit_config(client_id, endpoint, priority);
CREATE INDEX idx_config_lookup ON rate_limit_config(endpoint, priority);

-- Insert default rate limiting rules for the application.
INSERT INTO rate_limit_config (endpoint, max_requests, window_size, priority) VALUES
('uploads', 20, 300, 0),          -- 20 uploads per 5 minutes
('conversions', 10, 3600, 0),     -- 10 conversions per hour
('validations', 30, 300, 0),      -- 30 validations per 5 minutes
('downloads', 50, 300, 0),        -- 50 downloads per 5 minutes
('suspicious', 100, 60, 0);       -- 100 requests per minute for general abuse detection


-- =============================================================================
-- TABLE: user_passes
-- =============================================================================
-- Stores records of purchased premium passes for unlimited access.
CREATE TABLE user_passes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id TEXT NOT NULL,
    pass_type TEXT NOT NULL,                -- '24h' or '7d'
    stripe_session_id TEXT UNIQUE,
    stripe_payment_intent TEXT,
    amount_cents INTEGER NOT NULL,
    currency TEXT DEFAULT 'eur',
    purchased_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    status TEXT DEFAULT 'active',           -- 'active', 'expired', 'refunded'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_passes_client ON user_passes(client_id, status, expires_at);
CREATE INDEX idx_passes_stripe ON user_passes(stripe_session_id);
CREATE INDEX idx_passes_expiry ON user_passes(expires_at, status);


-- =============================================================================
-- TABLE: daily_usage
-- =============================================================================
-- Tracks daily file conversion counts for free tier users to enforce limits.
CREATE TABLE daily_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id TEXT NOT NULL,
    date TEXT NOT NULL,                     -- Date in 'YYYY-MM-DD' format (UTC)
    files_converted INTEGER DEFAULT 0,
    conversions INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(client_id, date)
);

CREATE INDEX idx_daily_usage_lookup ON daily_usage(client_id, date);
CREATE INDEX idx_daily_usage_cleanup ON daily_usage(date);


-- =============================================================================
-- VIEWS FOR ANALYTICS AND MONITORING
-- =============================================================================

-- View for aggregating rate limit requests over time.
CREATE VIEW rate_limit_analytics AS
SELECT
    endpoint,
    DATE(created_at) as date,
    COUNT(*) as total_requests,
    COUNT(DISTINCT client_id) as unique_clients,
    AVG(request_count) as avg_requests_per_window,
    MAX(request_count) as max_requests_per_window
FROM rate_limits
GROUP BY endpoint, DATE(created_at);

-- View for aggregating violation data.
CREATE VIEW violation_analytics AS
SELECT
    violation_type,
    endpoint,
    DATE(created_at) as date,
    COUNT(*) as violation_count,
    COUNT(DISTINCT client_id) as unique_violators,
    AVG(current_count) as avg_count_at_violation
FROM rate_limit_violations
GROUP BY violation_type, endpoint, DATE(created_at);

-- View for summarizing client behavior and reputation.
CREATE VIEW client_analytics AS
SELECT
    cr.client_id,
    cr.reputation_score,
    cr.risk_level,
    cr.total_requests,
    cr.violation_count,
    COUNT(DISTINCT rl.endpoint) as endpoints_used,
    MAX(rl.timestamp) as last_activity,
    (COUNT(DISTINCT rlv.id) * 1.0 / NULLIF(cr.total_requests, 0)) as violation_rate
FROM client_reputation cr
LEFT JOIN rate_limits rl ON cr.client_id = rl.client_id
LEFT JOIN rate_limit_violations rlv ON cr.client_id = rlv.client_id
GROUP BY cr.client_id;

-- View for aggregating pass sales and revenue data.
CREATE VIEW pass_analytics AS
SELECT
    pass_type,
    DATE(purchased_at) as date,
    COUNT(*) as passes_sold,
    SUM(amount_cents) as revenue_cents,
    COUNT(DISTINCT client_id) as unique_customers
FROM user_passes
WHERE status != 'refunded'
GROUP BY pass_type, DATE(purchased_at);


-- =============================================================================
-- TRIGGERS FOR DATA INTEGRITY AND AUTOMATION
-- =============================================================================

-- Trigger to automatically update a client's reputation score upon a new violation.
CREATE TRIGGER update_client_reputation_on_violation
AFTER INSERT ON rate_limit_violations
BEGIN
    INSERT OR REPLACE INTO client_reputation (
        client_id, reputation_score, total_requests, violation_count,
        last_violation, risk_level, updated_at
    )
    SELECT
        NEW.client_id,
        CASE
            WHEN COALESCE(old.violation_count, 0) + 1 >= 10 THEN 0
            WHEN COALESCE(old.violation_count, 0) + 1 >= 5 THEN 25
            WHEN COALESCE(old.violation_count, 0) + 1 >= 2 THEN 50
            ELSE GREATEST(0, COALESCE(old.reputation_score, 100) - 10)
        END as reputation_score,
        COALESCE(old.total_requests, 0),
        COALESCE(old.violation_count, 0) + 1,
        datetime('now'),
        CASE
            WHEN COALESCE(old.violation_count, 0) + 1 >= 10 THEN 'CRITICAL'
            WHEN COALESCE(old.violation_count, 0) + 1 >= 5 THEN 'HIGH'
            WHEN COALESCE(old.violation_count, 0) + 1 >= 2 THEN 'MEDIUM'
            ELSE 'LOW'
        END as risk_level,
        datetime('now')
    FROM (
        SELECT * FROM client_reputation WHERE client_id = NEW.client_id
    ) old;
END;

-- Trigger to update a client's total request count and last seen timestamp.
CREATE TRIGGER update_request_count_on_rate_limit
AFTER INSERT ON rate_limits
BEGIN
    INSERT OR REPLACE INTO client_reputation (
        client_id, reputation_score, total_requests, violation_count,
        last_request, updated_at
    )
    SELECT
        NEW.client_id,
        COALESCE(old.reputation_score, 100),
        COALESCE(old.total_requests, 0) + NEW.request_count,
        COALESCE(old.violation_count, 0),
        datetime('now'),
        datetime('now')
    FROM (
        SELECT * FROM client_reputation WHERE client_id = NEW.client_id
    ) old;
END;