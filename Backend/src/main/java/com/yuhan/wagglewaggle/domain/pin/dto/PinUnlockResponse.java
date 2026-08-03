package com.yuhan.wagglewaggle.domain.pin.dto;

import java.util.UUID;

/**
 * 핀 영상 잠금 해제(POST /api/v1/pins/{pinId}/unlock)의 외부 응답 DTO.
 *
 * <p>대상 핀, 해당 요청에서 차감된 크레딧, 처리 후 잔액, 매 요청마다 새로 발급한 열람용 signed URL,
 * 열람 권한 부여 여부를 반환한다. {@code pinId}는 요청 경로의 pinId와 동일하다.</p>
 *
 * <ul>
 *   <li>{@code creditCharged} — 최초 유료 구매·동일 키 재시도는 3, 새 키로 호출한 기존 구매자·작성자는 0.</li>
 *   <li>{@code creditBalance} — 최초 구매·동일 키 재시도는 최초 거래의 balance_after,
 *       새 키로 호출한 기존 구매자·작성자는 요청 시점의 현재 잔액.</li>
 *   <li>{@code videoUrl} — 현재 blurred_video_key 기준으로 매 요청 시 새로 발급하는 Presigned GET URL.</li>
 *   <li>{@code accessGranted} — 성공 시 항상 true.</li>
 * </ul>
 */
public record PinUnlockResponse(
        UUID pinId,
        int creditCharged,
        int creditBalance,
        String videoUrl,
        boolean accessGranted
) {
}
