from pathlib import Path

import boto3
from boto3.s3.transfer import S3UploadFailedError
from botocore.client import BaseClient
from botocore.exceptions import BotoCoreError, ClientError

from app.common.exceptions import StorageError
from app.core.config import settings


class ObjectStorage:
    """S3-compatible object-storage adapter."""

    def __init__(self, client: BaseClient | None = None) -> None:
        if client is not None:
            self.client = client
            return

        try:
            self.client = boto3.client(
                "s3",
                endpoint_url=settings.storage_endpoint_url or None,
                aws_access_key_id=settings.storage_access_key or None,
                aws_secret_access_key=settings.storage_secret_key or None,
                region_name=settings.storage_region,
            )
        except (BotoCoreError, ClientError, ValueError) as exc:
            raise StorageError(
                "Failed to initialize object-storage client."
            ) from exc

    def download(self, object_key: str, destination: str | Path) -> Path:
        self._require_bucket()
        destination_path = Path(destination)
        destination_path.parent.mkdir(parents=True, exist_ok=True)

        try:
            self.client.download_file(
                settings.storage_bucket,
                object_key,
                str(destination_path),
            )
        except (
            BotoCoreError,
            ClientError,
            OSError,
        ) as exc:
            raise StorageError(
                f"Failed to download object: {object_key}"
            ) from exc

        return destination_path

    def upload(
        self,
        source: str | Path,
        object_key: str,
        content_type: str = "video/mp4",
    ) -> str:
        self._require_bucket()

        try:
            self.client.upload_file(
                str(source),
                settings.storage_bucket,
                object_key,
                ExtraArgs={"ContentType": content_type},
            )
        except (
            BotoCoreError,
            ClientError,
            S3UploadFailedError,
            OSError,
        ) as exc:
            raise StorageError(
                f"Failed to upload object: {object_key}"
            ) from exc

        return object_key

    @staticmethod
    def _require_bucket() -> None:
        if not settings.storage_bucket:
            raise StorageError("STORAGE_BUCKET is not configured.")
