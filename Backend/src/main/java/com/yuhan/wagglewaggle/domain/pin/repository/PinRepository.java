package com.yuhan.wagglewaggle.domain.pin.repository;

import com.yuhan.wagglewaggle.domain.pin.entity.Pin;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PinRepository extends JpaRepository<Pin, UUID> {

    /**
     * 동일한 원본 영상 키가 이미 핀에 사용되었는지 검사한다(영상 중복 등록 방지).
     */
    boolean existsByOriginalVideoKey(String originalVideoKey);

    /**
     * 상세 조회 가능한 단일 핀을 조회한다(핀 상세용).
     * 조회 가능 = 요청 pinId 일치 AND videoStatus = ACTIVE AND 삭제되지 않음(deletedAt IS NULL)
     *            AND 아직 만료되지 않음(expiresAt이 현재 시각 이후).
     * 조건을 하나라도 충족하지 못하면 빈 결과이며, 호출부는 실제 상태와 무관하게 PIN_NOT_FOUND로 처리한다.
     * 작성자(닉네임·뷰 각도)와 장소(내부 ID·카카오 ID·장소명·좌표)를 함께 쓰므로
     * member·place를 fetch join 하여 N+1을 방지한다(둘 다 ToOne이라 카티전 곱이 없다).
     */
    @Query("""
            SELECT p FROM Pin p
            JOIN FETCH p.member
            JOIN FETCH p.place
            WHERE p.id = :pinId
              AND p.videoStatus = com.yuhan.wagglewaggle.domain.pin.entity.VideoStatus.ACTIVE
              AND p.deletedAt IS NULL
              AND p.expiresAt > :now
            """)
    Optional<Pin> findActivePinDetailById(
            @Param("pinId") UUID pinId,
            @Param("now") Instant now
    );

    /**
     * 특정 회원이 기준 시각 이후 등록한 핀 개수를 센다(일일 등록 제한 확인용).
     */
    long countByMember_IdAndCreatedAtGreaterThanEqual(Long memberId, Instant from);

    /**
     * 수정 검증용 단일 핀 조회. 삭제·만료·상태와 무관하게 조회한다.
     * 오류 코드를 정확히 구분(PIN_NOT_FOUND / PIN_UPDATE_FORBIDDEN / PIN_NOT_EDITABLE)하기 위해
     * 필터링은 서비스에서 수행한다. 작성자 판별(member)과 최종 장소·좌표 계산(place)에 쓰므로
     * member·place를 fetch join 하여 N+1을 방지한다(둘 다 ToOne이라 카티전 곱이 없다).
     */
    @Query("""
            SELECT p FROM Pin p
            JOIN FETCH p.member
            JOIN FETCH p.place
            WHERE p.id = :pinId
            """)
    Optional<Pin> findByIdWithMemberAndPlace(@Param("pinId") UUID pinId);

    /**
     * 수정 반영 트랜잭션용 단일 핀 조회(비관적 쓰기 잠금).
     * 한 Pin에 동시에 두 개의 영상 교체 작업이 생기지 않도록, 이 핀 행을 잠근 채 조회한다.
     * 동일 Pin에 대한 두 번째 요청은 첫 요청이 커밋될 때까지 대기하므로,
     * 잠금 이후 진행 중 PENDING 교체 작업 확인이 원자적으로 보장된다.
     * member·place는 지연 로딩 프록시로 접근하며(식별자만 사용), 잠금 대상은 pins 행으로 한정한다.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM Pin p WHERE p.id = :pinId")
    Optional<Pin> findByIdForUpdate(@Param("pinId") UUID pinId);

    /**
     * 삭제 트랜잭션용 단일 핀 조회(비관적 쓰기 잠금).
     * deleted_at 조건을 제외한 전용 잠금 조회로, 이미 삭제된 핀도 함께 조회한다
     * (동일 작성자의 재삭제 요청에서 최초 deleted_at을 유지하고 200 OK를 반환하기 위함).
     * 삭제 처리와 AI 결과 반영이 동시에 실행돼도 이 잠금으로 pins 행 접근이 직렬화된다.
     * 작성자 판별에 member 식별자만 사용하므로 member·place는 지연 로딩 프록시로 접근한다.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM Pin p WHERE p.id = :pinId")
    Optional<Pin> findByIdForDelete(@Param("pinId") UUID pinId);

    /**
     * 지정한 장소들의 유효 핀을 한 번에 조회한다.
     * 유효 = createdAt이 from 이후(최근 1시간 이내) AND (expiresAt이 없거나 아직 만료되지 않음).
     * 작성자 뷰 각도(member.viewAngle) 사용을 위해 member를 fetch join 하여 N+1을 방지한다.
     */
    @Query("""
            SELECT p FROM Pin p
            JOIN FETCH p.member
            WHERE p.place.id IN :placeIds
              AND p.createdAt >= :from
              AND (p.expiresAt IS NULL OR p.expiresAt > :now)
            """)
    List<Pin> findValidPins(
            @Param("placeIds") Collection<Long> placeIds,
            @Param("from") Instant from,
            @Param("now") Instant now
    );

    /**
     * 단일 장소의 활성 핀을 조회한다(장소 홈용).
     * 활성 = 삭제되지 않음(deletedAt IS NULL) AND createdAt이 from 이후(최근 1시간 이내)
     *        AND (expiresAt이 없거나 아직 만료되지 않음).
     * 작성자 닉네임·뷰 각도 사용을 위해 member를 fetch join 하여 N+1을 방지하고 최신순으로 정렬한다.
     */
    @Query("""
            SELECT p FROM Pin p
            JOIN FETCH p.member
            WHERE p.place.id = :placeId
              AND p.deletedAt IS NULL
              AND p.createdAt >= :from
              AND (p.expiresAt IS NULL OR p.expiresAt > :now)
            ORDER BY p.createdAt DESC
            """)
    List<Pin> findActivePinsByPlaceId(
            @Param("placeId") Long placeId,
            @Param("from") Instant from,
            @Param("now") Instant now
    );

    /**
     * 여러 장소의 현재 열람 가능한(활성) 핀을 한 번에 조회한다(추천 응답·AI 후보 집계용).
     * 추천 기능의 표준 활성 조건: videoStatus = ACTIVE AND deletedAt IS NULL AND expiresAt > now.
     * (핀 상세 조회 findActivePinDetailById와 동일한 기준이다.)
     * 작성자 닉네임·성별·연령대·뷰 각도(member)와 장소명·주소·전화번호·카테고리·좌표(place)를 함께 쓰므로
     * member·place를 fetch join 하여 N+1과 지연 로딩을 방지한다(둘 다 ToOne이라 카티전 곱이 없다).
     * 활성화 시각 내림차순(expiresAt = 활성화시각 + 1h이므로 expiresAt DESC)으로 정렬해
     * 대표 핀(첫 번째)과 pinPreviews 순서를 그대로 쓸 수 있게 한다.
     */
    @Query("""
            SELECT p FROM Pin p
            JOIN FETCH p.member
            JOIN FETCH p.place
            WHERE p.place.id IN :placeIds
              AND p.videoStatus = com.yuhan.wagglewaggle.domain.pin.entity.VideoStatus.ACTIVE
              AND p.deletedAt IS NULL
              AND p.expiresAt > :now
            ORDER BY p.expiresAt DESC
            """)
    List<Pin> findActivePinsByPlaceIdIn(
            @Param("placeIds") Collection<Long> placeIds,
            @Param("now") Instant now
    );

    /**
     * 지도 영역 내에서 특정 태그가 정확히 일치하는 활성 핀을 조회한다(태그 검색 확정용).
     * 활성 = 삭제되지 않음(deleted_at IS NULL) AND (expires_at이 없거나 아직 만료되지 않음)
     * PostGIS ST_Covers로 지도 경계(bounds) 영역 필터를 적용하고 최신순으로 정렬한다.
     * ST_MakeEnvelope 인자 순서는 (minLng, minLat, maxLng, maxLat, srid)이다.
     * 네이티브 쿼리이므로 member는 LAZY 상태이며, 서비스에서 memberId 배치 조회로 N+1을 방지한다.
     */
    @Query(value = """
            SELECT p.* FROM pins p
            JOIN pin_tags pt ON pt.pin_id = p.id
            WHERE pt.tag = :tag
              AND p.deleted_at IS NULL
              AND (p.expires_at IS NULL OR p.expires_at > :now)
              AND ST_Covers(
                    ST_MakeEnvelope(:swLng, :swLat, :neLng, :neLat, 4326)::geography,
                    p.capture_location)
            ORDER BY p.created_at DESC
            """, nativeQuery = true)
    List<Pin> findActivePinsByTagWithinBounds(
            @Param("tag") String tag,
            @Param("now") Instant now,
            @Param("swLng") double swLng,
            @Param("swLat") double swLat,
            @Param("neLng") double neLng,
            @Param("neLat") double neLat
    );

    /**
     * 단일 장소의 요일별 혼잡 통계를 DB에서 한 번에 집계한다(장소 홈용).
     * - 삭제된 핀 제외(deleted_at IS NULL). 만료 핀은 포함하며 최신성 창은 적용하지 않는다(전체 기간).
     * - created_at을 KST(Asia/Seoul)로 변환한 time-of-day가 [startTime, endTime] 창에 드는 핀만 집계한다.
     *   자정을 넘는 창(wrap)은 startTime 이상 OR endTime 이하로 판정한다.
     * - 요일은 KST 기준 EXTRACT(DOW): 0=일 ... 6=토.
     * - crowd_level은 enum 문자열로 저장되므로 SQL에서 CASE로 가중치(1~4)를 매핑해 평균낸다.
     * 데이터가 있는 요일만 행으로 반환되며, 없는 요일은 결과에 포함되지 않는다.
     */
    @Query(value = """
            SELECT EXTRACT(DOW FROM (p.created_at AT TIME ZONE 'Asia/Seoul'))::int AS "dayOfWeek",
                   AVG(CASE p.crowd_level
                           WHEN 'WAGLE_WAGLE' THEN 4
                           WHEN 'WAGLE' THEN 3
                           WHEN 'RELAXED' THEN 2
                           WHEN 'LEISURELY' THEN 1
                       END) AS "averageWeight"
            FROM pins p
            WHERE p.place_id = :placeId
              AND p.deleted_at IS NULL
              AND ( (:wrap = FALSE
                        AND (p.created_at AT TIME ZONE 'Asia/Seoul')::time BETWEEN :startTime AND :endTime)
                 OR (:wrap = TRUE
                        AND ((p.created_at AT TIME ZONE 'Asia/Seoul')::time >= :startTime
                          OR (p.created_at AT TIME ZONE 'Asia/Seoul')::time <= :endTime)) )
            GROUP BY 1
            """, nativeQuery = true)
    List<WeeklyCrowdStatRow> findWeeklyCrowdStats(
            @Param("placeId") Long placeId,
            @Param("startTime") LocalTime startTime,
            @Param("endTime") LocalTime endTime,
            @Param("wrap") boolean wrap
    );

    // ===== 내 프로필·활동 요약(월간 활동/오늘) 집계 =====
    // 집계 대상: 본인의 ACTIVE·미삭제 영상핀 중 정상 등록 완료된 핀.
    // 정상 등록 완료 시점 = expires_at - 1h. 서비스 날짜 경계 = Asia/Seoul 매일 04시(전날의 서비스 날짜).
    // 두 보정을 합쳐 (expires_at AT TIME ZONE 'Asia/Seoul') - INTERVAL '5 hour'(= -1h 완료 -4h 경계)를
    // 날짜로 잘라 서비스 날짜로 삼는다(KST는 DST가 없어 AT TIME ZONE 전/후 고정 오프셋 감산이 동일하다).
    // PENDING·REJECTED·FAILED·소프트 삭제·expires_at 미설정 핀은 집계하지 않는다.

    /**
     * 선택 월(서비스 날짜 기준 [startDate, endDateExclusive))의 서비스 날짜별 영상핀 수를 집계한다.
     * 활동이 있는 날짜만 행으로 반환되며, 없는 날짜 0 채움과 합계 계산은 서비스에서 수행한다.
     */
    @Query(value = """
            SELECT ((p.expires_at AT TIME ZONE 'Asia/Seoul') - INTERVAL '5 hour')::date AS "serviceDate",
                   COUNT(*) AS "videoPinCount"
            FROM pins p
            WHERE p.member_id = :memberId
              AND p.video_status = 'ACTIVE'
              AND p.deleted_at IS NULL
              AND p.expires_at IS NOT NULL
              AND ((p.expires_at AT TIME ZONE 'Asia/Seoul') - INTERVAL '5 hour')::date >= :startDate
              AND ((p.expires_at AT TIME ZONE 'Asia/Seoul') - INTERVAL '5 hour')::date <  :endDateExclusive
            GROUP BY 1
            """, nativeQuery = true)
    List<DailyPinCountRow> findDailyActiveVideoPinCounts(
            @Param("memberId") Long memberId,
            @Param("startDate") LocalDate startDate,
            @Param("endDateExclusive") LocalDate endDateExclusive
    );

    /**
     * 특정 서비스 날짜(보통 오늘)에 정상 등록 완료된 본인의 ACTIVE 영상핀 수를 센다(todayVideoPinCount용).
     */
    @Query(value = """
            SELECT COUNT(*)
            FROM pins p
            WHERE p.member_id = :memberId
              AND p.video_status = 'ACTIVE'
              AND p.deleted_at IS NULL
              AND p.expires_at IS NOT NULL
              AND ((p.expires_at AT TIME ZONE 'Asia/Seoul') - INTERVAL '5 hour')::date = :serviceDate
            """, nativeQuery = true)
    long countActiveVideoPinsByServiceDate(
            @Param("memberId") Long memberId,
            @Param("serviceDate") LocalDate serviceDate
    );

    // ===== 오늘 등록 핀 목록(커서 페이지네이션) =====
    // 오늘 범위 = [start, end) (서비스 날짜 KST 04시 ~ 다음 서비스 날짜 KST 04시), 기준은 createdAt.
    // 대상 = 현재 사용자가 등록한 핀 중 소프트 삭제되지 않은 핀 전부(PENDING·ACTIVE·REJECTED·FAILED 포함,
    //        만료 여부 무관). 장소명·주소 노출에 place를 쓰므로 fetch join으로 N+1을 방지한다(ToOne).
    // 정렬 = createdAt DESC, id DESC. limit+1건을 조회해 다음 페이지 존재 여부를 판단한다(nextCursor 발급용).

    /**
     * 오늘 등록 핀의 첫 페이지를 조회한다(커서 없음).
     */
    @Query("""
            SELECT p FROM Pin p
            JOIN FETCH p.place
            WHERE p.member.id = :memberId
              AND p.deletedAt IS NULL
              AND p.createdAt >= :start
              AND p.createdAt < :end
            ORDER BY p.createdAt DESC, p.id DESC
            """)
    List<Pin> findTodayPinsFirstPage(
            @Param("memberId") Long memberId,
            @Param("start") Instant start,
            @Param("end") Instant end,
            Pageable pageable
    );

    /**
     * 오늘 등록 핀의 커서 이후 페이지를 조회한다.
     * 정렬(createdAt DESC, id DESC)과 동일한 타이브레이커로, 커서보다 "뒤"에 오는 핀만 조회한다:
     * createdAt이 더 이르거나, createdAt이 같으면 id가 더 작은 핀.
     */
    @Query("""
            SELECT p FROM Pin p
            JOIN FETCH p.place
            WHERE p.member.id = :memberId
              AND p.deletedAt IS NULL
              AND p.createdAt >= :start
              AND p.createdAt < :end
              AND ( p.createdAt < :cursorCreatedAt
                 OR (p.createdAt = :cursorCreatedAt AND p.id < :cursorId) )
            ORDER BY p.createdAt DESC, p.id DESC
            """)
    List<Pin> findTodayPinsAfterCursor(
            @Param("memberId") Long memberId,
            @Param("start") Instant start,
            @Param("end") Instant end,
            @Param("cursorCreatedAt") Instant cursorCreatedAt,
            @Param("cursorId") UUID cursorId,
            Pageable pageable
    );

    // ===== 요청받은 채팅이 있는 핀 목록(커서 페이지네이션) =====
    // 대상 = 현재 사용자가 수신자(recipient=핀 소유자)인 채팅방이 1건 이상 존재하는, 삭제되지 않은 핀.
    //        상태(PENDING·ACTIVE·REFUSED·LEFT)는 구분하지 않는다. EXISTS 서브쿼리로 핀당 1건만 반환한다(중복 제거).
    // 정렬 = createdAt DESC, id DESC. 장소명·주소 노출에 place를 쓰므로 fetch join으로 N+1을 방지한다(ToOne).
    // limit+1건을 조회해 다음 페이지 존재 여부를 판단한다(nextCursor 발급용).

    /**
     * 요청받은 채팅이 있는 핀의 첫 페이지를 조회한다(커서 없음).
     */
    @Query("""
            SELECT p FROM Pin p
            JOIN FETCH p.place
            WHERE p.deletedAt IS NULL
              AND EXISTS (
                  SELECT 1 FROM ChatRoom cr
                  WHERE cr.pin = p AND cr.recipient.id = :memberId
              )
            ORDER BY p.createdAt DESC, p.id DESC
            """)
    List<Pin> findReceivedChatPinsFirstPage(
            @Param("memberId") Long memberId,
            Pageable pageable
    );

    /**
     * 요청받은 채팅이 있는 핀의 커서 이후 페이지를 조회한다.
     * 정렬(createdAt DESC, id DESC)과 동일한 타이브레이커로, 커서보다 "뒤"에 오는 핀만 조회한다:
     * createdAt이 더 이르거나, createdAt이 같으면 id가 더 작은 핀.
     */
    @Query("""
            SELECT p FROM Pin p
            JOIN FETCH p.place
            WHERE p.deletedAt IS NULL
              AND EXISTS (
                  SELECT 1 FROM ChatRoom cr
                  WHERE cr.pin = p AND cr.recipient.id = :memberId
              )
              AND ( p.createdAt < :cursorCreatedAt
                 OR (p.createdAt = :cursorCreatedAt AND p.id < :cursorId) )
            ORDER BY p.createdAt DESC, p.id DESC
            """)
    List<Pin> findReceivedChatPinsAfterCursor(
            @Param("memberId") Long memberId,
            @Param("cursorCreatedAt") Instant cursorCreatedAt,
            @Param("cursorId") UUID cursorId,
            Pageable pageable
    );
}
