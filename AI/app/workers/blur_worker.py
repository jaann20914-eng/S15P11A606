import asyncio
import json
import logging
import tempfile
from datetime import datetime, timezone
from pathlib import PurePosixPath
from typing import Any

from aio_pika.abc import AbstractIncomingMessage
from pydantic import ValidationError

from app.common.exceptions import AIServiceError
from app.core.config import settings
from app.messaging.blur.consumer import get_request_queue
from app.messaging.blur.publisher import publish_result
from app.schemas.blur import BlurRequest, BlurResult
from app.services.blur.face_detector import FaceDetector
from app.services.blur.video_service import VideoService
from app.storage.object_storage import ObjectStorage

# Redis 멱등성 처리를 사용하지 않아 비활성화한다.
# from app.common.idempotency import ClaimResult, IdempotencyStore

logger = logging.getLogger(__name__)


class BlurWorker:
    def __init__(
        self,
        storage: ObjectStorage | None = None,
        video_service: VideoService | None = None,
        # idempotency_store: IdempotencyStore | None = None,
    ) -> None:
        self.storage = storage
        self.video_service = video_service
        # Redis 멱등성 저장소를 생성하지 않는다.
        # self.idempotency_store = (
        #     idempotency_store or IdempotencyStore()
        # )

    async def start(self) -> None:
        # Redis 연결 여부를 확인하지 않는다.
        # await asyncio.to_thread(self.idempotency_store.ping)
        queue = await get_request_queue()
        logger.info(
            "Blur worker started. queue=%s",
            settings.blur_request_queue,
        )
        await queue.consume(self.handle_message, no_ack=False)

    async def handle_message(
        self,
        message: AbstractIncomingMessage,
    ) -> None:
        try:
            request = BlurRequest.model_validate(
                self._decode_message(message)
            )
        except (
            UnicodeDecodeError,
            json.JSONDecodeError,
            ValueError,
            ValidationError,
        ) as exc:
            logger.error("Invalid blur request: %s", exc)
            await message.reject(requeue=False)
            return

        logger.info(
            "Blur request received. requestId=%s pinId=%s",
            request.requestId,
            request.pinId,
        )

        # requestId 멱등성은 ai_blur_job DB의 UNIQUE 제약으로 처리한다.
        # Redis 작업 선점, 중복 검사, 리스 heartbeat는 사용하지 않는다.
        # try:
        #     claimed = await asyncio.to_thread(
        #         self.idempotency_store.try_start,
        #         request.requestId,
        #         request.pinId,
        #         request.originalVideoKey,
        #     )
        # except Exception:
        #     logger.exception(
        #         "Failed to claim requestId=%s",
        #         request.requestId,
        #     )
        #     await message.reject(requeue=False)
        #     return
        #
        # if claimed is ClaimResult.COMPLETED:
        #     logger.info(
        #         "Duplicate blur request ACKed. requestId=%s",
        #         request.requestId,
        #     )
        #     await message.ack()
        #     return
        #
        # if claimed is ClaimResult.CONFLICT:
        #     logger.error(
        #         "Conflicting duplicate blur request rejected. "
        #         "requestId=%s pinId=%s originalVideoKey=%s",
        #         request.requestId,
        #         request.pinId,
        #         request.originalVideoKey,
        #     )
        #     await message.reject(requeue=False)
        #     return
        #
        # if claimed is ClaimResult.BUSY:
        #     logger.info(
        #         "Blur request is owned by another worker; requeueing. "
        #         "requestId=%s",
        #         request.requestId,
        #     )
        #     await asyncio.sleep(settings.busy_requeue_delay_seconds)
        #     await message.reject(requeue=True)
        #     return
        #
        # heartbeat = asyncio.create_task(
        #     self._keep_lease_alive(request)
        # )

        try:
            # 정책상 AI 파이프라인은 재시도하지 않고 한 번만 실행한다.
            result = await self.process_request(request)
        except AIServiceError as exc:
            logger.exception(
                "Blur pipeline failed. requestId=%s errorCode=%s",
                request.requestId,
                exc.error_code,
            )
            result = self._create_failed_result(
                request,
                exc.error_code,
            )
        except Exception:
            logger.exception(
                "Unexpected worker failure. requestId=%s",
                request.requestId,
            )
            result = self._create_failed_result(
                request,
                "INTERNAL_WORKER_ERROR",
            )

        # Redis heartbeat 상태를 확인하지 않는다.
        # if heartbeat.done():
        #     try:
        #         await heartbeat
        #     except Exception:
        #         logger.exception(
        #             "Lost blur request lease. requestId=%s",
        #             request.requestId,
        #         )
        #         await message.reject(requeue=True)
        #         return

        try:
            await publish_result(result.to_message_payload())
        except Exception:
            logger.exception(
                "Failed to publish result. requestId=%s",
                request.requestId,
            )
            # Redis heartbeat 취소 및 작업 선점 해제를 사용하지 않는다.
            # await self._cancel_heartbeat(heartbeat)
            # await self._release_claim(request)
            await message.reject(requeue=False)
            return

        # Redis 리스 확인 및 멱등성 완료 기록을 사용하지 않는다.
        # if heartbeat.done():
        #     try:
        #         await heartbeat
        #     except Exception:
        #         logger.exception(
        #             "Lost lease after publishing result. requestId=%s",
        #             request.requestId,
        #         )
        #         await message.reject(requeue=True)
        #         return
        #
        # try:
        #     await asyncio.to_thread(
        #         self.idempotency_store.complete,
        #         request.requestId,
        #     )
        # except Exception:
        #     logger.exception(
        #         "Failed to complete idempotency record. requestId=%s",
        #         request.requestId,
        #     )
        #     await self._cancel_heartbeat(heartbeat)
        #     await self._release_claim(request)
        #     await message.reject(requeue=False)
        #     return
        #
        # await self._cancel_heartbeat(heartbeat)
        await message.ack()
        logger.info(
            "Blur request completed and ACKed. requestId=%s status=%s",
            request.requestId,
            result.processingStatus,
        )

    # Redis 리스 갱신 및 heartbeat 취소 로직을 사용하지 않는다.
    # async def _keep_lease_alive(self, request: BlurRequest) -> None:
    #     while True:
    #         await asyncio.sleep(
    #             settings.job_lease_renew_interval_seconds
    #         )
    #         renewed = await asyncio.to_thread(
    #             self.idempotency_store.renew,
    #             request.requestId,
    #         )
    #         if not renewed:
    #             raise RuntimeError(
    #                 f"Lost request lease: {request.requestId}"
    #             )
    #
    # @staticmethod
    # async def _cancel_heartbeat(
    #     heartbeat: asyncio.Task[None],
    # ) -> None:
    #     heartbeat.cancel()
    #     try:
    #         await heartbeat
    #     except asyncio.CancelledError:
    #         pass
    #     except Exception:
    #         # Completion can race with one final renewal. Once the caller has
    #         # persisted COMPLETED, a failed renewal is expected and harmless.
    #         pass

    async def process_request(
        self,
        request: BlurRequest,
    ) -> BlurResult:
        return await asyncio.to_thread(
            self._process_request_sync,
            request,
        )

    def _process_request_sync(
        self,
        request: BlurRequest,
    ) -> BlurResult:
        storage = self.storage or ObjectStorage()
        video_service = self.video_service or VideoService(FaceDetector())
        self.storage = storage
        self.video_service = video_service

        output_key = self._build_output_key(request)
        input_suffix = PurePosixPath(request.originalVideoKey).suffix

        with tempfile.TemporaryDirectory(prefix="ai-blur-") as temp_dir:
            input_path = f"{temp_dir}/input{input_suffix}"
            output_path = f"{temp_dir}/output.mp4"

            storage.download(request.originalVideoKey, input_path)
            process_result = video_service.process(
                input_path,
                output_path,
            )

            passed = process_result.final_status == "PASS"
            uploaded_key = (
                storage.upload(output_path, output_key)
                if passed
                else None
            )

        return BlurResult(
            requestId=request.requestId,
            pinId=request.pinId,
            processingStatus="COMPLETED",
            finalStatus=process_result.final_status,
            blurredVideoKey=uploaded_key,
            code=None if passed else "BLUR_VALIDATION_FAILED",
            reasonCodes=process_result.reason_codes,
            detectedFaceCount=process_result.detected_face_count,
            validatedFaceCount=process_result.validated_face_count,
            passCount=process_result.pass_count,
            failCount=process_result.fail_count,
            processingTimeSeconds=process_result.processing_time_seconds,
            completedAt=datetime.now(timezone.utc),
        )

    # Redis 작업 선점 해제 로직을 사용하지 않는다.
    # async def _release_claim(self, request: BlurRequest) -> None:
    #     try:
    #         await asyncio.to_thread(
    #             self.idempotency_store.release,
    #             request.requestId,
    #         )
    #     except Exception:
    #         logger.exception(
    #             "Failed to release request claim. requestId=%s",
    #             request.requestId,
    #         )

    @staticmethod
    def _decode_message(
        message: AbstractIncomingMessage,
    ) -> dict[str, Any]:
        data = json.loads(message.body.decode("utf-8"))
        if not isinstance(data, dict):
            raise ValueError(
                "RabbitMQ message body must be a JSON object."
            )
        return data

    @staticmethod
    def _build_output_key(request: BlurRequest) -> str:
        return (
            f"blurred-videos/{request.pinId}/"
            f"{request.requestId}.mp4"
        )

    @staticmethod
    def _create_failed_result(
        request: BlurRequest,
        error_code: str,
    ) -> BlurResult:
        return BlurResult(
            requestId=request.requestId,
            pinId=request.pinId,
            processingStatus="FAILED",
            finalStatus=None,
            blurredVideoKey=None,
            errorCode=error_code,
            completedAt=datetime.now(timezone.utc),
        )


blur_worker = BlurWorker()
