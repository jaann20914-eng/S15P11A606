# Redis idempotency disabled: ai_blur_job DB UNIQUE 사용
# from datetime import datetime, timezone
# from enum import Enum
# from uuid import UUID
#
# import redis
#
# from app.core.config import (
#     make_process_unique_worker_id,
#     settings,
# )
#
#
# class ClaimResult(str, Enum):
#     CLAIMED = "CLAIMED"
#     BUSY = "BUSY"
#     COMPLETED = "COMPLETED"
#     CONFLICT = "CONFLICT"
#
#
# _TRY_START_SCRIPT = """
# local key = KEYS[1]
# local pin_id = ARGV[1]
# local original_video_key = ARGV[2]
# local worker_id = ARGV[3]
# local lease_ms = tonumber(ARGV[4])
# local updated_at = ARGV[5]
#
# if redis.call("EXISTS", key) == 0 then
#     redis.call(
#         "HSET",
#         key,
#         "status", "PROCESSING",
#         "pin_id", pin_id,
#         "original_video_key", original_video_key,
#         "worker_id", worker_id,
#         "updated_at", updated_at
#     )
#     redis.call("PEXPIRE", key, lease_ms)
#     return "CLAIMED"
# end
#
# local stored_pin_id = redis.call("HGET", key, "pin_id")
# local stored_video_key = redis.call("HGET", key, "original_video_key")
# if stored_pin_id ~= pin_id or stored_video_key ~= original_video_key then
#     return "CONFLICT"
# end
#
# if redis.call("HGET", key, "status") == "COMPLETED" then
#     return "COMPLETED"
# end
#
# return "BUSY"
# """
#
#
# _RENEW_SCRIPT = """
# local key = KEYS[1]
# local worker_id = ARGV[1]
# local lease_ms = tonumber(ARGV[2])
# local updated_at = ARGV[3]
#
# if redis.call("HGET", key, "status") ~= "PROCESSING" then
#     return 0
# end
# if redis.call("HGET", key, "worker_id") ~= worker_id then
#     return 0
# end
#
# redis.call("HSET", key, "updated_at", updated_at)
# redis.call("PEXPIRE", key, lease_ms)
# return 1
# """
#
#
# _COMPLETE_SCRIPT = """
# local key = KEYS[1]
# local worker_id = ARGV[1]
# local retention_ms = tonumber(ARGV[2])
# local updated_at = ARGV[3]
#
# if redis.call("HGET", key, "status") ~= "PROCESSING" then
#     return 0
# end
# if redis.call("HGET", key, "worker_id") ~= worker_id then
#     return 0
# end
#
# redis.call(
#     "HSET",
#     key,
#     "status", "COMPLETED",
#     "updated_at", updated_at
# )
# redis.call("HDEL", key, "worker_id")
# redis.call("PEXPIRE", key, retention_ms)
# return 1
# """
#
#
# _RELEASE_SCRIPT = """
# local key = KEYS[1]
# local worker_id = ARGV[1]
#
# if redis.call("HGET", key, "status") ~= "PROCESSING" then
#     return 0
# end
# if redis.call("HGET", key, "worker_id") ~= worker_id then
#     return 0
# end
#
# return redis.call("DEL", key)
# """
#
#
# class IdempotencyStore:
#     """Redis-backed request claim store shared by all worker replicas."""
#
#     def __init__(
#         self,
#         redis_url: str | None = None,
#         worker_id: str | None = None,
#         lease_seconds: int | None = None,
#         retention_seconds: int | None = None,
#         key_prefix: str | None = None,
#         client: redis.Redis | None = None,
#     ) -> None:
#         self.worker_id = make_process_unique_worker_id(
#             worker_id or settings.worker_id
#         )
#         self.lease_seconds = (
#             lease_seconds
#             if lease_seconds is not None
#             else settings.job_lease_seconds
#         )
#         self.retention_seconds = (
#             retention_seconds
#             if retention_seconds is not None
#             else settings.idempotency_retention_seconds
#         )
#         self.key_prefix = key_prefix or settings.idempotency_key_prefix
#         self.client = client or redis.Redis.from_url(
#             redis_url or settings.redis_url,
#             decode_responses=True,
#             socket_connect_timeout=settings.redis_socket_timeout_seconds,
#             socket_timeout=settings.redis_socket_timeout_seconds,
#             health_check_interval=30,
#         )
#
#     def ping(self) -> None:
#         if not self.client.ping():
#             raise RuntimeError("Redis ping failed.")
#
#     def try_start(
#         self,
#         request_id: UUID,
#         pin_id: UUID,
#         original_video_key: str,
#     ) -> ClaimResult:
#         result = self.client.eval(
#             _TRY_START_SCRIPT,
#             1,
#             self._key(request_id),
#             str(pin_id),
#             original_video_key,
#             self.worker_id,
#             self.lease_seconds * 1000,
#             self._now(),
#         )
#         return ClaimResult(result)
#
#     def renew(self, request_id: UUID) -> bool:
#         result = self.client.eval(
#             _RENEW_SCRIPT,
#             1,
#             self._key(request_id),
#             self.worker_id,
#             self.lease_seconds * 1000,
#             self._now(),
#         )
#         return bool(result)
#
#     def complete(self, request_id: UUID) -> None:
#         result = self.client.eval(
#             _COMPLETE_SCRIPT,
#             1,
#             self._key(request_id),
#             self.worker_id,
#             self.retention_seconds * 1000,
#             self._now(),
#         )
#         if not result:
#             raise RuntimeError(
#                 f"Could not complete owned request: {request_id}"
#             )
#
#     def release(self, request_id: UUID) -> None:
#         self.client.eval(
#             _RELEASE_SCRIPT,
#             1,
#             self._key(request_id),
#             self.worker_id,
#         )
#
#     def _key(self, request_id: UUID) -> str:
#         return f"{self.key_prefix}{request_id}"
#
#     @staticmethod
#     def _now() -> str:
#         return datetime.now(timezone.utc).isoformat()
#