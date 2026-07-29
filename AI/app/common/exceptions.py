class AIServiceError(Exception):
    error_code = "AI_PROCESSING_FAILED"


class StorageError(AIServiceError):
    error_code = "STORAGE_ACCESS_FAILED"


class VideoDecodeError(AIServiceError):
    error_code = "VIDEO_DECODE_FAILED"


class VideoEncodeError(AIServiceError):
    error_code = "VIDEO_ENCODE_FAILED"


class ModelExecutionError(AIServiceError):
    error_code = "MODEL_EXECUTION_FAILED"


class ValidationError(AIServiceError):
    error_code = "VALIDATION_FAILED"
