import logging


def get_logger(name: str) -> logging.Logger:
    logger = logging.getLogger(name)

    if not logger.handlers:
        handler = logging.StreamHandler()

        formatter = logging.Formatter(
            "%(asctime)s | %(levelname)s | %(name)s | %(message)s"
        )

        handler.setFormatter(formatter)
        logger.addHandler(handler)

    # 이 핸들러로 이미 출력하므로 상위 로거로 올리지 않는다. 올리면 basicConfig가
    # 설정한 최상위 핸들러가 같은 줄을 한 번 더 찍는다.
    logger.propagate = False
    logger.setLevel(logging.INFO)

    return logger