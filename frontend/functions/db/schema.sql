-- Fitbit2Garmin Rate Limiting Database Schema
-- Implements atomic sliding window rate limiting with ACID guarantees

-- Main rate limiting table with sliding window support
CREATE TABLE rate_limits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    timestamp INTEGER NOT NULL,          -- Unix timestamp of request
    window_start INTEGER NOT NULL,       -- Start of time window (for aggregation)
    request_count INTEGER DEFAULT 1,     -- Number of requests in this window bucket
    metadata TEXT,                       -- JSON metadata (user agent, etc.)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Optimized indexes for sliding window queries
CREATE INDEX idx_rate_limits_lookup ON rate_limits(client_id, endpoint, window_start);
CREATE INDEX idx_rate_limits_timestamp ON rate_limits(timestamp);
CREATE INDEX idx_rate_limits_cleanup ON rate_limits(client_id, endpoint, timestamp);

-- Rate limit violations and suspicious activity tracking
CREATE TABLE rate_limit_violations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    violation_type TEXT NOT NULL,        -- 'RATE_EXCEEDED', 'BURST_ATTACK', 'SUSPICIOUS_PATTERN'
    timestamp INTEGER NOT NULL,
    current_count INTEGER NOT NULL,
    limit_exceeded INTEGER NOT NULL,
    window_size INTEGER NOT NULL,
    client_fingerprint TEXT,             -- Additional client identification
    user_agent TEXT,
    country_code TEXT,
    details TEXT,                        -- JSON with additional violation details
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_violations_client ON rate_limit_violations(client_id, timestamp);
CREATE INDEX idx_violations_type ON rate_limit_violations(violation_type, timestamp);
CREATE INDEX idx_violations_analysis ON rate_limit_violations(client_id, violation_type, timestamp);

-- Client reputation scoring (for intelligent rate limiting)
CREATE TABLE client_reputation (
    client_id TEXT PRIMARY KEY,
    reputation_score INTEGER DEFAULT 100,  -- 0-100, 100 = excellent, 0 = blocked
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

-- Rate limiting configuration (dynamic limits per client/endpoint)
CREATE TABLE rate_limit_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id TEXT,                      -- NULL for default config
    endpoint TEXT NOT NULL,
    max_requests INTEGER NOT NULL,
    window_size INTEGER NOT NULL,        -- Window size in seconds
    burst_allowance INTEGER DEFAULT 0,   -- Additional burst capacity
    enabled BOOLEAN DEFAULT 1,
    priority INTEGER DEFAULT 0,          -- Higher priority rules override lower
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_config_client_endpoint ON rate_limit_config(client_id, endpoint, priority);
CREATE INDEX idx_config_lookup ON rate_limit_config(endpoint, priority);

-- Insert default rate limiting configuration
INSERT INTO rate_limit_config (endpoint, max_requests, window_size, priority) VALUES
('uploads', 20, 300, 0),          -- 20 uploads per 5 minutes
('conversions', 10, 3600, 0),     -- 10 conversions per hour
('validations', 30, 300, 0),      -- 30 validations per 5 minutes
('downloads', 50, 300, 0),        -- 50 downloads per 5 minutes
('suspicious', 100, 60, 0);       -- 100 requests per minute for abuse detection

-- Analytics and monitoring views
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

-- Cleanup procedures (to be run periodically)
-- Note: These will be implemented in JavaScript for atomic execution

-- Triggers for maintaining data integrity
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