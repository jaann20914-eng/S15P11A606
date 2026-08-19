#!/usr/bin/env bash
set -Eeuo pipefail

# AI 블러 결과 Consumer 처리량 측정기.
#
# 기본 모드(PAUSE_BACKEND=0)는 실행 중인 Consumer에 메시지를 발행한 시점부터
# 전부 처리될 때까지의 end-to-end 시간을 잰다.
# PAUSE_BACKEND=1이면 백엔드를 잠시 멈추고 메시지를 큐에 모두 쌓은 다음,
# 백엔드를 재개한 순간부터 순수한 Queue 배출 시간을 잰다.
# 반드시 부하테스트 전용 환경에서 실행한다.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MESSAGES_FILE="${1:-${SCRIPT_DIR}/messages.jsonl}"

AI_WORKER_CONTAINER="${AI_WORKER_CONTAINER:-waggle-ai-worker}"
BACKEND_CONTAINER="${BACKEND_CONTAINER:-waggle-backend}"
DB_CONTAINER="${DB_CONTAINER:-waggle-postgis}"
DB_USER="${DB_USER:-waggle}"
DB_NAME="${DB_NAME:-wagglewaggle}"
PAUSE_BACKEND="${PAUSE_BACKEND:-0}"
TIMEOUT_SECONDS="${TIMEOUT_SECONDS:-120}"
POLL_INTERVAL_SECONDS="${POLL_INTERVAL_SECONDS:-0.2}"
RUN_LABEL="${RUN_LABEL:-consumer-benchmark}"
RESULT_FILE="${RESULT_FILE:-}"
REMOTE_PUBLISHER="/tmp/waggle-consumer-benchmark-publish.py"

backend_paused=0

cleanup() {
    if [[ "${backend_paused}" == "1" ]]; then
        docker unpause "${BACKEND_CONTAINER}" >/dev/null 2>&1 || true
    fi
}
trap cleanup EXIT INT TERM

fail() {
    echo "ERROR: $*" >&2
    exit 1
}

now_millis() {
    date +%s%3N
}

job_count() {
    local status_condition="$1"
    docker exec "${DB_CONTAINER}" \
        psql -U "${DB_USER}" -d "${DB_NAME}" -qAt \
        -c "SELECT count(*)
            FROM ai_blur_jobs
            WHERE original_video_key LIKE 'loadtest/consumer-benchmark/%'
              AND ${status_condition};" \
        | tr -d '[:space:]'
}

[[ -s "${MESSAGES_FILE}" ]] || fail "메시지 파일이 없거나 비어 있습니다: ${MESSAGES_FILE}"
[[ "${PAUSE_BACKEND}" == "0" || "${PAUSE_BACKEND}" == "1" ]] \
    || fail "PAUSE_BACKEND는 0 또는 1이어야 합니다."
[[ "${TIMEOUT_SECONDS}" =~ ^[1-9][0-9]*$ ]] \
    || fail "TIMEOUT_SECONDS는 1 이상의 정수여야 합니다."

for container in "${AI_WORKER_CONTAINER}" "${BACKEND_CONTAINER}" "${DB_CONTAINER}"; do
    [[ "$(docker inspect -f '{{.State.Running}}' "${container}" 2>/dev/null)" == "true" ]] \
        || fail "실행 중인 컨테이너를 찾을 수 없습니다: ${container}"
done

expected_count="$(grep -cve '^[[:space:]]*$' "${MESSAGES_FILE}")"
[[ "${expected_count}" -gt 0 ]] || fail "발행할 JSON 메시지가 없습니다."

pending_count="$(job_count "status = 'PENDING'")"
[[ "${pending_count}" == "${expected_count}" ]] \
    || fail "PENDING Job(${pending_count})과 메시지 수(${expected_count})가 다릅니다. seed.sql을 다시 실행하세요."

docker cp "${SCRIPT_DIR}/publish.py" \
    "${AI_WORKER_CONTAINER}:${REMOTE_PUBLISHER}" >/dev/null

if [[ "${PAUSE_BACKEND}" == "1" ]]; then
    echo "백엔드를 잠시 멈추고 ${expected_count}개 메시지를 Queue에 먼저 적재합니다."
    docker pause "${BACKEND_CONTAINER}" >/dev/null
    backend_paused=1

    docker exec -i "${AI_WORKER_CONTAINER}" \
        python "${REMOTE_PUBLISHER}" < "${MESSAGES_FILE}"

    started_at_ms="$(now_millis)"
    docker unpause "${BACKEND_CONTAINER}" >/dev/null
    backend_paused=0
    measure_mode="queue-drain"
else
    echo "실행 중인 Consumer에 ${expected_count}개 메시지를 발행합니다."
    started_at_ms="$(now_millis)"
    docker exec -i "${AI_WORKER_CONTAINER}" \
        python "${REMOTE_PUBLISHER}" < "${MESSAGES_FILE}"
    measure_mode="publish-and-drain"
fi

deadline_ms=$((started_at_ms + TIMEOUT_SECONDS * 1000))

while true; do
    processed_count="$(job_count "status <> 'PENDING'")"
    current_ms="$(now_millis)"

    if [[ "${processed_count}" == "${expected_count}" ]]; then
        break
    fi
    if (( current_ms >= deadline_ms )); then
        fail "${TIMEOUT_SECONDS}초 안에 처리되지 않았습니다 (${processed_count}/${expected_count}). Backend 로그와 DLQ를 확인하세요."
    fi

    sleep "${POLL_INTERVAL_SECONDS}"
done

finished_at_ms="$(now_millis)"
elapsed_ms=$((finished_at_ms - started_at_ms))
throughput="$(awk -v count="${expected_count}" -v millis="${elapsed_ms}" \
    'BEGIN { if (millis == 0) print "0.0"; else printf "%.1f", count * 1000 / millis }')"
failed_count="$(job_count "status = 'FAILED'")"
completed_count="$(job_count "status = 'COMPLETED'")"
measured_at="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"

result="$(printf \
    '{"measuredAt":"%s","label":"%s","mode":"%s","messages":%d,"elapsedMs":%d,"throughputPerSecond":%s,"failedJobs":%d,"completedJobs":%d}' \
    "${measured_at}" "${RUN_LABEL}" "${measure_mode}" "${expected_count}" \
    "${elapsed_ms}" "${throughput}" "${failed_count}" "${completed_count}")"

echo
echo "처리 완료: ${processed_count}/${expected_count}"
echo "측정 시간: ${elapsed_ms} ms"
echo "처리량: ${throughput} messages/s"
echo "결과 JSON: ${result}"

if [[ -n "${RESULT_FILE}" ]]; then
    mkdir -p "$(dirname "${RESULT_FILE}")"
    printf '%s\n' "${result}" > "${RESULT_FILE}"
    echo "결과 저장: ${RESULT_FILE}"
fi
