"""로컬 검증용 채팅 배치 발행 스크립트. Back 스케줄러 대신 큐에 1건을 넣는다.

실행: python -m scripts.publish_test_batch [normal|broken]
"""

import asyncio
import json
import sys
from datetime import UTC, datetime
from uuid import uuid4

import aio_pika

from app.core.config import settings

NORMAL_BATCH = {
    "roomId": 1,
    "chatMessages": [
        {"senderId": 2, "content": "카카오톡으로 연락해 주세요."},
        {"senderId": 3, "content": "제 전화번호는..."},
    ],
}

# requestId가 UUID가 아니라 스키마 검증에서 걸린다. DLQ 동작 확인용.
BROKEN_BATCH = {
    "requestId": "not-a-uuid",
    "roomId": 1,
    "chatMessages": [],
}


def build_payload(scenario: str) -> dict[str, object]:
    if scenario == "broken":
        return dict(BROKEN_BATCH)

    return {
        "requestId": str(uuid4()),
        "sentAt": datetime.now(UTC).isoformat(),
        **NORMAL_BATCH,
    }


async def publish(scenario: str) -> None:
    payload = build_payload(scenario)
    connection = await aio_pika.connect_robust(settings.rabbitmq_url)

    try:
        channel = await connection.channel()
        # 큐는 워커가 선언한다. 여기서 만들면 워커 없이도 큐가 생겨 검증이 흐려진다.
        exchange = await channel.get_exchange(settings.chat_exchange)
        await exchange.publish(
            aio_pika.Message(
                body=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
                content_type="application/json",
                delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
            ),
            routing_key=settings.chat_message_routing_key,
        )
    finally:
        await connection.close()

    print(f"published {scenario} | requestId={payload.get('requestId')}")


if __name__ == "__main__":
    scenario = sys.argv[1] if len(sys.argv) > 1 else "normal"

    if scenario not in {"normal", "broken"}:
        raise SystemExit("scenario must be 'normal' or 'broken'")

    asyncio.run(publish(scenario))
