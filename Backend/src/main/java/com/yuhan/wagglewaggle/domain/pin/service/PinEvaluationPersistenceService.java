package com.yuhan.wagglewaggle.domain.pin.service;

import com.yuhan.wagglewaggle.domain.credit.entity.CreditTransaction;
import com.yuhan.wagglewaggle.domain.credit.entity.CreditTransactionType;
import com.yuhan.wagglewaggle.domain.credit.repository.CreditTransactionRepository;
import com.yuhan.wagglewaggle.domain.pin.entity.Pin;
import com.yuhan.wagglewaggle.domain.pin.entity.PinEvaluation;
import com.yuhan.wagglewaggle.domain.pin.entity.PinEvaluationType;
import com.yuhan.wagglewaggle.domain.pin.repository.PinEvaluationRepository;
import com.yuhan.wagglewaggle.domain.pin.repository.PinRepository;
import com.yuhan.wagglewaggle.domain.pin.repository.PinUnlockRepository;
import com.yuhan.wagglewaggle.domain.user.entity.Member;
import com.yuhan.wagglewaggle.domain.user.repository.MemberRepository;
import com.yuhan.wagglewaggle.domain.view.entity.ViewTransaction;
import com.yuhan.wagglewaggle.domain.view.entity.ViewTransactionType;
import com.yuhan.wagglewaggle.domain.view.repository.ViewTransactionRepository;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.util.UUID;

/**
 * 핀 평가 반영 트랜잭션 경계.
 *
 * <p>평가 저장, 평가자 크레딧 지급(+1), 작성자 온도(view_angle) 변화(HELPFUL +1 / NOT_HELPFUL -0.5)를
 * 하나의 트랜잭션으로 처리한다. 동시 평가로 인한 잔액·온도 갱신 유실을 막기 위해
 * 평가자·작성자 회원 행을 비관적 잠금으로 조회하며, 데드락 방지를 위해 회원 id 오름차순으로 잠근다.</p>
 *
 * <p>검증 예외(PIN_NOT_FOUND·PIN_EVALUATION_FORBIDDEN·PIN_ALREADY_EVALUATED)는 그대로 전파하고,
 * (pin_id, member_id) 유니크 제약 위반은 PIN_ALREADY_EVALUATED로 매핑해 중복 보상을 막는다.</p>
 */
@Service
@RequiredArgsConstructor
public class PinEvaluationPersistenceService {

    /** 정상 최초 평가 시 평가자에게 지급하는 크레딧. */
    private static final int EVALUATOR_REWARD_CREDIT = 1;

    /** 작성자 온도 변화량: HELPFUL +1, NOT_HELPFUL -0.5. */
    private static final BigDecimal HELPFUL_VIEW_DELTA = new BigDecimal("1");
    private static final BigDecimal NOT_HELPFUL_VIEW_DELTA = new BigDecimal("-0.5");

    private final PinRepository pinRepository;
    private final PinUnlockRepository pinUnlockRepository;
    private final PinEvaluationRepository pinEvaluationRepository;
    private final MemberRepository memberRepository;
    private final CreditTransactionRepository creditTransactionRepository;
    private final ViewTransactionRepository viewTransactionRepository;
    private final Clock clock;

    /**
     * 검증된 pinId·요청자·평가값에 대해 평가를 반영한다.
     * 핀 상태 확인 → 작성자·열람 권한 확인 → 중복 확인 → 평가 저장 → 평가자 크레딧 지급 →
     * 작성자 온도 변화 순으로 처리한다.
     */
    @Transactional
    public Result apply(UUID pinId, Long memberId, PinEvaluationType rating) {
        // 1. 조회 가능한(ACTIVE·미삭제·미만료) 핀만 평가 대상이다.
        Instant now = clock.instant();
        Pin pin = pinRepository.findActivePinDetailById(pinId, now)
                .orElseThrow(() -> new CustomException(ErrorCode.PIN_NOT_FOUND));

        Long authorId = pin.getMember().getId();

        // 2. 작성자는 본인 핀을 평가할 수 없다.
        if (memberId.equals(authorId)) {
            throw new CustomException(ErrorCode.PIN_EVALUATION_FORBIDDEN);
        }

        // 3. 해당 핀을 열람(UNLOCKED)한 사용자만 평가할 수 있다.
        if (!pinUnlockRepository.existsByPin_IdAndMember_Id(pinId, memberId)) {
            throw new CustomException(ErrorCode.PIN_EVALUATION_FORBIDDEN);
        }

        // 4. 한 핀은 한 번만 평가할 수 있다(선제 검사, 최종 방어는 유니크 제약).
        if (pinEvaluationRepository.existsByPin_IdAndMember_Id(pinId, memberId)) {
            throw new CustomException(ErrorCode.PIN_ALREADY_EVALUATED);
        }

        // 5. 잔액·온도 갱신 대상 회원을 데드락 방지 순서(id 오름차순)로 잠근다.
        Member evaluator;
        Member author;
        if (memberId < authorId) {
            evaluator = lockMember(memberId, ErrorCode.UNAUTHORIZED);
            author = lockMember(authorId, ErrorCode.PIN_NOT_FOUND);
        } else {
            author = lockMember(authorId, ErrorCode.PIN_NOT_FOUND);
            evaluator = lockMember(memberId, ErrorCode.UNAUTHORIZED);
        }

        // 6. 평가 저장(유니크 제약 위반 시 중복 평가로 매핑).
        PinEvaluation evaluation = PinEvaluation.create(pin, evaluator, rating);
        try {
            pinEvaluationRepository.saveAndFlush(evaluation);
        } catch (DataIntegrityViolationException e) {
            throw new CustomException(ErrorCode.PIN_ALREADY_EVALUATED);
        }

        // 7. 평가자 크레딧 +1 지급 및 이력 기록.
        int balanceAfter = evaluator.addCredit(EVALUATOR_REWARD_CREDIT);
        creditTransactionRepository.save(CreditTransaction.create(
                evaluator.getId(),
                CreditTransactionType.PIN_EVALUATION_PARTICIPATED,
                pinId,
                EVALUATOR_REWARD_CREDIT,
                balanceAfter));

        // 8. 작성자 온도 변화 반영 및 이력 기록(범위 0~360 클램프로 실제 변화량을 기록).
        BigDecimal requestedDelta = rating == PinEvaluationType.HELPFUL
                ? HELPFUL_VIEW_DELTA
                : NOT_HELPFUL_VIEW_DELTA;
        BigDecimal viewBefore = author.getViewAngle();
        BigDecimal viewAfter = author.applyViewChange(requestedDelta);
        BigDecimal effectiveDelta = viewAfter.subtract(viewBefore);

        ViewTransactionType viewType = rating == PinEvaluationType.HELPFUL
                ? ViewTransactionType.RECEIVED_HELPFUL_PIN_EVALUATION
                : ViewTransactionType.RECEIVED_DISAPPOINTING_PIN_EVALUATION;
        viewTransactionRepository.save(ViewTransaction.create(
                author.getId(),
                viewType,
                pinId,
                effectiveDelta,
                viewAfter));

        return new Result(evaluation.getId(), EVALUATOR_REWARD_CREDIT);
    }

    private Member lockMember(Long memberId, ErrorCode notFound) {
        return memberRepository.findByIdForUpdate(memberId)
                .orElseThrow(() -> new CustomException(notFound));
    }

    /**
     * 평가 반영 결과.
     *
     * @param evaluationId  새로 생성된 평가 식별자
     * @param rewardCredit  평가자에게 지급된 크레딧(정상 최초 평가 시 1)
     */
    public record Result(
            Long evaluationId,
            int rewardCredit
    ) {
    }
}
