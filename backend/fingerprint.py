"""
Browser fingerprinting and rate limiting for abuse prevention
"""

import hashlib
import json
from datetime import datetime, timedelta
from typing import Dict, Optional, Tuple
from models import FingerprintData, UsageRecord
from storage import get_usage_records

DAILY_LIMIT = 2  # 2 conversions per day


class FingerprintManager:
    """Manages browser fingerprinting and rate limiting"""

    def __init__(self):
        # In-memory storage for demo (use Redis/DB in production)
        self.usage_records: Dict[str, UsageRecord] = get_usage_records()
        self.daily_limit = DAILY_LIMIT

    def generate_composite_fingerprint(self, fingerprint_data: FingerprintData) -> str:
        """Generate a composite fingerprint hash"""
        # Combine multiple data points for robust fingerprinting
        composite_data = {
            "fingerprint": fingerprint_data.fingerprint_hash,
            "user_agent": fingerprint_data.user_agent,
            "screen": fingerprint_data.screen_resolution,
            "timezone": fingerprint_data.timezone,
        }

        # Create deterministic hash
        composite_string = json.dumps(composite_data, sort_keys=True)
        return hashlib.sha256(composite_string.encode()).hexdigest()

    # def check_rate_limit(self, fingerprint_data: FingerprintData, ip_address: str) -> Tuple[bool, UsageRecord]:
    #     """
    #     Check if user has exceeded rate limits

    #     Returns:
    #         (can_proceed, usage_record)
    #     """
    #     fingerprint_hash = self.generate_composite_fingerprint(fingerprint_data)

    #     # Get existing usage record or create new one
    #     if fingerprint_hash in self.usage_records:
    #         usage_record = self.usage_records[fingerprint_hash]

    #         # Check if we need to reset daily counter
    #         if self._should_reset_daily_count(usage_record):
    #             usage_record.conversions_count = 0
    #             usage_record.last_conversion = None

    #     else:
    #         # New user
    #         usage_record = UsageRecord(
    #             fingerprint_hash=fingerprint_hash,
    #             ip_address=ip_address,
    #             conversions_count=0,
    #             created_at=datetime.utcnow(),
    #             updated_at=datetime.utcnow()
    #         )
    #         self.usage_records[fingerprint_hash] = usage_record

    #     # Check if user can proceed
    #     can_proceed = usage_record.conversions_count < self.daily_limit

    #     return can_proceed, usage_record

    # def record_conversion(self, fingerprint_data: FingerprintData, ip_address: str) -> UsageRecord:
    #     """Record a successful conversion"""
    #     fingerprint_hash = self.generate_composite_fingerprint(fingerprint_data)

    #     if fingerprint_hash in self.usage_records:
    #         usage_record = self.usage_records[fingerprint_hash]
    #         usage_record.conversions_count += 1
    #         usage_record.last_conversion = datetime.utcnow()
    #         usage_record.updated_at = datetime.utcnow()
    #     else:
    #         # This shouldn't happen if check_rate_limit was called first
    #         usage_record = UsageRecord(
    #             fingerprint_hash=fingerprint_hash,
    #             ip_address=ip_address,
    #             conversions_count=1,
    #             last_conversion=datetime.utcnow(),
    #             created_at=datetime.utcnow(),
    #             updated_at=datetime.utcnow()
    #         )
    #         self.usage_records[fingerprint_hash] = usage_record

    #     return usage_record

    def get_usage_stats(self, fingerprint_data: FingerprintData, ip_address: str) -> Dict[str, any]:
        """Get current usage statistics for user"""
        can_proceed, usage_record = self.check_rate_limit(fingerprint_data, ip_address)

        # Calculate time until reset
        if usage_record.last_conversion:
            next_reset = usage_record.last_conversion + timedelta(days=1)
            time_until_reset = max(0, int((next_reset - datetime.utcnow()).total_seconds()))
        else:
            time_until_reset = 0

        return {
            "conversions_used": usage_record.conversions_count,
            "conversions_limit": self.daily_limit,
            "time_until_reset": time_until_reset,
            "can_convert": can_proceed
        }

    # def _should_reset_daily_count(self, usage_record: UsageRecord) -> bool:
    #     """Check if daily count should be reset"""
    #     if not usage_record.last_conversion:
    #         return False

    #     # Reset if last conversion was more than 24 hours ago
    #     reset_threshold = usage_record.last_conversion + timedelta(days=1)
    #     return datetime.utcnow() >= reset_threshold

    # def detect_suspicious_activity(self, ip_address: str) -> bool:
    #     """Detect suspicious patterns from the same IP"""
    #     # Count unique fingerprints from this IP in the last hour
    #     recent_threshold = datetime.utcnow() - timedelta(hours=1)
    #     recent_fingerprints = set()

    #     for usage_record in self.usage_records.values():
    #         if (usage_record.ip_address == ip_address and
    #             usage_record.updated_at >= recent_threshold):
    #             recent_fingerprints.add(usage_record.fingerprint_hash)

    #     # Flag if more than 3 different fingerprints from same IP in 1 hour
    #     return len(recent_fingerprints) > 3

    def get_fingerprint_hash(self, fingerprint_data: FingerprintData) -> str:
        """Get the fingerprint hash for external use"""
        return self.generate_composite_fingerprint(fingerprint_data)


# Global instance
fingerprint_manager = FingerprintManager()