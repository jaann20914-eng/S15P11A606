package com.yuhan.wagglewaggle.domain.chat.service;

import com.yuhan.wagglewaggle.domain.chat.dto.ChatRequestCreateRequest;
import com.yuhan.wagglewaggle.domain.chat.dto.ChatRequestCreateResponse;
import com.yuhan.wagglewaggle.domain.chat.dto.ChatRoomRequestedEvent;
import com.yuhan.wagglewaggle.domain.chat.entity.ChatRoom;
import com.yuhan.wagglewaggle.domain.chat.entity.ChatRoomMember;
import com.yuhan.wagglewaggle.domain.chat.entity.ChatRoomStatus;
import com.yuhan.wagglewaggle.domain.chat.repository.ChatRoomMemberRepository;
import com.yuhan.wagglewaggle.domain.chat.repository.ChatRoomRepository;
import com.yuhan.wagglewaggle.domain.pin.entity.Pin;
import com.yuhan.wagglewaggle.domain.pin.repository.PinRepository;
import com.yuhan.wagglewaggle.domain.pin.repository.PinUnlockRepository;
import com.yuhan.wagglewaggle.domain.user.entity.Member;
import com.yuhan.wagglewaggle.domain.user.repository.MemberRepository;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.Clock;
import java.time.Instant;
import java.util.UUID;

/**
 * 익명 채팅 요청 유스케이스. 구매(열람 잠금 해제)를 완료한 타인 소유의 활성 핀에 대해
 * 상태 PENDING인 채팅방을 1건 생성한다.
 *
 * <p>(pin_id, requester_id) 유니크 제약으로 (핀, 요청자)당 채팅방은 최대 1건이며,
 * 방이 이미 존재하면 상태와 무관하게 중복 요청으로 보고 거절한다.</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ChatRequestService {

    // 수락 시 요청자에게서 5 크레딧이 빠지므로, 잔액이 이보다 적으면 요청 자체를 막는다.
    private static final int CHAT_REQUEST_MIN_CREDIT = 5;

    // convertAndSendToUser가 /user prefix를 자동으로 붙이므로 send 시엔 prefix를 제외한다.
    // 구독 경로 /user/queue/chat-rooms(= StompAuthChannelInterceptor.USER_CHAT_ROOMS_DESTINATION)와 대응한다.
    private static final String USER_CHAT_ROOMS_SEND_DESTINATION = "/queue/chat-rooms";

    private final PinRepository pinRepository;
    private final PinUnlockRepository pinUnlockRepository;
    private final ChatRoomRepository chatRoomRepository;
    private final ChatRoomMemberRepository chatRoomMemberRepository;
    private final MemberRepository memberRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final Clock clock;

    /**
     * 채팅 요청을 생성한다. 검증 실패 시 명세의 오류 코드로 예외를 던지며,
     * 통과 시 PENDING 채팅방을 저장하고 생성된 roomId와 요청 pinId를 반환한다.
     */
    @Transactional
    public ChatRequestCreateResponse request(Long memberId, ChatRequestCreateRequest request) {
        UUID pinId = parsePinId(request);

        // 크레딧 잔액이 부족하면 핀 조회 전에 먼저 차단한다(여기서는 차감하지 않고 잔액만 확인한다).
        Member requester = memberRepository.findById(memberId)
                .orElseThrow(() -> new CustomException(ErrorCode.CHAT_REQUEST_CREATE_FAILED));
        if (requester.getCreditBalance() < CHAT_REQUEST_MIN_CREDIT) {
            throw new CustomException(ErrorCode.INSUFFICIENT_CREDIT);
        }

        Pin pin = pinRepository.findActivePinDetailById(pinId, Instant.now())
                .orElseThrow(() -> new CustomException(ErrorCode.PIN_NOT_FOUND));

        // 본인 핀에는 요청할 수 없다.
        if (pin.getMember().getId().equals(memberId)) {
            throw new CustomException(ErrorCode.CHAT_REQUEST_FORBIDDEN);
        }
        // 구매(열람 잠금 해제) 완료자만 요청할 수 있다.
        if (!pinUnlockRepository.existsByPin_IdAndMember_Id(pinId, memberId)) {
            throw new CustomException(ErrorCode.CHAT_REQUEST_FORBIDDEN);
        }
        // (핀, 요청자) 채팅방이 이미 있으면(상태 불문) 중복 요청이다.
        if (chatRoomRepository.findStatusByPinIdAndRequesterId(pinId, memberId).isPresent()) {
            throw new CustomException(ErrorCode.CHAT_REQUEST_ALREADY_EXISTS);
        }

        ChatRoom room = ChatRoom.create(pin, requester, pin.getMember());

        ChatRoom saved;
        try {
            // flush를 강제해 유니크 제약 위반을 이 지점에서 포착한다.
            saved = chatRoomRepository.saveAndFlush(room);
        } catch (DataIntegrityViolationException e) {
            // 사전 체크 이후의 동시 요청 레이스로 유니크 제약을 위반한 경우 → 중복으로 처리한다.
            throw new CustomException(ErrorCode.CHAT_REQUEST_ALREADY_EXISTS);
        } catch (Exception e) {
            log.error("채팅 요청 저장 실패 (memberId={}, pinId={})", memberId, pinId, e);
            throw new CustomException(ErrorCode.CHAT_REQUEST_CREATE_FAILED);
        }

        // 수락 전(PENDING)에도 요청자가 채팅을 보낼 수 있으므로 요청자의 참여 멤버 행을 미리 생성한다.
        // 수락자(recipient)의 멤버 행은 수락 시점(ChatDecisionService.accept)에 생성한다.
        chatRoomMemberRepository.save(ChatRoomMember.create(saved, requester));

        // 발행에 필요한 스칼라 값을 트랜잭션 안에서 미리 확정한다(커밋 후 지연로딩 예외 방지).
        Long recipientId = pin.getMember().getId();
        Long roomId = saved.getId();
        String requesterNickname = requester.getNickname();
        String placeName = pin.getPlace().getName();
        ChatRoomStatus status = saved.getStatus();
        Instant requestedAt = saved.getCreatedAt();

        // 요청을 받은 사용자(recipient = 핀 소유자)에게만 push한다. 요청자 본인에게는 보내지 않는다.
        // 커밋 이후 발행하여 롤백(동시 중복 레이스 등) 시 오발송을 막는다.
        runAfterCommit(() -> messagingTemplate.convertAndSendToUser(
                String.valueOf(recipientId),
                USER_CHAT_ROOMS_SEND_DESTINATION,
                ChatRoomRequestedEvent.of(
                        roomId, memberId, requesterNickname, pinId, placeName,
                        status, requestedAt, clock.instant())));

        return new ChatRequestCreateResponse(saved.getId(), pinId);
    }

    /**
     * DB 커밋 이후 실행할 후속 처리를 등록한다. 활성 트랜잭션이 없으면 즉시 실행한다.
     */
    private void runAfterCommit(Runnable action) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    action.run();
                }
            });
        } else {
            action.run();
        }
    }

    /**
     * 요청 body의 pinId를 UUID로 파싱한다. request/pinId 누락·공백·형식 오류는 모두 INVALID_PIN_ID.
     */
    private UUID parsePinId(ChatRequestCreateRequest request) {
        if (request == null || request.pinId() == null || request.pinId().isBlank()) {
            throw new CustomException(ErrorCode.INVALID_PIN_ID);
        }
        try {
            return UUID.fromString(request.pinId());
        } catch (IllegalArgumentException e) {
            throw new CustomException(ErrorCode.INVALID_PIN_ID);
        }
    }
}
