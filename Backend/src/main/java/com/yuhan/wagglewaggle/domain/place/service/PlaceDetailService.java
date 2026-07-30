package com.yuhan.wagglewaggle.domain.place.service;

import com.yuhan.wagglewaggle.domain.pin.entity.Pin;
import com.yuhan.wagglewaggle.domain.pin.entity.PinTag;
import com.yuhan.wagglewaggle.domain.pin.repository.PinRepository;
import com.yuhan.wagglewaggle.domain.pin.repository.PinTagRepository;
import com.yuhan.wagglewaggle.domain.pin.repository.PinUnlockRepository;
import com.yuhan.wagglewaggle.domain.pin.repository.WeeklyCrowdStatRow;
import com.yuhan.wagglewaggle.domain.place.client.KakaoLocalClient;
import com.yuhan.wagglewaggle.domain.place.client.dto.KakaoKeywordResponse;
import com.yuhan.wagglewaggle.domain.place.client.dto.KakaoKeywordResponse.Document;
import com.yuhan.wagglewaggle.domain.place.dto.PinCard;
import com.yuhan.wagglewaggle.domain.place.dto.PlaceDetailResponse;
import com.yuhan.wagglewaggle.domain.place.dto.PlaceInfo;
import com.yuhan.wagglewaggle.domain.place.dto.WeeklyCrowdStat;
import com.yuhan.wagglewaggle.domain.place.entity.Place;
import com.yuhan.wagglewaggle.domain.place.repository.PlaceRepository;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@Slf4j
@RequiredArgsConstructor
public class PlaceDetailService {

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");
    private static final Duration ACTIVE_WINDOW = Duration.ofHours(1);
    private static final Duration STAT_HALF_WINDOW = Duration.ofMinutes(30);

    private static final int KAKAO_RADIUS = 10;
    private static final int KAKAO_PAGE = 1;
    private static final int KAKAO_SIZE = 5;
    private static final String KAKAO_SORT = "accuracy";

    /** Postgres EXTRACT(DOW): 0=일 ... 6=토 → 요일 코드. */
    private static final Map<Integer, String> DAY_OF_WEEK_CODE = Map.of(
            0, "SUN", 1, "MON", 2, "TUE", 3, "WED", 4, "THU", 5, "FRI", 6, "SAT");
    /** 응답 요일 순서(MON~SUN)를 Postgres DOW 값으로 표현. */
    private static final List<Integer> OUTPUT_DAY_OF_WEEK_ORDER = List.of(1, 2, 3, 4, 5, 6, 0);

    private final PlaceRepository placeRepository;
    private final PinRepository pinRepository;
    private final PinTagRepository pinTagRepository;
    private final PinUnlockRepository pinUnlockRepository;
    private final KakaoLocalClient kakaoLocalClient;

    /**
     * 장소 홈(장소 상세)을 조회한다.
     * 장소 기본 정보·활성 핀 카드·요일별 혼잡 통계를 함께 반환하며,
     * 하나라도 조회에 실패하면 부분 응답을 내지 않고 PLACE_DETAIL_FETCH_FAILED 로 처리한다.
     */
    public PlaceDetailResponse getPlaceDetail(String placeIdRaw, Long memberId) {
        Long placeId = parsePlaceId(placeIdRaw);

        Place place = placeRepository.findById(placeId)
                .orElseThrow(() -> new CustomException(ErrorCode.PLACE_NOT_FOUND));

        try {
            Instant now = Instant.now();
            PlaceInfo placeInfo = loadPlaceInfo(place);
            List<WeeklyCrowdStat> weeklyCrowdStats = loadWeeklyCrowdStats(placeId, now);
            List<PinCard> pins = loadPinCards(placeId, memberId, now);
            return new PlaceDetailResponse(placeInfo, pins, weeklyCrowdStats);
        } catch (Exception e) {
            log.error("장소 상세 조회 실패 (placeId={})", placeId, e);
            throw new CustomException(ErrorCode.PLACE_DETAIL_FETCH_FAILED);
        }
    }

    private Long parsePlaceId(String placeIdRaw) {
        try {
            long placeId = Long.parseLong(placeIdRaw.trim());
            if (placeId <= 0) {
                throw new CustomException(ErrorCode.INVALID_PLACE_ID);
            }
            return placeId;
        } catch (NumberFormatException e) {
            throw new CustomException(ErrorCode.INVALID_PLACE_ID);
        }
    }

    /**
     * 단일 장소의 활성 핀 카드 목록을 만든다.
     * 활성 핀(+member)·태그·열람 여부를 각각 한 번씩 배치 조회해 핀별 N+1을 방지한다.
     */
    private List<PinCard> loadPinCards(Long placeId, Long memberId, Instant now) {
        List<Pin> pins = pinRepository.findActivePinsByPlaceId(
                placeId, now.minus(ACTIVE_WINDOW), now);
        if (pins.isEmpty()) {
            return List.of();
        }

        List<Long> pinIds = pins.stream().map(Pin::getId).toList();

        Map<Long, List<String>> tagsByPinId = pinTagRepository.findByPin_IdIn(pinIds).stream()
                .collect(Collectors.groupingBy(
                        pinTag -> pinTag.getPin().getId(),
                        Collectors.mapping(PinTag::getTag, Collectors.toList())));

        Set<Long> unlockedPinIds = memberId == null
                ? Set.of()
                : new HashSet<>(pinUnlockRepository.findUnlockedPinIds(memberId, pinIds));

        return pins.stream()
                .map(pin -> new PinCard(
                        pin.getId(),
                        pin.getMember().getNickname(),
                        pin.getMember().getViewAngle(),
                        pin.getCreatedAt(),
                        pin.getMemo(),
                        pin.getThumbnailKey(),
                        unlockedPinIds.contains(pin.getId()),
                        tagsByPinId.getOrDefault(pin.getId(), List.of())))
                .toList();
    }

    /**
     * 요청 시각(KST) 기준 ±30분 time-of-day 창으로 요일별 평균 혼잡 단계를 집계한다.
     * 집계는 DB에서 한 번에 수행하고, 여기서는 요일 매핑과 빈 요일 null 처리만 담당한다.
     * 데이터가 있는 요일이 하나도 없으면 빈 배열을 반환한다.
     */
    private List<WeeklyCrowdStat> loadWeeklyCrowdStats(Long placeId, Instant now) {
        ZonedDateTime nowKst = now.atZone(KST);
        LocalTime startTime = nowKst.toLocalTime().minus(STAT_HALF_WINDOW);
        LocalTime endTime = nowKst.toLocalTime().plus(STAT_HALF_WINDOW);
        boolean wrap = startTime.isAfter(endTime);

        List<WeeklyCrowdStatRow> rows = pinRepository.findWeeklyCrowdStats(
                placeId, startTime, endTime, wrap);
        if (rows.isEmpty()) {
            return List.of();
        }

        Map<Integer, Double> averageByDow = new HashMap<>();
        for (WeeklyCrowdStatRow row : rows) {
            averageByDow.put(row.getDayOfWeek(), roundToOneDecimal(row.getAverageWeight()));
        }

        return OUTPUT_DAY_OF_WEEK_ORDER.stream()
                .map(dow -> new WeeklyCrowdStat(DAY_OF_WEEK_CODE.get(dow), averageByDow.get(dow)))
                .toList();
    }

    private Double roundToOneDecimal(Double value) {
        if (value == null) {
            return null;
        }
        return Math.round(value * 10) / 10.0;
    }

    /**
     * 카카오 로컬 API로 장소 주소·전화번호를 실시간 조회한다.
     * kakao_place_id가 정확히 일치하는 항목을 찾고, 없으면 주소·전화번호는 빈 문자열이다.
     */
    private PlaceInfo loadPlaceInfo(Place place) {
        double latitude = place.getLocation().getY();
        double longitude = place.getLocation().getX();

        KakaoKeywordResponse response = kakaoLocalClient.searchNearby(
                place.getName(), longitude, latitude,
                KAKAO_RADIUS, KAKAO_PAGE, KAKAO_SIZE, KAKAO_SORT);

        String address = "";
        String phone = "";
        Document matched = findMatchingDocument(response, place.getKakaoPlaceId());
        if (matched != null) {
            address = resolveAddress(matched);
            phone = (matched.phone() != null && !matched.phone().isBlank()) ? matched.phone() : "";
        }

        return new PlaceInfo(place.getId(), place.getName(), address, phone);
    }

    private Document findMatchingDocument(KakaoKeywordResponse response, String kakaoPlaceId) {
        if (response == null || response.documents() == null) {
            return null;
        }
        return response.documents().stream()
                .filter(document -> kakaoPlaceId.equals(document.id()))
                .findFirst()
                .orElse(null);
    }

    private String resolveAddress(Document document) {
        if (document.roadAddressName() != null && !document.roadAddressName().isBlank()) {
            return document.roadAddressName();
        }
        if (document.addressName() != null && !document.addressName().isBlank()) {
            return document.addressName();
        }
        return "";
    }
}
