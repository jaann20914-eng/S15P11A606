# 1단계: 런타임 의존성만 설치한 공통 베이스
FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# opencv와 영상 처리에 필요한 시스템 라이브러리
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ffmpeg \
        libgl1 \
        libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt


# 2단계: 검증 전용. mypy -> pytest -> ruff
FROM base AS test

COPY requirements-dev.txt .

RUN pip install --no-cache-dir -r requirements-dev.txt

COPY pyproject.toml .
COPY app/ app/
COPY tests/ tests/

# Settings가 필수로 요구하는 값이라 검증 중에만 더미를 넣는다. 이미지에는 남지 않는다.
RUN export INTERNAL_API_KEY=dummy-for-test \
    && export INTERNAL_API_SECRET=dummy-for-test \
    && mypy app/ \
    && pytest \
    && ruff check .


# 3단계: 실제 배포되는 이미지. 앱과 워커가 이 이미지를 공유한다.
FROM base AS runtime

RUN useradd --create-home --uid 1000 waggle

COPY app/ app/
COPY worker.py .

USER waggle

EXPOSE 8000

# 앱은 이 CMD로 뜨고, 워커 컨테이너는 실행 시 `python worker.py`로 덮어쓴다.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
