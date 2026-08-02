package com.yuhan.wagglewaggle.domain.pin.dto;

import com.yuhan.wagglewaggle.domain.pin.entity.CrowdLevel;
import com.yuhan.wagglewaggle.domain.place.entity.Place;
import com.yuhan.wagglewaggle.global.jackson.PatchField;

import java.util.List;
import java.util.UUID;

/**
 * 핀 수정 요청 검증을 통과한 뒤의 신뢰 가능한 값 묶음(커맨드).
 *
 * <p>각 필드는 요청의 생략/삭제/변경 의도를 그대로 담는다. 다음 단계(실제 Pin·PinTag 변경,
 * AiBlurJob 생성 등)에서 이 값을 그대로 적용한다.</p>
 *
 * <ul>
 *   <li>{@code originalVideoKey} : absent=유지, 값=교체(검증 완료)</li>
 *   <li>{@code finalPlace} : 최종 장소(항상 non-null). {@code placeChanged}가 true면 요청으로 변경됨</li>
 *   <li>{@code finalCaptureLatitude/Longitude} : 최종 촬영 좌표. {@code captureChanged}가 true면 변경됨</li>
 *   <li>{@code crowdLevel} : absent=유지, 값=변경</li>
 *   <li>{@code detailLocation} : absent=유지, 명시적 null=삭제, 값=변경</li>
 *   <li>{@code memo} : absent=유지, 명시적 null=삭제, 값=변경</li>
 *   <li>{@code tags} : absent=유지, present(정규화된 목록; 빈 목록=전체 삭제)=교체</li>
 * </ul>
 */
public record ValidatedPinUpdate(
        UUID pinId,
        Long memberId,
        PatchField<String> originalVideoKey,
        Place finalPlace,
        boolean placeChanged,
        double finalCaptureLatitude,
        double finalCaptureLongitude,
        boolean captureChanged,
        PatchField<CrowdLevel> crowdLevel,
        PatchField<String> detailLocation,
        PatchField<String> memo,
        PatchField<List<String>> tags
) {
}
