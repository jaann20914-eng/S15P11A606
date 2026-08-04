from dataclasses import dataclass
from typing import Any

from aio_pika import ExchangeType
from aio_pika.abc import AbstractExchange, AbstractQueue

from app.core.config import settings
from app.messaging.rabbitmq import rabbitmq


@dataclass(frozen=True)
class ChatRiskTopology:
    exchange: AbstractExchange
    dead_letter_exchange: AbstractExchange
    message_queue: AbstractQueue


_topology: ChatRiskTopology | None = None


async def declare_chat_risk_topology() -> ChatRiskTopology:
    global _topology

    channel = rabbitmq.require_channel()
    exchange = await channel.declare_exchange(
        settings.chat_exchange,
        ExchangeType.DIRECT,
        durable=True,
    )
    dead_letter_exchange = await channel.declare_exchange(
        settings.chat_dlx,
        ExchangeType.DIRECT,
        durable=True,
    )
    # 거부된 메시지가 갈 곳. dead-letter 큐 자신에게는 걸지 않는다 — 순환한다.
    queue_arguments: dict[str, Any] = {
        "x-dead-letter-exchange": settings.chat_dlx,
        "x-dead-letter-routing-key": settings.chat_dead_letter_routing_key,
    }
    message_queue = await channel.declare_queue(
        settings.chat_message_queue,
        durable=True,
        arguments=queue_arguments,
    )
    await message_queue.bind(
        exchange,
        routing_key=settings.chat_message_routing_key,
    )
    dead_letter_queue = await channel.declare_queue(
        settings.chat_dead_letter_queue,
        durable=True,
    )
    await dead_letter_queue.bind(
        dead_letter_exchange,
        routing_key=settings.chat_dead_letter_routing_key,
    )

    _topology = ChatRiskTopology(
        exchange=exchange,
        dead_letter_exchange=dead_letter_exchange,
        message_queue=message_queue,
    )
    return _topology


def get_chat_risk_topology() -> ChatRiskTopology:
    if _topology is None:
        raise RuntimeError("Chat risk topology has not been declared.")
    return _topology
