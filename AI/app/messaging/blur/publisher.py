import json
from typing import Any

from aio_pika import DeliveryMode, Message

from app.core.config import settings
from app.messaging.blur.topology import get_blur_topology


async def publish_result(body: dict[str, Any]) -> None:
    payload = json.dumps(body, ensure_ascii=False, default=str).encode("utf-8")
    message = Message(
        body=payload,
        content_type="application/json",
        delivery_mode=DeliveryMode.PERSISTENT,
    )
    await get_blur_topology().exchange.publish(
        message,
        routing_key=settings.blur_result_routing_key,
        mandatory=True,
    )
