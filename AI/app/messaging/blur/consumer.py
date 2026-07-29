from aio_pika.abc import AbstractQueue

from app.messaging.blur.topology import get_blur_topology


async def get_request_queue() -> AbstractQueue:
    return get_blur_topology().request_queue
