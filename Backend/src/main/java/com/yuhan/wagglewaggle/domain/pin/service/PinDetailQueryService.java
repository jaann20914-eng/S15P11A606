package com.yuhan.wagglewaggle.domain.pin.service;

import com.yuhan.wagglewaggle.domain.pin.dto.PinDetail;
import com.yuhan.wagglewaggle.domain.pin.entity.Pin;
import com.yuhan.wagglewaggle.domain.pin.entity.PinTag;
import com.yuhan.wagglewaggle.domain.pin.repository.PinRepository;
import com.yuhan.wagglewaggle.domain.pin.repository.PinTagRepository;
import com.yuhan.wagglewaggle.domain.place.entity.Place;
import com.yuhan.wagglewaggle.domain.user.entity.Member;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * 영상 핀 상세 조회(GET /api/v1/pins/{pinId})의 기본 데이터 조회 애플리케이션 서비스.
 *
 * <p>이 단계에서는 상세 표시에 필요한 기본 데이터(작성자·장소·혼잡 정보·태그)만 조회한다.
 * 사용자별 접근 수준, 평가·채팅 상태, Presigned GET URL 발급은 다루지 않는다.</p>
 *
 * <p>조회 가능한 핀은 (1) 요청 pinId 일치, (2) videoStatus=ACTIVE, (3) 삭제되지 않음,
 * (4) 만료되지 않음(expiresAt이 현재 시각 이후)을 모두 만족해야 한다. 하나라도 어긋나면
 * — 존재하지 않는 핀, PENDING·REJECTED·FAILED, 삭제된 핀, 만료된 핀 — 실제 상태를 구분해
 * 노출하지 않고 모두 동일하게 {@link ErrorCode#PIN_NOT_FOUND}로 처리한다.</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PinDetailQueryService {

    private final PinRepository pinRepository;
    private final PinTagRepository pinTagRepository;

    /**
     * 조회 가능한 핀의 상세 기본 데이터를 조회한다.
     *
     * <p>핀 판정(ACTIVE·미삭제·미만료)은 조회 쿼리에서 한 번에 수행하며, 조회 결과가 없으면
     * 실제 존재 여부·사유를 구분하지 않고 PIN_NOT_FOUND(404)로 처리한다.</p>
     *
     * <p>작성자·장소는 조회 쿼리의 fetch join으로 함께 로딩하고, 태그는 단일 배치 조회로 가져와
     * N+1을 방지한다(태그가 없으면 빈 목록).</p>
     */
    @Transactional(readOnly = true)
    public PinDetail getPinDetail(UUID pinId) {
        Instant now = Instant.now();

        Pin pin = pinRepository.findActivePinDetailById(pinId, now)
                .orElseThrow(() -> new CustomException(ErrorCode.PIN_NOT_FOUND));

        List<String> tags = loadTags(pinId);

        return toPinDetail(pin, tags);
    }

    /**
     * 핀의 태그를 단일 배치 조회로 가져온다(핀별 N+1 방지). 태그가 없으면 빈 목록을 반환한다.
     */
    private List<String> loadTags(UUID pinId) {
        return pinTagRepository.findByPin_IdIn(List.of(pinId)).stream()
                .map(PinTag::getTag)
                .toList();
    }

    /**
     * fetch join으로 이미 로딩된 작성자·장소와 조회한 태그로 내부 결과 모델을 조립한다.
     * 위도·경도는 Place의 PostGIS Point에서 기존 방식대로 변환한다(위도=getY, 경도=getX).
     */
    private PinDetail toPinDetail(Pin pin, List<String> tags) {
        Member author = pin.getMember();
        Place place = pin.getPlace();

        return new PinDetail(
                pin.getId(),
                author.getViewAngle(),
                author.getNickname(),
                pin.getCreatedAt(),
                place.getId(),
                place.getKakaoPlaceId(),
                place.getName(),
                place.getLocation().getY(),
                place.getLocation().getX(),
                pin.getCrowdLevel(),
                pin.getDetailLocation(),
                pin.getMemo(),
                tags,
                pin.getBlurredVideoKey(),
                pin.getThumbnailKey(),
                pin.getExpiresAt());
    }
}
