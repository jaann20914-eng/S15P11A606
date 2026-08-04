from aio_pika.abc import AbstractQueue

from app.messaging.chat_risk.topology import get_chat_risk_topology


async def get_message_queue() -> AbstractQueue:
    return get_chat_risk_topology().message_queue
