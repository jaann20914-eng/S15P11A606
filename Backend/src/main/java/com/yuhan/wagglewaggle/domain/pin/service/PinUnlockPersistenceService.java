package com.yuhan.wagglewaggle.domain.pin.service;

import com.yuhan.wagglewaggle.domain.credit.entity.CreditTransaction;
import com.yuhan.wagglewaggle.domain.credit.entity.CreditTransactionType;
import com.yuhan.wagglewaggle.domain.credit.repository.CreditTransactionRepository;
import com.yuhan.wagglewaggle.domain.pin.entity.Pin;
import com.yuhan.wagglewaggle.domain.pin.entity.PinUnlock;
import com.yuhan.wagglewaggle.domain.pin.repository.PinRepository;
import com.yuhan.wagglewaggle.domain.pin.repository.PinUnlockRepository;
import com.yuhan.wagglewaggle.domain.user.entity.Member;
import com.yuhan.wagglewaggle.domain.user.repository.MemberRepository;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

/**
 * 핀 영상 잠금 해제(구매) 반영 트랜잭션 경계.
 *
 * <p>최초 구매 시 구매자 크레딧 차감(-3), 작성자 크레딧 지급(+3), 양측 {@code credit_transactions} 생성,
 * {@code pin_unlocks} 생성을 하나의 트랜잭션으로 처리한다. 동시 요청에 의한 중복 차감·잔액 초과 사용을 막기 위해
 * 구매자·작성자 회원 행을 비관적 잠금으로 조회하며, 데드락 방지를 위해 회원 id 오름차순으로 잠근다.</p>
 *
 * <p>멱등성은 {@code pin_unlocks.idempotency_key}(전역 유니크)와 {@code (member_id, pin_id)} 유니크
 * 제약으로 보장한다. 동일 키·동일 요청 재시도는 크레딧·권한을 다시 변경하지 않고 최초 거래 결과를 반환하고,
 * 같은 키를 다른 사용자·핀에 재사용하면 {@link ErrorCode#IDEMPOTENCY_KEY_CONFLICT}로 막는다.
 * 서로 다른 키로 동일 핀을 동시에 구매해 {@code (member_id, pin_id)} 유니크 충돌이 나면
 * {@link ConcurrentUnlockException}으로 트랜잭션을 롤백시키고, 호출부가 {@link #reconcileExisting}로
 * 기존 권한을 재조회해 추가 차감 없이 결과를 확정한다.</p>
 *
 * <p>videoUrl(Presigned GET URL)은 이 트랜잭션에서 발급하지 않는다. 권한·크레딧 처리 커밋 이후
 * 호출부(애플리케이션 서비스)가 {@link Result#blurredVideoKey()}로 발급하므로, URL 발급 실패가
 * 권한·크레딧 처리를 되돌리지 않는다.</p>
 */
@Service
@RequiredArgsConstructor
public class PinUnlockPersistenceService {

    /** 영상 잠금 해제 1회당 구매자 차감·작성자 지급 크레딧. */
    private static final int VIDEO_UNLOCK_CREDIT = 3;

    private final PinRepository pinRepository;
    private final PinUnlockRepository pinUnlockRepository;
    private final MemberRepository memberRepository;
    private final CreditTransactionRepository creditTransactionRepository;
    private final Clock clock;

    /**
     * 검증된 pinId·요청자·멱등성 키로 잠금 해제를 처리한다.
     *
     * <p>핀 상태 확인(ACTIVE·미삭제·미만료) → 작성자 확인 → 멱등 키 재시도/충돌 확인 →
     * 기존 구매자 확인 → 최초 유료 구매(회원 잠금·크레딧 이동·권한 생성) 순으로 처리한다.
     * 어느 경로든 응답 전 핀이 조회 가능한 상태인지 확인하며, 아니면 {@link ErrorCode#PIN_NOT_FOUND}.</p>
     *
     * @throws ConcurrentUnlockException 서로 다른 키의 동시 구매로 {@code (member_id, pin_id)} 유니크가 충돌한 경우
     */
    @Transactional
    public Result apply(UUID pinId, Long memberId, UUID idempotencyKey) {
        // 1. 조회 가능한(ACTIVE·미삭제·미만료) 핀만 잠금 해제/재발급 대상이다.
        Pin pin = loadActivePin(pinId);
        Long authorId = pin.getMember().getId();

        // 2. 작성자는 결제·권한 생성 없이 접근한다(creditCharged=0, 요청 시점 현재 잔액).
        if (memberId.equals(authorId)) {
            return new Result(pinId, 0, currentBalance(memberId), pin.getBlurredVideoKey());
        }

        // 3. 동일 멱등성 키로 생성된 기록이 있으면 재시도/충돌을 판정한다.
        Optional<PinUnlock> byKey = pinUnlockRepository.findByIdempotencyKey(idempotencyKey);
        if (byKey.isPresent()) {
            PinUnlock unlock = byKey.get();
            boolean sameRequest = unlock.getPin().getId().equals(pinId)
                    && unlock.getMember().getId().equals(memberId);
            if (!sameRequest) {
                // 같은 키를 다른 사용자/핀에 재사용 → 기존·신규 요청 모두 변경 없이 충돌 처리.
                throw new CustomException(ErrorCode.IDEMPOTENCY_KEY_CONFLICT);
            }
            // 동일 키·동일 요청 재시도: 크레딧·권한을 다시 변경하지 않고 최초 거래 결과를 반환한다.
            return new Result(pinId, VIDEO_UNLOCK_CREDIT, firstChargeBalanceAfter(memberId, pinId),
                    pin.getBlurredVideoKey());
        }

        // 4. 새 키지만 이미 (member,pin) 권한이 있으면 기존 구매자다.
        //    기존 idempotency_key를 변경하지 않고 추가 차감 없이 현재 잔액으로 반환한다.
        if (pinUnlockRepository.findByPin_IdAndMember_Id(pinId, memberId).isPresent()) {
            return new Result(pinId, 0, currentBalance(memberId), pin.getBlurredVideoKey());
        }

        // 5. 최초 유료 구매: 구매자·작성자 회원 행을 데드락 방지 순서(id 오름차순)로 잠근다.
        Member buyer;
        Member author;
        if (memberId < authorId) {
            buyer = lockMember(memberId, ErrorCode.UNAUTHORIZED);
            author = lockMember(authorId, ErrorCode.PIN_NOT_FOUND);
        } else {
            author = lockMember(authorId, ErrorCode.PIN_NOT_FOUND);
            buyer = lockMember(memberId, ErrorCode.UNAUTHORIZED);
        }

        // 6. 구매자 잔액 확인·차감(-3) 및 이력 기록(잔액 부족 시 INSUFFICIENT_CREDIT).
        buyer.decreaseCredit(VIDEO_UNLOCK_CREDIT);
        int buyerBalanceAfter = buyer.getCreditBalance();
        creditTransactionRepository.save(CreditTransaction.create(
                buyer.getId(),
                CreditTransactionType.VIDEO_VIEWED,
                pinId,
                -VIDEO_UNLOCK_CREDIT,
                buyerBalanceAfter));

        // 7. 작성자 지급(+3) 및 이력 기록.
        author.increaseCredit(VIDEO_UNLOCK_CREDIT);
        creditTransactionRepository.save(CreditTransaction.create(
                author.getId(),
                CreditTransactionType.VIDEO_VIEWED,
                pinId,
                VIDEO_UNLOCK_CREDIT,
                author.getCreditBalance()));

        // 8. 열람 권한 생성. (member,pin) 유니크 위반은 동시 다른 키 구매 → 롤백 후 재조회 신호.
        try {
            pinUnlockRepository.saveAndFlush(PinUnlock.create(pin, buyer, idempotencyKey));
        } catch (DataIntegrityViolationException e) {
            throw new ConcurrentUnlockException();
        }

        return new Result(pinId, VIDEO_UNLOCK_CREDIT, buyerBalanceAfter, pin.getBlurredVideoKey());
    }

    /**
     * {@link #apply} 도중 {@code (member_id, pin_id)} 유니크 충돌로 롤백된 뒤,
     * 별도 트랜잭션에서 기존 권한을 재조회해 결과를 확정한다.
     *
     * <p>재조회 시점에도 핀이 조회 가능한 상태여야 하며(아니면 {@link ErrorCode#PIN_NOT_FOUND}),
     * 최종 저장된 권한의 키가 이번 요청 키와 같으면(동일 키 동시 요청) 최초 구매 결과를,
     * 다른 키(먼저 커밋된 다른 요청)면 기존 구매자로 보고 추가 차감 없이 현재 잔액을 반환한다.
     * 그래도 권한이 없으면 다른 (member,pin)에 대한 키 충돌이므로 {@link ErrorCode#IDEMPOTENCY_KEY_CONFLICT}.</p>
     */
    @Transactional
    public Result reconcileExisting(UUID pinId, Long memberId, UUID idempotencyKey) {
        Pin pin = loadActivePin(pinId);

        PinUnlock unlock = pinUnlockRepository.findByPin_IdAndMember_Id(pinId, memberId)
                .orElseThrow(() -> new CustomException(ErrorCode.IDEMPOTENCY_KEY_CONFLICT));

        if (idempotencyKey.equals(unlock.getIdempotencyKey())) {
            return new Result(pinId, VIDEO_UNLOCK_CREDIT, firstChargeBalanceAfter(memberId, pinId),
                    pin.getBlurredVideoKey());
        }
        return new Result(pinId, 0, currentBalance(memberId), pin.getBlurredVideoKey());
    }

    /**
     * 조회 가능한(ACTIVE·미삭제·미만료) 핀을 작성자·장소와 함께 로딩한다. 없으면 PIN_NOT_FOUND.
     */
    private Pin loadActivePin(UUID pinId) {
        return pinRepository.findActivePinDetailById(pinId, clock.instant())
                .orElseThrow(() -> new CustomException(ErrorCode.PIN_NOT_FOUND));
    }

    private Member lockMember(Long memberId, ErrorCode notFound) {
        return memberRepository.findByIdForUpdate(memberId)
                .orElseThrow(() -> new CustomException(notFound));
    }

    /**
     * 회원의 현재 크레딧 잔액을 잠금 없이 조회한다(작성자·기존 구매자 응답용).
     */
    private int currentBalance(Long memberId) {
        return memberRepository.findById(memberId)
                .map(Member::getCreditBalance)
                .orElseThrow(() -> new CustomException(ErrorCode.UNAUTHORIZED));
    }

    /**
     * 동일 멱등 요청 재시도 응답의 잔액을, 해당 핀 잠금 해제로 생성된 구매자 차감({@code VIDEO_VIEWED},
     * member_id=구매자) 거래의 {@code balance_after}로 조회한다. 없으면 데이터 불일치로 PIN_UNLOCK_FAILED.
     */
    private int firstChargeBalanceAfter(Long memberId, UUID pinId) {
        return creditTransactionRepository
                .findTopByMemberIdAndPinIdAndTypeOrderByIdDesc(memberId, pinId, CreditTransactionType.VIDEO_VIEWED)
                .map(CreditTransaction::getBalanceAfter)
                .orElseThrow(() -> new CustomException(ErrorCode.PIN_UNLOCK_FAILED));
    }

    /**
     * 잠금 해제 반영 결과(내부 모델).
     *
     * @param pinId            잠금 해제 대상 핀 id(요청 경로와 동일)
     * @param creditCharged    이번 요청에서 차감된 크레딧(최초 구매·동일 키 재시도=3, 기존 구매자·작성자=0)
     * @param creditBalance    응답 잔액(최초 구매·재시도=최초 거래 balance_after, 그 외=요청 시점 현재 잔액)
     * @param blurredVideoKey  열람용 Presigned GET URL 발급 대상인 현재 블러 영상 객체 키
     */
    public record Result(
            UUID pinId,
            int creditCharged,
            int creditBalance,
            String blurredVideoKey
    ) {
    }

    /**
     * 서로 다른 멱등성 키의 동시 구매로 {@code (member_id, pin_id)} 유니크 제약이 충돌했음을 알리는 내부 신호.
     * 이 예외로 {@link #apply} 트랜잭션을 롤백시키고, 호출부가 {@link #reconcileExisting}로 재조회한다.
     */
    public static class ConcurrentUnlockException extends RuntimeException {
    }
}
