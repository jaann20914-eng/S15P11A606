import asyncio
import logging

from app.messaging.blur.topology import declare_blur_topology
from app.messaging.rabbitmq import rabbitmq
from app.workers.blur_worker import blur_worker
from app.core.config import settings

logging.basicConfig(
    level=getattr(
        logging,
        settings.log_level.upper(),
        logging.INFO,
    ),
    format=(
        "%(asctime)s "
        "%(levelname)s "
        "%(name)s - "
        "%(message)s"
    ),
)


async def main() -> None:
    try:
        await rabbitmq.connect()
        await declare_blur_topology()

        logging.info("RabbitMQ connected.")

        await blur_worker.start()

        logging.info("AI blur worker started.")

        # Worker 프로세스 유지
        await asyncio.Future()

    finally:
        await rabbitmq.close()


if __name__ == "__main__":
    try:
        asyncio.run(main())

    except KeyboardInterrupt:
        logging.info("AI worker stopped.")
