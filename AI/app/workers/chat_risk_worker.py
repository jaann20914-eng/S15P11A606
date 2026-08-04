import json
from typing import Any

from aio_pika.abc import AbstractIncomingMessage
from pydantic import ValidationError

from app.clients.back_client import back_client
from app.common.logging import get_logger
from app.core.config import settings
from app.messaging.chat_risk.consumer import get_message_queue
from app.schemas.chat_risk import ChatAnalysisBatch
from app.services.chat_risk import chat_risk_service

logger = get_logger(__name__)


class ChatRiskWorker:
    async def start(self) -> None:
        queue = await get_message_queue()
        logger.info(
            "chat risk worker started | queue=%s",
            settings.chat_message_queue,
        )
        await queue.consume(self.handle_message, no_ack=False)

    async def stop(self) -> None:
        await back_client.close()

    async def handle_message(self, message: AbstractIncomingMessage) -> None:
        try:
            batch = ChatAnalysisBatch.model_validate(self._decode_body(message))
        except (
            UnicodeDecodeError,
            json.JSONDecodeError,
            ValueError,
            ValidationError,
        ) as error:
            # 같은 내용을 다시 보내도 같은 이유로 실패하므로 DLQ에 남겨 원인을 본다.
            logger.error("chat batch rejected | reason=%s", error)
            await message.reject(requeue=False)
            return

        logger.info(
            "chat batch received | requestId=%s roomId=%s messages=%d redelivered=%s",
            batch.requestId,
            batch.roomId,
            len(batch.chatMessages),
            message.redelivered,
        )

        try:
            result = await chat_risk_service.analyze(batch)
            delivered = await back_client.send_pattern_result(result)
        except Exception:
            logger.exception(
                "chat batch processing failed | requestId=%s roomId=%s",
                batch.requestId,
                batch.roomId,
            )
            await message.reject(requeue=False)
            return

        # 콜백이 끝내 실패해도 ACK한다. ACK하지 않으면 같은 메시지가 무한히
        # 재전달되어 뒤따르는 배치까지 밀린다. 결과 한 건을 포기하는 대신
        # 파이프라인을 살리고, 놓치지 않도록 ERROR 로그를 남긴다.
        if not delivered:
            logger.error(
                "chat batch result dropped | requestId=%s roomId=%s",
                batch.requestId,
                batch.roomId,
            )

        await message.ack()
        logger.info(
            "chat batch acked | requestId=%s roomId=%s delivered=%s",
            batch.requestId,
            batch.roomId,
            delivered,
        )

    @staticmethod
    def _decode_body(message: AbstractIncomingMessage) -> dict[str, Any]:
        body = json.loads(message.body.decode("utf-8"))

        if not isinstance(body, dict):
            raise ValueError("Chat batch message body must be a JSON object.")

        return body


chat_risk_worker = ChatRiskWorker()
