package com.yuhan.wagglewaggle.domain.pin.service;

import com.yuhan.wagglewaggle.domain.credit.entity.CreditTransaction;
import com.yuhan.wagglewaggle.domain.credit.entity.CreditTransactionType;
import com.yuhan.wagglewaggle.domain.credit.repository.CreditTransactionRepository;
import com.yuhan.wagglewaggle.domain.pin.entity.CrowdLevel;
import com.yuhan.wagglewaggle.domain.pin.entity.Pin;
import com.yuhan.wagglewaggle.domain.pin.entity.PinUnlock;
import com.yuhan.wagglewaggle.domain.pin.entity.VideoStatus;
import com.yuhan.wagglewaggle.domain.pin.repository.PinRepository;
import com.yuhan.wagglewaggle.domain.pin.repository.PinUnlockRepository;
import com.yuhan.wagglewaggle.domain.place.entity.Place;
import com.yuhan.wagglewaggle.domain.user.entity.AgeGroup;
import com.yuhan.wagglewaggle.domain.user.entity.Gender;
import com.yuhan.wagglewaggle.domain.user.entity.Member;
import com.yuhan.wagglewaggle.domain.user.repository.MemberRepository;
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
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PinUnlockPersistenceServiceTest {

    @Mock private PinRepository pinRepository;
    @Mock private PinUnlockRepository pinUnlockRepository;
    @Mock private MemberRepository memberRepository;
    @Mock private CreditTransactionRepository creditTransactionRepository;

    private PinUnlockPersistenceService service;

    private static final Long BUYER_ID = 42L;
    private static final Long AUTHOR_ID = 7L;
    private static final UUID PIN_ID = UUID.fromString("11111111-2222-3333-4444-555555555555");
    private static final UUID KEY = UUID.fromString("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
    private static final String BLURRED_KEY = "pins/blurred/key.mp4";
    private static final Instant NOW = Instant.parse("2026-08-02T00:00:00Z");
    private static final int UNLOCK_CREDIT = 3;

    private static final GeometryFactory GF = new GeometryFactory(new PrecisionModel(), 4326);

    private Member buyer;
    private Member author;

    @BeforeEach
    void setUp() {
        Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);
        service = new PinUnlockPersistenceService(
                pinRepository, pinUnlockRepository, memberRepository, creditTransactionRepository, clock);
    }

    private Member member(Long id, int creditBalance) {
        Member m = Member.create("nick" + id, AgeGroup.TWENTIES, Gender.MALE);
        ReflectionTestUtils.setField(m, "id", id);
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
        ReflectionTestUtils.setField(pin, "blurredVideoKey", BLURRED_KEY);
        return pin;
    }

    private static Point point() {
        return GF.createPoint(new Coordinate(127.0, 37.5));
    }

    private CreditTransaction buyerChargeTransaction(int balanceAfter) {
        return CreditTransaction.create(
                BUYER_ID, CreditTransactionType.VIDEO_VIEWED, PIN_ID, -UNLOCK_CREDIT, balanceAfter);
    }

    // ===== 작성자 =====

    @Test
    void 작성자가_요청하면_차감_없이_현재_잔액과_URL키를_반환한다() {
        author = member(AUTHOR_ID, 10);
        given(pinRepository.findActivePinDetailById(eq(PIN_ID), any())).willReturn(Optional.of(activePin(author)));
        given(memberRepository.findById(AUTHOR_ID)).willReturn(Optional.of(author));

        PinUnlockPersistenceService.Result result = service.apply(PIN_ID, AUTHOR_ID, KEY);

        assertThat(result.creditCharged()).isEqualTo(0);
        assertThat(result.creditBalance()).isEqualTo(10);
        assertThat(result.blurredVideoKey()).isEqualTo(BLURRED_KEY);

        verify(pinUnlockRepository, never()).saveAndFlush(any());
        verify(creditTransactionRepository, never()).save(any());
    }

    // ===== 동일 키 재시도 =====

    @Test
    void 동일_키_동일_요청_재시도면_재차감없이_최초_거래_결과를_반환한다() {
        author = member(AUTHOR_ID, 10);
        buyer = member(BUYER_ID, 7);
        Pin pin = activePin(author);
        given(pinRepository.findActivePinDetailById(eq(PIN_ID), any())).willReturn(Optional.of(pin));
        given(pinUnlockRepository.findByIdempotencyKey(KEY))
                .willReturn(Optional.of(PinUnlock.create(pin, buyer, KEY)));
        given(creditTransactionRepository.findTopByMemberIdAndPinIdAndTypeOrderByIdDesc(
                BUYER_ID, PIN_ID, CreditTransactionType.VIDEO_VIEWED))
                .willReturn(Optional.of(buyerChargeTransaction(7)));

        PinUnlockPersistenceService.Result result = service.apply(PIN_ID, BUYER_ID, KEY);

        assertThat(result.creditCharged()).isEqualTo(3);
        assertThat(result.creditBalance()).isEqualTo(7);

        verify(pinUnlockRepository, never()).saveAndFlush(any());
        verify(creditTransactionRepository, never()).save(any());
    }

    @Test
    void 같은_키를_다른_요청에_재사용하면_IDEMPOTENCY_KEY_CONFLICT다() {
        author = member(AUTHOR_ID, 10);
        Member otherBuyer = member(99L, 10);
        Pin pin = activePin(author);
        given(pinRepository.findActivePinDetailById(eq(PIN_ID), any())).willReturn(Optional.of(pin));
        // 같은 키가 다른 사용자(99)의 구매에 이미 사용됨.
        given(pinUnlockRepository.findByIdempotencyKey(KEY))
                .willReturn(Optional.of(PinUnlock.create(pin, otherBuyer, KEY)));

        assertThatThrownBy(() -> service.apply(PIN_ID, BUYER_ID, KEY))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.IDEMPOTENCY_KEY_CONFLICT);

        verify(pinUnlockRepository, never()).saveAndFlush(any());
        verify(creditTransactionRepository, never()).save(any());
    }

    // ===== 기존 구매자(새 키) =====

    @Test
    void 새_키로_온_기존_구매자는_차감없이_현재_잔액을_반환한다() {
        author = member(AUTHOR_ID, 10);
        buyer = member(BUYER_ID, 5);
        Pin pin = activePin(author);
        given(pinRepository.findActivePinDetailById(eq(PIN_ID), any())).willReturn(Optional.of(pin));
        given(pinUnlockRepository.findByIdempotencyKey(KEY)).willReturn(Optional.empty());
        given(pinUnlockRepository.findByPin_IdAndMember_Id(PIN_ID, BUYER_ID))
                .willReturn(Optional.of(PinUnlock.create(pin, buyer, UUID.randomUUID())));
        given(memberRepository.findById(BUYER_ID)).willReturn(Optional.of(buyer));

        PinUnlockPersistenceService.Result result = service.apply(PIN_ID, BUYER_ID, KEY);

        assertThat(result.creditCharged()).isEqualTo(0);
        assertThat(result.creditBalance()).isEqualTo(5);

        verify(pinUnlockRepository, never()).saveAndFlush(any());
        verify(creditTransactionRepository, never()).save(any());
    }

    // ===== 최초 유료 구매 =====

    @Test
    void 최초_유료_구매면_구매자_3차감_작성자_3지급_양측_거래와_권한을_생성한다() {
        givenFirstPurchase(10, 10);

        PinUnlockPersistenceService.Result result = service.apply(PIN_ID, BUYER_ID, KEY);

        assertThat(result.creditCharged()).isEqualTo(3);
        assertThat(result.creditBalance()).isEqualTo(7);       // 구매자 10 -> 7
        assertThat(result.blurredVideoKey()).isEqualTo(BLURRED_KEY);
        assertThat(buyer.getCreditBalance()).isEqualTo(7);
        assertThat(author.getCreditBalance()).isEqualTo(13);   // 작성자 10 -> 13

        ArgumentCaptor<CreditTransaction> captor = ArgumentCaptor.forClass(CreditTransaction.class);
        verify(creditTransactionRepository, times(2)).save(captor.capture());

        CreditTransaction buyerTx = captor.getAllValues().get(0);
        assertThat(buyerTx.getType()).isEqualTo(CreditTransactionType.VIDEO_VIEWED);
        assertThat(buyerTx.getMemberId()).isEqualTo(BUYER_ID);
        assertThat(buyerTx.getPinId()).isEqualTo(PIN_ID);
        assertThat(buyerTx.getChangeAmount()).isEqualTo(-3);
        assertThat(buyerTx.getBalanceAfter()).isEqualTo(7);

        CreditTransaction authorTx = captor.getAllValues().get(1);
        assertThat(authorTx.getType()).isEqualTo(CreditTransactionType.VIDEO_VIEWED);
        assertThat(authorTx.getMemberId()).isEqualTo(AUTHOR_ID);
        assertThat(authorTx.getPinId()).isEqualTo(PIN_ID);
        assertThat(authorTx.getChangeAmount()).isEqualTo(3);
        assertThat(authorTx.getBalanceAfter()).isEqualTo(13);

        verify(pinUnlockRepository).saveAndFlush(any(PinUnlock.class));
    }

    @Test
    void 구매자_잔액이_부족하면_INSUFFICIENT_CREDIT이고_아무것도_저장하지_않는다() {
        givenFirstPurchase(2, 10);   // 구매자 잔액 2 < 3

        assertThatThrownBy(() -> service.apply(PIN_ID, BUYER_ID, KEY))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.INSUFFICIENT_CREDIT);

        verify(creditTransactionRepository, never()).save(any());
        verify(pinUnlockRepository, never()).saveAndFlush(any());
    }

    @Test
    void 권한_저장중_유니크_위반이면_ConcurrentUnlockException을_던진다() {
        givenFirstPurchase(10, 10);
        given(pinUnlockRepository.saveAndFlush(any()))
                .willThrow(new DataIntegrityViolationException("duplicate"));

        assertThatThrownBy(() -> service.apply(PIN_ID, BUYER_ID, KEY))
                .isInstanceOf(PinUnlockPersistenceService.ConcurrentUnlockException.class);
    }

    // ===== 핀 상태 =====

    @Test
    void 조회가능_핀이_없으면_PIN_NOT_FOUND다() {
        given(pinRepository.findActivePinDetailById(eq(PIN_ID), any())).willReturn(Optional.empty());

        assertThatThrownBy(() -> service.apply(PIN_ID, BUYER_ID, KEY))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.PIN_NOT_FOUND);

        verify(creditTransactionRepository, never()).save(any());
        verify(pinUnlockRepository, never()).saveAndFlush(any());
    }

    // ===== reconcileExisting (동시성 충돌 이후 재조회) =====

    @Test
    void reconcile_같은_키로_저장된_권한이면_최초_구매_결과를_반환한다() {
        author = member(AUTHOR_ID, 10);
        buyer = member(BUYER_ID, 7);
        Pin pin = activePin(author);
        given(pinRepository.findActivePinDetailById(eq(PIN_ID), any())).willReturn(Optional.of(pin));
        given(pinUnlockRepository.findByPin_IdAndMember_Id(PIN_ID, BUYER_ID))
                .willReturn(Optional.of(PinUnlock.create(pin, buyer, KEY)));
        given(creditTransactionRepository.findTopByMemberIdAndPinIdAndTypeOrderByIdDesc(
                BUYER_ID, PIN_ID, CreditTransactionType.VIDEO_VIEWED))
                .willReturn(Optional.of(buyerChargeTransaction(7)));

        PinUnlockPersistenceService.Result result = service.reconcileExisting(PIN_ID, BUYER_ID, KEY);

        assertThat(result.creditCharged()).isEqualTo(3);
        assertThat(result.creditBalance()).isEqualTo(7);
    }

    @Test
    void reconcile_다른_키로_저장된_권한이면_차감없이_현재_잔액을_반환한다() {
        author = member(AUTHOR_ID, 10);
        buyer = member(BUYER_ID, 5);
        Pin pin = activePin(author);
        given(pinRepository.findActivePinDetailById(eq(PIN_ID), any())).willReturn(Optional.of(pin));
        // 먼저 커밋된 다른 요청(다른 키)이 만든 권한.
        given(pinUnlockRepository.findByPin_IdAndMember_Id(PIN_ID, BUYER_ID))
                .willReturn(Optional.of(PinUnlock.create(pin, buyer, UUID.randomUUID())));
        given(memberRepository.findById(BUYER_ID)).willReturn(Optional.of(buyer));

        PinUnlockPersistenceService.Result result = service.reconcileExisting(PIN_ID, BUYER_ID, KEY);

        assertThat(result.creditCharged()).isEqualTo(0);
        assertThat(result.creditBalance()).isEqualTo(5);
    }

    @Test
    void reconcile_기존_권한이_없으면_IDEMPOTENCY_KEY_CONFLICT다() {
        author = member(AUTHOR_ID, 10);
        given(pinRepository.findActivePinDetailById(eq(PIN_ID), any())).willReturn(Optional.of(activePin(author)));
        given(pinUnlockRepository.findByPin_IdAndMember_Id(PIN_ID, BUYER_ID)).willReturn(Optional.empty());

        assertThatThrownBy(() -> service.reconcileExisting(PIN_ID, BUYER_ID, KEY))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.IDEMPOTENCY_KEY_CONFLICT);
    }

    /**
     * 최초 유료 구매 정상 경로 스텁: (핀 조회 가능) + (키·권한 없음) + (구매자·작성자 잠금).
     * 구매자는 id가 더 크므로(42 > 7) 잠금 순서상 작성자를 먼저 잠근다.
     */
    private void givenFirstPurchase(int buyerBalance, int authorBalance) {
        author = member(AUTHOR_ID, authorBalance);
        buyer = member(BUYER_ID, buyerBalance);
        Pin pin = activePin(author);
        given(pinRepository.findActivePinDetailById(eq(PIN_ID), any())).willReturn(Optional.of(pin));
        given(pinUnlockRepository.findByIdempotencyKey(KEY)).willReturn(Optional.empty());
        given(pinUnlockRepository.findByPin_IdAndMember_Id(PIN_ID, BUYER_ID)).willReturn(Optional.empty());
        given(memberRepository.findByIdForUpdate(BUYER_ID)).willReturn(Optional.of(buyer));
        given(memberRepository.findByIdForUpdate(AUTHOR_ID)).willReturn(Optional.of(author));
        given(pinUnlockRepository.saveAndFlush(any())).willAnswer(inv -> inv.getArgument(0));
    }
}
