"""PASS Consumer 벤치마크가 조회할 공유 S3 객체 2개를 준비한다.

AWS 자격증명과 boto3가 이미 있는 waggle-ai-worker 컨테이너 안에서 실행한다.
객체 키는 seed.sql의 PASS 기본값과 일치하며, 같은 키에 덮어쓰므로 재실행해도 안전하다.
"""

import os

import boto3

BLURRED_KEY = os.environ.get(
    "BENCHMARK_BLURRED_KEY",
    "loadtest/consumer-benchmark/shared-blurred.mp4",
)
THUMBNAIL_KEY = os.environ.get(
    "BENCHMARK_THUMBNAIL_KEY",
    "loadtest/consumer-benchmark/shared-thumbnail.jpg",
)


def required_environment(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"{name} 환경변수가 필요합니다.")
    return value


def main() -> None:
    bucket = required_environment("AWS_S3_BUCKET")
    region = os.environ.get("AWS_REGION", "ap-northeast-2")
    s3 = boto3.client("s3", region_name=region)

    fixtures = (
        (BLURRED_KEY, b"consumer-benchmark-video", "video/mp4"),
        (THUMBNAIL_KEY, b"consumer-benchmark-thumbnail", "image/jpeg"),
    )

    for key, body, content_type in fixtures:
        s3.put_object(
            Bucket=bucket,
            Key=key,
            Body=body,
            ContentType=content_type,
        )
        s3.head_object(Bucket=bucket, Key=key)
        print(f"prepared s3://{bucket}/{key}")


if __name__ == "__main__":
    main()
