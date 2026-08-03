package com.yuhan.wagglewaggle.domain.recommendation.service;

import com.yuhan.wagglewaggle.domain.pin.entity.Pin;
import com.yuhan.wagglewaggle.domain.place.entity.Place;
import com.yuhan.wagglewaggle.domain.place.entity.PlaceCategory;
import com.yuhan.wagglewaggle.domain.recommendation.client.dto.CandidatePlace;
import com.yuhan.wagglewaggle.domain.user.entity.Member;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * 후보 장소별 현재 활성 핀을 접어 AI 요청의 CandidatePlace 목록을 만든다.
 * - crowdLevel: 활성 핀 CrowdLevel 가중치(1~4) 평균(소수 첫째자리)
 * - lastPinActivatedAt: 활성 핀 중 가장 최근 활성화 시각(= 최대 expiresAt - 1h), 타임존 포함 ISO-8601
 * - authorCount/authorGenderDist/authorAgeDist: 활성 핀의 '서로 다른' 작성자 기준(분포 합=1)
 * - representativePinId: 활성 핀 중 가장 최근 활성화된 핀(입력 목록은 expiresAt DESC 정렬)
 */
@Component
public class AiCandidateAssembler {

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");
    // expiresAt = 활성화 시각 + 1h (Pin.activate) 이므로, 활성화 시각 = expiresAt - 1h.
    private static final Duration ACTIVE_VIDEO_TTL = Duration.ofHours(1);

    /**
     * @param placesById         후보 장소(id→Place)
     * @param activePinsByPlace  후보 장소별 활성 핀(placeId→pins, expiresAt DESC 정렬 가정)
     * @param unlockCount7dByPlace 후보 장소별 최근 7일 열람수(없으면 0)
     */
    public List<CandidatePlace> toCandidates(
            Map<Long, Place> placesById,
            Map<Long, List<Pin>> activePinsByPlace,
            Map<Long, Long> unlockCount7dByPlace) {

        List<CandidatePlace> candidates = new ArrayList<>();
        for (Map.Entry<Long, List<Pin>> entry : activePinsByPlace.entrySet()) {
            Long placeId = entry.getKey();
            List<Pin> pins = entry.getValue();
            Place place = placesById.get(placeId);
            // 후보 쿼리가 이미 ETC·비활성핀을 걸렀지만 방어적으로 재확인한다.
            if (place == null || place.getCategory() == PlaceCategory.ETC || pins == null || pins.isEmpty()) {
                continue;
            }
            candidates.add(buildCandidate(place, pins, unlockCount7dByPlace.getOrDefault(placeId, 0L)));
        }
        return candidates;
    }

    private CandidatePlace buildCandidate(Place place, List<Pin> pins, long unlockCount7d) {
        Pin representative = pins.get(0); // expiresAt DESC → 가장 최근 활성화
        double crowdLevel = roundToOneDecimal(
                pins.stream().mapToInt(p -> p.getCrowdLevel().getWeight()).average().orElse(1.0));
        Instant activatedAt = representative.getExpiresAt().minus(ACTIVE_VIDEO_TTL);

        // 서로 다른 작성자 집계(핀 수가 아니라 작성자 수 기준 분포)
        Map<Long, Member> authorsById = new LinkedHashMap<>();
        for (Pin pin : pins) {
            authorsById.putIfAbsent(pin.getMember().getId(), pin.getMember());
        }
        Collection<Member> authors = authorsById.values();

        return new CandidatePlace(
                place.getId(),
                representative.getId(),
                place.getLocation().getY(),
                place.getLocation().getX(),
                place.getCategory().name(),
                crowdLevel,
                DateTimeFormatter.ISO_OFFSET_DATE_TIME.format(OffsetDateTime.ofInstant(activatedAt, KST)),
                (int) unlockCount7d,
                authors.size(),
                distribution(authors, member -> member.getGender().name()),
                distribution(authors, member -> member.getAgeGroup().name()));
    }

    /** 작성자 집합을 key별 비율(합=1)로 만든다. 비율 0인 key는 포함하지 않는다. */
    private Map<String, Double> distribution(Collection<Member> authors, Function<Member, String> key) {
        Map<String, Long> counts = authors.stream()
                .collect(Collectors.groupingBy(key, Collectors.counting()));
        int total = authors.size();
        Map<String, Double> distribution = new LinkedHashMap<>();
        counts.forEach((k, count) -> distribution.put(k, count.doubleValue() / total));
        return distribution;
    }

    private double roundToOneDecimal(double value) {
        return Math.round(value * 10.0) / 10.0;
    }
}
