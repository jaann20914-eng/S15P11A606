from app.core.config import Settings


def test_storage_settings_accept_backend_aws_environment_names(
    monkeypatch,
) -> None:
    monkeypatch.setenv("INTERNAL_API_KEY", "test-key")
    monkeypatch.setenv("INTERNAL_API_SECRET", "test-secret")
    monkeypatch.setenv("AWS_S3_BUCKET", "test-bucket")
    monkeypatch.setenv("AWS_ACCESS_KEY_ID", "test-access-key")
    monkeypatch.setenv("AWS_SECRET_ACCESS_KEY", "test-secret-key")
    monkeypatch.setenv("AWS_REGION", "us-west-2")
    monkeypatch.delenv("STORAGE_BUCKET", raising=False)
    monkeypatch.delenv("STORAGE_ACCESS_KEY", raising=False)
    monkeypatch.delenv("STORAGE_SECRET_KEY", raising=False)
    monkeypatch.delenv("STORAGE_REGION", raising=False)

    configuration = Settings(_env_file=None)

    assert configuration.storage_bucket == "test-bucket"
    assert configuration.storage_access_key == "test-access-key"
    assert configuration.storage_secret_key == "test-secret-key"
    assert configuration.storage_region == "us-west-2"
