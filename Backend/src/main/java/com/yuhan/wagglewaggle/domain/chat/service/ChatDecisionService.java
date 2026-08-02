package com.yuhan.wagglewaggle.domain.chat.service;

import com.yuhan.wagglewaggle.domain.chat.dto.ChatDecision;
import com.yuhan.wagglewaggle.domain.chat.dto.ChatDecisionRequest;
import com.yuhan.wagglewaggle.domain.chat.dto.ChatDecisionResponse;
import com.yuhan.wagglewaggle.domain.chat.entity.ChatRoom;
import com.yuhan.wagglewaggle.domain.chat.entity.ChatRoomMember;
import com.yuhan.wagglewaggle.domain.chat.entity.ChatRoomStatus;
import com.yuhan.wagglewaggle.domain.chat.repository.ChatRoomMemberRepository;
import com.yuhan.wagglewaggle.domain.chat.repository.ChatRoomRepository;
import com.yuhan.wagglewaggle.domain.credit.entity.CreditTransaction;
import com.yuhan.wagglewaggle.domain.credit.entity.CreditTransactionType;
import com.yuhan.wagglewaggle.domain.credit.repository.CreditTransactionRepository;
import com.yuhan.wagglewaggle.domain.user.entity.Member;
import com.yuhan.wagglewaggle.domain.user.repository.MemberRepository;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * 채팅 요청 응답(결정) 유스케이스. 요청 수신자(recipient = 핀 소유자)가
 * PENDING 요청을 수락/거절/나감으로 처리한다.
 *
 * <p>전체를 단일 트랜잭션으로 처리한다. ACCEPT 시 상태 전이 + 요청자 −5/수락자 +5 크레딧 이동 +
 * credit_transactions 2건 + chat_room_members 2건 생성이 원자적으로 커밋되거나 전부 롤백된다.</p>
 *
 * <p>동시성: 결정 대상 chat_rooms 행을 비관적 쓰기 락으로 잠근 뒤 status를 재검증해
 * 중복 결정(모바일 재전송)을 멱등하게 막는다. ACCEPT 시 두 회원 잔액도 행 잠금으로 보호하며,
 * 데드락 방지를 위해 member id 오름차순으로 잠근다.</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ChatDecisionService {

    private static final int CHAT_ACCEPT_CREDIT = 5;

    private final ChatRoomRepository chatRoomRepository;
    private final MemberRepository memberRepository;
    private final CreditTransactionRepository creditTransactionRepository;
    private final ChatRoomMemberRepository chatRoomMemberRepository;

    /**
     * 채팅 요청에 응답한다. 검증 실패 시 명세의 오류 코드로 예외를 던지며,
     * 통과 시 결정에 따라 상태를 전이(ACCEPT 시 크레딧·멤버 생성 포함)하고 최종 상태를 반환한다.
     */
    @Transactional
    public ChatDecisionResponse decide(Long memberId, Long roomId, ChatDecisionRequest request) {
        ChatDecision decision = ChatDecision.from(request == null ? null : request.decision());

        // 결정 대상 채팅방 행을 잠근 채 조회한다(중복 결정 직렬화).
        ChatRoom room = chatRoomRepository.findByIdForUpdate(roomId)
                .orElseThrow(() -> new CustomException(ErrorCode.CHAT_REQUEST_NOT_FOUND));

        // 요청 수신자만 응답할 수 있다.
        if (!room.getRecipient().getId().equals(memberId)) {
            throw new CustomException(ErrorCode.CHAT_REQUEST_DECISION_FORBIDDEN);
        }
        // 이미 처리된 요청은 다시 변경할 수 없다.
        if (room.getStatus() != ChatRoomStatus.PENDING) {
            throw new CustomException(ErrorCode.CHAT_REQUEST_ALREADY_DECIDED);
        }

        try {
            switch (decision) {
                case ACCEPT -> accept(room);
                case REJECT -> room.reject();
                case LEFT -> room.leave();
            }
        } catch (CustomException e) {
            // 잔액 부족 등 도메인 예외는 그대로 전파해 정확한 오류 코드를 유지한다(전체 롤백).
            throw e;
        } catch (Exception e) {
            log.error("채팅 요청 응답 처리 실패 (memberId={}, roomId={}, decision={})",
                    memberId, roomId, decision, e);
            throw new CustomException(ErrorCode.CHAT_REQUEST_DECISION_FAILED);
        }

        return new ChatDecisionResponse(roomId, decision.apiStatus());
    }

    /**
     * 요청을 수락한다. 요청자 −5/수락자 +5 크레딧을 이동하고 거래 2건·멤버 2건을 생성한 뒤
     * 방을 ACTIVE로 전이한다. 두 회원 행은 데드락 방지를 위해 id 오름차순으로 잠근다.
     */
    private void accept(ChatRoom room) {
        Long requesterId = room.getRequester().getId();
        Long recipientId = room.getRecipient().getId();

        // 데드락 방지: 두 회원 행을 id 오름차순으로 잠근다.
        Long lowerId = Math.min(requesterId, recipientId);
        Long higherId = Math.max(requesterId, recipientId);
        Member lower = memberRepository.findByIdForUpdate(lowerId)
                .orElseThrow(() -> new CustomException(ErrorCode.CHAT_REQUEST_DECISION_FAILED));
        Member higher = memberRepository.findByIdForUpdate(higherId)
                .orElseThrow(() -> new CustomException(ErrorCode.CHAT_REQUEST_DECISION_FAILED));

        Member requester = requesterId.equals(lowerId) ? lower : higher;
        Member recipient = recipientId.equals(lowerId) ? lower : higher;

        UUID pinId = room.getPin().getId();

        // 요청자 차감(부족 시 INSUFFICIENT_CREDIT) → 수락자 적립.
        requester.decreaseCredit(CHAT_ACCEPT_CREDIT);
        recipient.increaseCredit(CHAT_ACCEPT_CREDIT);

        creditTransactionRepository.save(CreditTransaction.create(
                requesterId, CreditTransactionType.SENT_CHAT_REQUEST_ACCEPTED, pinId,
                -CHAT_ACCEPT_CREDIT, requester.getCreditBalance()));
        creditTransactionRepository.save(CreditTransaction.create(
                recipientId, CreditTransactionType.RECEIVED_CHAT_REQUEST_ACCEPTED, pinId,
                CHAT_ACCEPT_CREDIT, recipient.getCreditBalance()));

        chatRoomMemberRepository.save(ChatRoomMember.create(room, requester));
        chatRoomMemberRepository.save(ChatRoomMember.create(room, recipient));

        room.accept();
    }
}
