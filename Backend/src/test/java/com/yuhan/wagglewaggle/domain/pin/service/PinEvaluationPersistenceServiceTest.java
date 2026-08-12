package com.yuhan.wagglewaggle.domain.pin.service;

import com.yuhan.wagglewaggle.domain.credit.entity.CreditTransaction;
import com.yuhan.wagglewaggle.domain.credit.entity.CreditTransactionType;
import com.yuhan.wagglewaggle.domain.credit.repository.CreditTransactionRepository;
import com.yuhan.wagglewaggle.domain.pin.entity.CrowdLevel;
import com.yuhan.wagglewaggle.domain.pin.entity.Pin;
import com.yuhan.wagglewaggle.domain.pin.entity.PinEvaluation;
import com.yuhan.wagglewaggle.domain.pin.entity.PinEvaluationType;
import com.yuhan.wagglewaggle.domain.pin.entity.VideoStatus;
import com.yuhan.wagglewaggle.domain.pin.repository.PinEvaluationRepository;
import com.yuhan.wagglewaggle.domain.pin.repository.PinRepository;
import com.yuhan.wagglewaggle.domain.pin.repository.PinUnlockRepository;
import com.yuhan.wagglewaggle.domain.place.entity.Place;
import com.yuhan.wagglewaggle.domain.user.entity.AgeGroup;
import com.yuhan.wagglewaggle.domain.user.entity.Gender;
import com.yuhan.wagglewaggle.domain.user.entity.Member;
import com.yuhan.wagglewaggle.domain.user.repository.MemberRepository;
import com.yuhan.wagglewaggle.domain.view.entity.ViewTransaction;
import com.yuhan.wagglewaggle.domain.view.entity.ViewTransactionType;
import com.yuhan.wagglewaggle.domain.view.repository.ViewTransactionRepository;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.Point;
import org.locationtech.jts.geom.PrecisionModel;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PinEvaluationPersistenceServiceTest {

    @Mock private PinRepository pinRepository;
    @Mock private PinUnlockRepository pinUnlockRepository;
    @Mock private PinEvaluationRepository pinEvaluationRepository;
    @Mock private MemberRepository memberRepository;
    @Mock private CreditTransactionRepository creditTransactionRepository;
    @Mock private ViewTransactionRepository viewTransactionRepository;

    private PinEvaluationPersistenceService service;

    private Member author;
    private Member evaluator;

    private static final Long EVALUATOR_ID = 42L;
    private static final Long AUTHOR_ID = 7L;
    private static final UUID PIN_ID = UUID.fromString("11111111-2222-3333-4444-555555555555");
    private static final Instant NOW = Instant.parse("2026-08-02T00:00:00Z");
    private static final Long NEW_EVALUATION_ID = 100L;

    private static final GeometryFactory GF = new GeometryFactory(new PrecisionModel(), 4326);

    @BeforeEach
    void setUp() {
        Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);
        service = new PinEvaluationPersistenceService(
                pinRepository, pinUnlockRepository, pinEvaluationRepository,
                memberRepository, creditTransactionRepository, viewTransactionRepository, clock);
    }

    /** 정상 경로(작성자 아님 + 열람함 + 미평가)를 구성하고, 지정한 온도의 작성자를 {@link #author}에 둔다. */
    private void givenEvaluablePin(BigDecimal authorViewAngle) {
        author = member(AUTHOR_ID, authorViewAngle, 10);
        evaluator = member(EVALUATOR_ID, BigDecimal.valueOf(90), 10);
        Pin pin = activePin(author);

        given(pinRepository.findActivePinDetailById(eq(PIN_ID), any())).willReturn(Optional.of(pin));
        given(pinUnlockRepository.existsByPin_IdAndMember_Id(PIN_ID, EVALUATOR_ID)).willReturn(true);
        given(pinEvaluationRepository.existsByPin_IdAndMember_Id(PIN_ID, EVALUATOR_ID)).willReturn(false);
        given(memberRepository.findByIdForUpdate(EVALUATOR_ID)).willReturn(Optional.of(evaluator));
        given(memberRepository.findByIdForUpdate(AUTHOR_ID)).willReturn(Optional.of(author));
        given(pinEvaluationRepository.saveAndFlush(any())).willAnswer(inv -> {
            PinEvaluation e = inv.getArgument(0);
            ReflectionTestUtils.setField(e, "id", NEW_EVALUATION_ID);
            return e;
        });
    }

    private Member member(Long id, BigDecimal viewAngle, int creditBalance) {
        Member m = Member.create("nick" + id, AgeGroup.TWENTIES, Gender.MALE);
        ReflectionTestUtils.setField(m, "id", id);
        ReflectionTestUtils.setField(m, "viewAngle", viewAngle);
        ReflectionTestUtils.setField(m, "creditBalance", creditBalance);
        return m;
    }

    private Pin activePin(Member author) {
        Place place = Place.create("kakao-1", "장소", point());
        ReflectionTestUtils.setField(place, "id", 1L);
        Pin pin = Pin.create(author, place, CrowdLevel.WAGLE, point(),
                "2층 창가", "메모", "pins/original/key.mp4", NOW.plusSeconds(3600));
        ReflectionTestUtils.setField(pin, "id", PIN_ID);
        ReflectionTestUtils.setField(pin, "videoStatus", VideoStatus.ACTIVE);
        return pin;
    }

    private static Point point() {
        return GF.createPoint(new Coordinate(127.0, 37.5));
    }

    @Test
    void HELPFUL_평가시_평가자에게_1크레딧을_지급하고_작성자_온도를_1_올린다() {
        givenEvaluablePin(BigDecimal.valueOf(90));

        PinEvaluationPersistenceService.Result result =
                service.apply(PIN_ID, EVALUATOR_ID, PinEvaluationType.HELPFUL);

        assertThat(result.evaluationId()).isEqualTo(NEW_EVALUATION_ID);
        assertThat(result.rewardCredit()).isEqualTo(1);

        // 평가자 크레딧 10 -> 11
        assertThat(evaluator.getCreditBalance()).isEqualTo(11);
        // 작성자 온도 90 -> 91
        assertThat(author.getViewAngle()).isEqualByComparingTo(BigDecimal.valueOf(91));

        ArgumentCaptor<CreditTransaction> creditCaptor = ArgumentCaptor.forClass(CreditTransaction.class);
        verify(creditTransactionRepository).save(creditCaptor.capture());
        assertThat(creditCaptor.getValue().getType()).isEqualTo(CreditTransactionType.PIN_EVALUATION_PARTICIPATED);
        assertThat(creditCaptor.getValue().getMemberId()).isEqualTo(EVALUATOR_ID);
        assertThat(creditCaptor.getValue().getChangeAmount()).isEqualTo(1);
        assertThat(creditCaptor.getValue().getBalanceAfter()).isEqualTo(11);

        ArgumentCaptor<ViewTransaction> viewCaptor = ArgumentCaptor.forClass(ViewTransaction.class);
        verify(viewTransactionRepository).save(viewCaptor.capture());
        assertThat(viewCaptor.getValue().getType()).isEqualTo(ViewTransactionType.RECEIVED_HELPFUL_PIN_EVALUATION);
        assertThat(viewCaptor.getValue().getMemberId()).isEqualTo(AUTHOR_ID);
        assertThat(viewCaptor.getValue().getChangeAmount()).isEqualByComparingTo(BigDecimal.valueOf(1));
        assertThat(viewCaptor.getValue().getViewAfter()).isEqualByComparingTo(BigDecimal.valueOf(91));
    }

    @Test
    void NOT_HELPFUL_평가시_작성자_온도를_0_5_내린다() {
        givenEvaluablePin(new BigDecimal("100"));

        service.apply(PIN_ID, EVALUATOR_ID, PinEvaluationType.NOT_HELPFUL);

        // 작성자 온도 100 -> 99.5
        assertThat(author.getViewAngle()).isEqualByComparingTo(new BigDecimal("99.5"));

        ArgumentCaptor<ViewTransaction> viewCaptor = ArgumentCaptor.forClass(ViewTransaction.class);
        verify(viewTransactionRepository).save(viewCaptor.capture());
        assertThat(viewCaptor.getValue().getType())
                .isEqualTo(ViewTransactionType.RECEIVED_DISAPPOINTING_PIN_EVALUATION);
        assertThat(viewCaptor.getValue().getChangeAmount()).isEqualByComparingTo(new BigDecimal("-0.5"));
        assertThat(viewCaptor.getValue().getViewAfter()).isEqualByComparingTo(new BigDecimal("99.5"));
    }

    @Test
    void 온도가_하한_0일때_NOT_HELPFUL이면_0으로_클램프되고_실제_변화량_0을_기록한다() {
        givenEvaluablePin(BigDecimal.ZERO);

        service.apply(PIN_ID, EVALUATOR_ID, PinEvaluationType.NOT_HELPFUL);

        assertThat(author.getViewAngle()).isEqualByComparingTo(BigDecimal.ZERO);

        ArgumentCaptor<ViewTransaction> viewCaptor = ArgumentCaptor.forClass(ViewTransaction.class);
        verify(viewTransactionRepository).save(viewCaptor.capture());
        assertThat(viewCaptor.getValue().getChangeAmount()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(viewCaptor.getValue().getViewAfter()).isEqualByComparingTo(BigDecimal.ZERO);
    }

    @Test
    void 조회가능_핀이_없으면_PIN_NOT_FOUND이고_아무것도_저장하지_않는다() {
        given(pinRepository.findActivePinDetailById(eq(PIN_ID), any())).willReturn(Optional.empty());

        assertThatThrownBy(() -> service.apply(PIN_ID, EVALUATOR_ID, PinEvaluationType.HELPFUL))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.PIN_NOT_FOUND);

        verify(pinEvaluationRepository, never()).saveAndFlush(any());
        verify(creditTransactionRepository, never()).save(any());
        verify(viewTransactionRepository, never()).save(any());
    }

    @Test
    void 작성자_본인이_평가하면_PIN_EVALUATION_FORBIDDEN이다() {
        Member ownerAuthor = member(AUTHOR_ID, BigDecimal.valueOf(90), 10);
        Pin pin = activePin(ownerAuthor);
        given(pinRepository.findActivePinDetailById(eq(PIN_ID), any())).willReturn(Optional.of(pin));

        assertThatThrownBy(() -> service.apply(PIN_ID, AUTHOR_ID, PinEvaluationType.HELPFUL))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.PIN_EVALUATION_FORBIDDEN);

        verify(pinEvaluationRepository, never()).saveAndFlush(any());
        verify(creditTransactionRepository, never()).save(any());
    }

    @Test
    void 열람하지_않은_사용자가_평가하면_PIN_EVALUATION_FORBIDDEN이다() {
        Member pinAuthor = member(AUTHOR_ID, BigDecimal.valueOf(90), 10);
        Pin pin = activePin(pinAuthor);
        given(pinRepository.findActivePinDetailById(eq(PIN_ID), any())).willReturn(Optional.of(pin));
        given(pinUnlockRepository.existsByPin_IdAndMember_Id(PIN_ID, EVALUATOR_ID)).willReturn(false);

        assertThatThrownBy(() -> service.apply(PIN_ID, EVALUATOR_ID, PinEvaluationType.HELPFUL))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.PIN_EVALUATION_FORBIDDEN);

        verify(pinEvaluationRepository, never()).saveAndFlush(any());
        verify(creditTransactionRepository, never()).save(any());
    }

    @Test
    void 이미_평가한_핀이면_PIN_ALREADY_EVALUATED이다() {
        Member pinAuthor = member(AUTHOR_ID, BigDecimal.valueOf(90), 10);
        Pin pin = activePin(pinAuthor);
        given(pinRepository.findActivePinDetailById(eq(PIN_ID), any())).willReturn(Optional.of(pin));
        given(pinUnlockRepository.existsByPin_IdAndMember_Id(PIN_ID, EVALUATOR_ID)).willReturn(true);
        given(pinEvaluationRepository.existsByPin_IdAndMember_Id(PIN_ID, EVALUATOR_ID)).willReturn(true);

        assertThatThrownBy(() -> service.apply(PIN_ID, EVALUATOR_ID, PinEvaluationType.HELPFUL))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.PIN_ALREADY_EVALUATED);

        verify(pinEvaluationRepository, never()).saveAndFlush(any());
        verify(creditTransactionRepository, never()).save(any());
    }

    @Test
    void 저장중_유니크_제약_위반이면_PIN_ALREADY_EVALUATED로_매핑한다() {
        givenEvaluablePin(BigDecimal.valueOf(90));
        // 이전 willAnswer 스텁의 부작용 재실행을 피하려 do-style로 재정의한다.
        org.mockito.BDDMockito.willThrow(new DataIntegrityViolationException("duplicate"))
                .given(pinEvaluationRepository).saveAndFlush(any());

        assertThatThrownBy(() -> service.apply(PIN_ID, EVALUATOR_ID, PinEvaluationType.HELPFUL))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.PIN_ALREADY_EVALUATED);

        verify(creditTransactionRepository, never()).save(any());
        verify(viewTransactionRepository, never()).save(any());
    }
}
