# 1단계: 런타임 의존성만 설치한 공통 베이스
FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt


# 2단계: 검증 전용. CLAUDE.md의 순서(mypy -> pytest -> ruff)대로 돌린다.
FROM base AS test

COPY requirements-dev.txt .

RUN pip install --no-cache-dir -r requirements-dev.txt

COPY pyproject.toml .
COPY app/ app/
COPY tests/ tests/

# Settings가 필수로 요구하는 값이라 검증 중에만 더미를 넣는다. 이미지에는 남지 않는다.
RUN export INTERNAL_API_KEY=dummy-for-test \
    && mypy app/ \
    && pytest \
    && ruff check .


# 3단계: 실제 배포되는 이미지. 개발 도구와 테스트 코드는 포함하지 않는다.
FROM base AS runtime

RUN useradd --create-home --uid 1000 waggle

COPY app/ app/

USER waggle

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
