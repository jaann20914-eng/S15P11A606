import asyncio
import logging

from app.core.config import settings
from app.messaging.blur.topology import declare_blur_topology
from app.messaging.chat_risk.topology import declare_chat_risk_topology
from app.messaging.rabbitmq import rabbitmq
from app.workers.blur_worker import blur_worker
from app.workers.chat_risk_worker import chat_risk_worker

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
        await declare_chat_risk_topology()

        logging.info("RabbitMQ connected.")

        await blur_worker.start()
        await chat_risk_worker.start()

        logging.info("AI blur and chat risk workers started.")

        # Worker 프로세스 유지
        await asyncio.Future()

    finally:
        await chat_risk_worker.stop()
        await rabbitmq.close()


if __name__ == "__main__":
    try:
        asyncio.run(main())

    except KeyboardInterrupt:
        logging.info("AI worker stopped.")
