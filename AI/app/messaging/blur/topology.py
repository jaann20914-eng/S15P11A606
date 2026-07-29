from dataclasses import dataclass

from aio_pika import ExchangeType
from aio_pika.abc import AbstractExchange, AbstractQueue

from app.core.config import settings
from app.messaging.rabbitmq import rabbitmq


@dataclass(frozen=True)
class BlurTopology:
    exchange: AbstractExchange
    dead_letter_exchange: AbstractExchange
    request_queue: AbstractQueue
    result_queue: AbstractQueue


_topology: BlurTopology | None = None


async def declare_blur_topology() -> BlurTopology:
    global _topology

    channel = rabbitmq.require_channel()
    exchange = await channel.declare_exchange(
        settings.blur_exchange,
        ExchangeType.DIRECT,
        durable=True,
    )
    dead_letter_exchange = await channel.declare_exchange(
        settings.blur_dlx,
        ExchangeType.DIRECT,
        durable=True,
    )
    queue_arguments = {
        "x-dead-letter-exchange": settings.blur_dlx,
        "x-dead-letter-routing-key": settings.blur_dead_letter_routing_key,
    }
    request_queue = await channel.declare_queue(
        settings.blur_request_queue,
        durable=True,
        arguments=queue_arguments,
    )
    await request_queue.bind(
        exchange,
        routing_key=settings.blur_request_routing_key,
    )
    result_queue = await channel.declare_queue(
        settings.blur_result_queue,
        durable=True,
        arguments=queue_arguments,
    )
    await result_queue.bind(
        exchange,
        routing_key=settings.blur_result_routing_key,
    )
    dead_letter_queue = await channel.declare_queue(
        settings.blur_dead_letter_queue,
        durable=True,
    )
    await dead_letter_queue.bind(
        dead_letter_exchange,
        routing_key=settings.blur_dead_letter_routing_key,
    )

    _topology = BlurTopology(
        exchange=exchange,
        dead_letter_exchange=dead_letter_exchange,
        request_queue=request_queue,
        result_queue=result_queue,
    )
    return _topology


def get_blur_topology() -> BlurTopology:
    if _topology is None:
        raise RuntimeError("Blur topology has not been declared.")
    return _topology
