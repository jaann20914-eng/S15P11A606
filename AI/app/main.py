from fastapi import FastAPI

app = FastAPI(title="와글와글 AI 서버")


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}
