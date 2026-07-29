import os
import socket
from uuid import uuid4

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_PROCESS_INSTANCE_UUID = uuid4().hex


def make_process_unique_worker_id(configured_id: str) -> str:
    base_id = configured_id.strip() or socket.gethostname()
    process_suffix = (
        f":{socket.gethostname()}:"
        f"{os.getpid()}:"
        f"{_PROCESS_INSTANCE_UUID}"
    )

    if base_id.endswith(process_suffix):
        return base_id

    return f"{base_id}{process_suffix}"


class Settings(BaseSettings):
    # Internal API
    internal_api_key: str
    log_level: str = "INFO"

    # RabbitMQ
    rabbitmq_url: str = "amqp://guest:guest@localhost:5672/"

    blur_exchange: str = "ai.blur.exchange"
    blur_request_queue: str = "ai.blur.request"
    blur_request_routing_key: str = "ai.blur.request"

    blur_result_queue: str = "ai.blur.result"
    blur_result_routing_key: str = "ai.blur.result"

    blur_dlx: str = "ai.blur.dlx"
    blur_dead_letter_queue: str = "ai.blur.dead-letter"
    blur_dead_letter_routing_key: str = "ai.blur.dead-letter"

    # SCRFD
    model_name: str = "buffalo_sc"
    det_threshold: float = 0.3
    det_width: int = 640
    det_height: int = 640

    # Blur
    margin_ratio: float = 0.3
    blur_kernel_size: int = 51
    blur_iterations: int = 2

    # Validation
    validate_interval: int = 5
    max_sharpness_ratio: float = 0.6
    min_roi_size: int = 8

    # Object Storage
    storage_endpoint_url: str | None = None
    storage_bucket: str = ""
    storage_access_key: str = ""
    storage_secret_key: str = ""
    storage_region: str = "ap-northeast-2"

    # Worker idempotency
    redis_url: str = "redis://localhost:6379/0"
    redis_socket_timeout_seconds: float = Field(
        default=5.0,
        gt=0,
    )
    idempotency_key_prefix: str = "ai:blur:job:"
    idempotency_retention_seconds: int = Field(
        default=604800,
        ge=3600,
    )
    worker_id: str = Field(
        default_factory=socket.gethostname,
        validate_default=True,
    )
    job_lease_seconds: int = Field(
        default=300,
        ge=30,
    )
    job_lease_renew_interval_seconds: int = Field(
        default=60,
        ge=5,
    )
    busy_requeue_delay_seconds: float = Field(
        default=2.0,
        ge=0.1,
    )

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @field_validator("worker_id")
    @classmethod
    def make_worker_id_process_unique(
        cls,
        configured_id: str,
    ) -> str:
        return make_process_unique_worker_id(configured_id)


settings = Settings()