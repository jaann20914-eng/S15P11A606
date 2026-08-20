"""JSON Lines로 준비한 AI 블러 결과를 RabbitMQ에 일괄 발행한다.

waggle-ai-worker 컨테이너 안에서 실행한다. 컨테이너에 이미 설정된
RABBITMQ_URL과 aio-pika를 재사용하므로 별도의 접속정보나 패키지가 필요 없다.
"""

import asyncio
import json
import os
import sys
from time import perf_counter

import aio_pika

EXCHANGE = "ai.blur.exchange"
ROUTING_KEY = "ai.blur.result"
DEFAULT_BATCH_SIZE = 200


def read_payloads() -> list[bytes]:
    payloads: list[bytes] = []

    for line_number, line in enumerate(sys.stdin, start=1):
        stripped = line.strip()
        if not stripped:
            continue

        try:
            payload = json.loads(stripped)
        except json.JSONDecodeError as exc:
            raise ValueError(f"{line_number}번째 줄이 올바른 JSON이 아닙니다: {exc}") from exc

        payloads.append(
            json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        )

    if not payloads:
        raise ValueError("발행할 메시지가 없습니다.")

    return payloads


async def publish(payloads: list[bytes]) -> float:
    rabbitmq_url = os.environ.get("RABBITMQ_URL")
    if not rabbitmq_url:
        raise RuntimeError("waggle-ai-worker의 RABBITMQ_URL 환경변수가 필요합니다.")

    batch_size = int(os.environ.get("PUBLISH_BATCH_SIZE", DEFAULT_BATCH_SIZE))
    if batch_size < 1:
        raise ValueError("PUBLISH_BATCH_SIZE는 1 이상이어야 합니다.")

    connection = await aio_pika.connect_robust(rabbitmq_url)
    started_at = perf_counter()

    try:
        channel = await connection.channel(publisher_confirms=True)
        exchange = await channel.get_exchange(EXCHANGE)

        for offset in range(0, len(payloads), batch_size):
            batch = payloads[offset : offset + batch_size]
            await asyncio.gather(
                *(
                    exchange.publish(
                        aio_pika.Message(
                            body=body,
                            content_type="application/json",
                            delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
                        ),
                        routing_key=ROUTING_KEY,
                        mandatory=True,
                    )
                    for body in batch
                )
            )
    finally:
        await connection.close()

    return perf_counter() - started_at


async def main() -> None:
    payloads = read_payloads()
    elapsed_seconds = await publish(payloads)
    print(
        f"published={len(payloads)} "
        f"publish_ms={elapsed_seconds * 1000:.1f} "
        f"publish_rate={len(payloads) / elapsed_seconds:.1f}/s"
    )


if __name__ == "__main__":
    asyncio.run(main())
