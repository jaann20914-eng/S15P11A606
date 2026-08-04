# Redis 멱등성용 worker ID를 사용하지 않아 비활성화한다.
# import os
# import socket
# from uuid import uuid4
#
from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# _PROCESS_INSTANCE_UUID = uuid4().hex
#
#
# def make_process_unique_worker_id(configured_id: str) -> str:
#     base_id = configured_id.strip() or socket.gethostname()
#     process_suffix = (
#         f":{socket.gethostname()}:"
#         f"{os.getpid()}:"
#         f"{_PROCESS_INSTANCE_UUID}"
#     )
#
#     if base_id.endswith(process_suffix):
#         return base_id
#
#     return f"{base_id}{process_suffix}"


class Settings(BaseSettings):
    # Internal API
    # Back은 두 방향의 키를 따로 관리한다. 수신(Back -> AI)은 x-internal-api-key로
    # internal_api_key를, 발신(AI -> Back)은 X-Internal-Secret으로 아래 값을 쓴다.
    internal_api_key: str
    internal_api_secret: str
    log_level: str = "INFO"

    # Recommendation
    scoring_timeout_ms: int = 2000

    # Chat risk callback
    back_base_url: str = "http://localhost:8080"
    chat_callback_timeout_seconds: float = 3.0
    chat_callback_max_retries: int = 2

    # Chat risk analysis
    # 채팅 분석 워커만 쓰는 값이라 비워둘 수 있게 한다. 필수로 두면 이 키가
    # 필요 없는 API 컨테이너까지 기동 시점에 같이 죽는다.
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.1-flash-lite"
    # 운영에서 별도 엔드포인트를 쓰게 될 경우를 위한 자리. None이면 구글 기본 주소.
    gemini_base_url: str | None = None
    gemini_timeout_seconds: float = 10.0
    # 최초 1회 + 재시도 2회 = 최대 3회 호출.
    chat_analysis_max_retries: int = 2

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

    chat_exchange: str = "ai.chat.exchange"
    chat_message_queue: str = "ai.chat.message"
    chat_message_routing_key: str = "ai.chat.message"

    chat_dlx: str = "ai.chat.dlx"
    chat_dead_letter_queue: str = "ai.chat.dead-letter"
    chat_dead_letter_routing_key: str = "ai.chat.dead-letter"

    # SCRFD
    model_name: str = "buffalo_m"
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
    storage_bucket: str = Field(
        default="",
        validation_alias=AliasChoices(
            "STORAGE_BUCKET",
            "AWS_S3_BUCKET",
            "S3_BUCKET_NAME",
        ),
    )
    storage_access_key: str = Field(
        default="",
        validation_alias=AliasChoices(
            "STORAGE_ACCESS_KEY",
            "AWS_ACCESS_KEY_ID",
        ),
    )
    storage_secret_key: str = Field(
        default="",
        validation_alias=AliasChoices(
            "STORAGE_SECRET_KEY",
            "AWS_SECRET_ACCESS_KEY",
        ),
    )
    storage_region: str = Field(
        default="ap-northeast-2",
        validation_alias=AliasChoices(
            "STORAGE_REGION",
            "AWS_REGION",
        ),
    )

    # Redis worker idempotency는 ai_blur_job DB의 UNIQUE 제약으로 대체한다.
    # redis_url: str = "redis://localhost:6379/0"
    # redis_socket_timeout_seconds: float = Field(
    #     default=5.0,
    #     gt=0,
    # )
    # idempotency_key_prefix: str = "ai:blur:job:"
    # idempotency_retention_seconds: int = Field(
    #     default=604800,
    #     ge=3600,
    # )
    # worker_id: str = Field(
    #     default_factory=socket.gethostname,
    #     validate_default=True,
    # )
    # job_lease_seconds: int = Field(
    #     default=300,
    #     ge=30,
    # )
    # job_lease_renew_interval_seconds: int = Field(
    #     default=60,
    #     ge=5,
    # )
    # busy_requeue_delay_seconds: float = Field(
    #     default=2.0,
    #     ge=0.1,
    # )

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # @field_validator("worker_id")
    # @classmethod
    # def make_worker_id_process_unique(
    #     cls,
    #     configured_id: str,
    # ) -> str:
    #     return make_process_unique_worker_id(configured_id)


settings = Settings()
