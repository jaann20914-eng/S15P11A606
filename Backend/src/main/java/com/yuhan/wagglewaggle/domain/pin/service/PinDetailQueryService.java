package com.yuhan.wagglewaggle.domain.pin.service;

import com.yuhan.wagglewaggle.domain.chat.entity.ChatRoomStatus;
import com.yuhan.wagglewaggle.domain.chat.repository.ChatRoomRepository;
import com.yuhan.wagglewaggle.domain.pin.dto.ChatRequestState;
import com.yuhan.wagglewaggle.domain.pin.dto.PinDetail;
import com.yuhan.wagglewaggle.domain.pin.dto.PinDetailView;
import com.yuhan.wagglewaggle.domain.pin.dto.PinViewerAccess;
import com.yuhan.wagglewaggle.domain.pin.dto.VideoAccessLevel;
import com.yuhan.wagglewaggle.domain.pin.entity.Pin;
import com.yuhan.wagglewaggle.domain.pin.entity.PinTag;
import com.yuhan.wagglewaggle.domain.pin.repository.PinEvaluationRepository;
import com.yuhan.wagglewaggle.domain.pin.repository.PinRepository;
import com.yuhan.wagglewaggle.domain.pin.repository.PinTagRepository;
import com.yuhan.wagglewaggle.domain.pin.repository.PinUnlockRepository;
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
 * 영상 핀 상세 조회(GET /api/v1/pins/{pinId})의 데이터 조회 애플리케이션 서비스.
 *
 * <p>상세 표시에 필요한 기본 데이터(작성자·장소·혼잡 정보·태그)와, 현재 사용자 기준의
 * 접근·상호작용 정보(영상 접근 수준·평가 여부·채팅 상태·채팅 요청 가능 여부)를 조회한다.
 * Presigned GET URL 발급, 크레딧 차감, 데이터 생성/변경은 이 단계에서 다루지 않는다.</p>
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
    private final PinUnlockRepository pinUnlockRepository;
    private final PinEvaluationRepository pinEvaluationRepository;
    private final ChatRoomRepository chatRoomRepository;

    /**
     * 조회 가능한 핀의 상세 기본 데이터만 조회한다(현재 사용자 기준 정보 제외).
     *
     * <p>핀 판정(ACTIVE·미삭제·미만료)은 조회 쿼리에서 한 번에 수행하며, 조회 결과가 없으면
     * 실제 존재 여부·사유를 구분하지 않고 PIN_NOT_FOUND(404)로 처리한다.</p>
     */
    @Transactional(readOnly = true)
    public PinDetail getPinDetail(UUID pinId) {
        Pin pin = loadActivePin(pinId);
        return toPinDetail(pin, loadTags(pinId));
    }

    /**
     * 조회 가능한 핀의 상세 기본 데이터와 현재 사용자 기준의 접근·상호작용 정보를 함께 조회한다.
     *
     * <p>작성자·장소는 조회 쿼리의 fetch join으로 로딩하고, 태그·열람 권한·평가 여부·채팅 상태는
     * 각각 인덱스 기반 단건 조회로 확인한다.</p>
     */
    @Transactional(readOnly = true)
    public PinDetailView getPinDetail(UUID pinId, Long currentMemberId) {
        Pin pin = loadActivePin(pinId);
        PinDetail detail = toPinDetail(pin, loadTags(pinId));
        PinViewerAccess access = resolveViewerAccess(pin, currentMemberId);
        return new PinDetailView(detail, access);
    }

    /**
     * 조회 가능한(ACTIVE·미삭제·미만료) 핀을 로딩한다. 없으면 PIN_NOT_FOUND.
     */
    private Pin loadActivePin(UUID pinId) {
        return pinRepository.findActivePinDetailById(pinId, Instant.now())
                .orElseThrow(() -> new CustomException(ErrorCode.PIN_NOT_FOUND));
    }

    /**
     * 현재 사용자 기준의 영상 접근 수준·평가 여부·채팅 상태·채팅 요청 가능 여부를 판정한다.
     */
    private PinViewerAccess resolveViewerAccess(Pin pin, Long currentMemberId) {
        boolean author = isAuthor(pin, currentMemberId);
        VideoAccessLevel videoAccess = resolveVideoAccess(pin.getId(), currentMemberId, author);
        Boolean isEvaluated = resolveIsEvaluated(pin.getId(), currentMemberId, videoAccess);
        ChatRequestState chatRequestState = resolveChatRequestState(pin.getId(), currentMemberId);
        boolean canRequestChat = canRequestChat(videoAccess, author, chatRequestState);
        return new PinViewerAccess(videoAccess, isEvaluated, chatRequestState, canRequestChat);
    }

    private boolean isAuthor(Pin pin, Long currentMemberId) {
        return currentMemberId != null && currentMemberId.equals(pin.getMember().getId());
    }

    /**
     * 영상 접근 수준을 판정한다. 작성자 판정을 구매 여부보다 우선한다.
     * 1) 작성자면 OWNER, 2) 아니면서 결제 완료 열람(PinUnlock)이 있으면 UNLOCKED, 3) 그 외 PREVIEW_BLURRED.
     */
    private VideoAccessLevel resolveVideoAccess(UUID pinId, Long currentMemberId, boolean author) {
        if (author) {
            return VideoAccessLevel.OWNER;
        }
        if (currentMemberId != null
                && pinUnlockRepository.existsByPin_IdAndMember_Id(pinId, currentMemberId)) {
            return VideoAccessLevel.UNLOCKED;
        }
        return VideoAccessLevel.PREVIEW_BLURRED;
    }

    /**
     * 평가 여부를 판정한다. UNLOCKED일 때만 평가 기록 존재 여부(true/false)를 조회하고,
     * OWNER·PREVIEW_BLURRED에서는 null이다. 평가 기록은 조회만 하고 생성·수정하지 않는다.
     */
    private Boolean resolveIsEvaluated(UUID pinId, Long currentMemberId, VideoAccessLevel videoAccess) {
        if (videoAccess != VideoAccessLevel.UNLOCKED) {
            return null;
        }
        return pinEvaluationRepository.existsByPin_IdAndMember_Id(pinId, currentMemberId);
    }

    /**
     * 현재 사용자(요청자)와 해당 핀 사이의 채팅 상태를 판정한다.
     * 채팅방이 없으면 NONE, 있으면 방 상태를 응답 계약 상태로 매핑한다.
     */
    private ChatRequestState resolveChatRequestState(UUID pinId, Long currentMemberId) {
        if (currentMemberId == null) {
            return ChatRequestState.NONE;
        }
        return chatRoomRepository.findStatusByPinIdAndRequesterId(pinId, currentMemberId)
                .map(PinDetailQueryService::toChatRequestState)
                .orElse(ChatRequestState.NONE);
    }

    /**
     * 실제 채팅방 상태({@link ChatRoomStatus} = PENDING/ACTIVE/REFUSED/LEFT)를 응답 계약 상태로 매핑한다.
     * PENDING → PENDING, ACTIVE → ACTIVE, REFUSED·LEFT → CLOSED.
     */
    static ChatRequestState toChatRequestState(ChatRoomStatus status) {
        return switch (status) {
            case PENDING -> ChatRequestState.PENDING;
            case ACTIVE -> ChatRequestState.ACTIVE;
            case REFUSED, LEFT -> ChatRequestState.CLOSED;
        };
    }

    /**
     * 채팅 요청 가능 여부를 판정한다. 다음을 모두 만족할 때만 true.
     * (1) videoAccess=UNLOCKED, (2) 작성자가 아님, (3) 채팅 상태가 NONE.
     * 핀은 조회 가능한(ACTIVE·미삭제·미만료) 상태로만 여기 도달하므로 "조회 가능한 ACTIVE" 조건은 항상 충족된다.
     * PENDING·ACTIVE·CLOSED에서는 반드시 false이며, CLOSED 이후 재요청도 허용하지 않는다.
     */
    static boolean canRequestChat(VideoAccessLevel videoAccess, boolean author, ChatRequestState chatRequestState) {
        return videoAccess == VideoAccessLevel.UNLOCKED
                && !author
                && chatRequestState == ChatRequestState.NONE;
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
