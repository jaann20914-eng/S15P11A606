import aio_pika
from aio_pika.abc import AbstractChannel

from app.core.config import settings


class RabbitMQClient:
    """Owns the shared RabbitMQ connection and channel only."""

    def __init__(self) -> None:
        self.connection: aio_pika.RobustConnection | None = None
        self.channel: AbstractChannel | None = None

    async def connect(self) -> None:
        self.connection = await aio_pika.connect_robust(settings.rabbitmq_url)
        self.channel = await self.connection.channel(
            publisher_confirms=True,
            on_return_raises=True,
        )
        await self.channel.set_qos(prefetch_count=1)

    def require_channel(self) -> AbstractChannel:
        if self.channel is None:
            raise RuntimeError("RabbitMQ connection is not initialized.")
        return self.channel

    async def close(self) -> None:
        if self.connection is not None:
            await self.connection.close()
        self.channel = None
        self.connection = None


rabbitmq = RabbitMQClient()
