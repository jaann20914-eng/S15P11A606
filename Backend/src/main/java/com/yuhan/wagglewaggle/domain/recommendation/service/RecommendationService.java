package com.yuhan.wagglewaggle.domain.recommendation.service;

import com.yuhan.wagglewaggle.domain.category.repository.CategoryPreferenceRepository;
import com.yuhan.wagglewaggle.domain.pin.entity.Pin;
import com.yuhan.wagglewaggle.domain.pin.repository.PinRepository;
import com.yuhan.wagglewaggle.domain.pin.repository.PinUnlockRepository;
import com.yuhan.wagglewaggle.domain.pin.repository.PlaceUnlockCountRow;
import com.yuhan.wagglewaggle.domain.place.entity.Place;
import com.yuhan.wagglewaggle.domain.place.repository.PlaceRepository;
import com.yuhan.wagglewaggle.domain.recommendation.cache.RecommendationCacheEntry;
import com.yuhan.wagglewaggle.domain.recommendation.cache.RecommendationCacheEntry.CachedPlace;
import com.yuhan.wagglewaggle.domain.recommendation.cache.RecommendationCacheStore;
import com.yuhan.wagglewaggle.domain.recommendation.client.AiRecommendationClient;
import com.yuhan.wagglewaggle.domain.recommendation.client.dto.CandidatePlace;
import com.yuhan.wagglewaggle.domain.recommendation.client.dto.ScoreRequest;
import com.yuhan.wagglewaggle.domain.recommendation.client.dto.ScoreResponse;
import com.yuhan.wagglewaggle.domain.recommendation.client.dto.ScoredPlace;
import com.yuhan.wagglewaggle.domain.recommendation.dto.PlaceCard;
import com.yuhan.wagglewaggle.domain.recommendation.dto.RecommendationResponse;
import com.yuhan.wagglewaggle.domain.user.entity.Member;
import com.yuhan.wagglewaggle.domain.user.repository.MemberRepository;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * 개인화 장소 추천 오케스트레이션.
 * 위치 결정 → 추천 캐시 조회 → (미스 시) 후보 조회·집계·AI 호출·캐시 저장 → 현재 활성 핀으로 응답 조립.
 * 위치/AI 오류는 각자의 코드로, 후보 조회·응답 구성 실패는 RECOMMENDATION_FETCH_FAILED로 매핑한다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RecommendationService {

    private static final int DEFAULT_LIMIT = 5;
    private static final int MIN_LIMIT = 1;
    private static final int MAX_LIMIT = 10;
    private static final int MAX_PER_TYPE = 10;
    private static final int MAX_PREFERRED_CATEGORIES = 3;
    private static final double RADIUS_METERS = 1000.0;
    private static final Duration UNLOCK_WINDOW = Duration.ofDays(7);
    private static final ZoneId KST = ZoneId.of("Asia/Seoul");

    private final PlaceRepository placeRepository;
    private final PinRepository pinRepository;
    private final PinUnlockRepository pinUnlockRepository;
    private final MemberRepository memberRepository;
    private final CategoryPreferenceRepository categoryPreferenceRepository;

    private final LocationResolver locationResolver;
    private final RecommendationCacheStore recommendationCacheStore;
    private final AiCandidateAssembler aiCandidateAssembler;
    private final AiRecommendationClient aiRecommendationClient;
    private final RecommendationResponseAssembler responseAssembler;

    public RecommendationResponse recommend(Long memberId, Double latitude, Double longitude, Integer limit) {
        int appliedLimit = normalizeLimit(limit);
        Instant now = Instant.now();

        // 위치 결정(INVALID_LOCATION/LOCATION_NOT_AVAILABLE/RECOMMENDATION_FETCH_FAILED는 여기서 던진다).
        ResolvedLocation location = locationResolver.resolve(memberId, latitude, longitude);

        try {
            String cacheKey = recommendationCacheStore.buildKey(memberId, location.latitude(), location.longitude());
            RecommendationCacheEntry entry = recommendationCacheStore.find(cacheKey)
                    .orElseGet(() -> computeAndCache(memberId, location, cacheKey, now));

            return assembleResponse(location, entry, appliedLimit, now);
        } catch (CustomException e) {
            // AI_RECOMMENDATION_FAILED 등 의미 있는 코드는 그대로 전파한다.
            throw e;
        } catch (Exception e) {
            log.error("추천 조회/구성 실패 (memberId={})", memberId, e);
            throw new CustomException(ErrorCode.RECOMMENDATION_FETCH_FAILED);
        }
    }

    /** 캐시 미스: 후보 조회 → 집계 → AI 호출 → 캐시 저장. 후보가 0개면 AI 호출 없이 빈 결과를 캐시한다. */
    private RecommendationCacheEntry computeAndCache(
            Long memberId, ResolvedLocation location, String cacheKey, Instant now) {

        OffsetDateTime generatedAt = OffsetDateTime.ofInstant(now, KST);

        List<Long> candidateIds = placeRepository.findCandidatePlaceIds(
                location.longitude(), location.latitude(), RADIUS_METERS, now);
        if (candidateIds.isEmpty()) {
            return cacheAndReturn(cacheKey, new RecommendationCacheEntry(List.of(), List.of(), generatedAt));
        }

        Map<Long, List<Pin>> activePinsByPlace = groupActivePinsByPlace(candidateIds, now);
        Map<Long, Place> placesById = extractPlaces(activePinsByPlace);
        Map<Long, Long> unlockCounts = loadUnlockCounts(candidateIds, now);

        List<CandidatePlace> candidates = aiCandidateAssembler.toCandidates(
                placesById, activePinsByPlace, unlockCounts);
        if (candidates.isEmpty()) {
            return cacheAndReturn(cacheKey, new RecommendationCacheEntry(List.of(), List.of(), generatedAt));
        }

        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new CustomException(ErrorCode.RECOMMENDATION_FETCH_FAILED));

        ScoreRequest request = new ScoreRequest(
                memberId,
                location.latitude(),
                location.longitude(),
                resolvePreferredCategories(memberId, candidates),
                member.getGender().name(),
                member.getAgeGroup().name(),
                DateTimeFormatter.ISO_OFFSET_DATE_TIME.format(generatedAt),
                candidates);

        ScoreResponse ai = aiRecommendationClient.score(request); // 실패 시 AI_RECOMMENDATION_FAILED

        RecommendationCacheEntry entry = new RecommendationCacheEntry(
                toCachedPlaces(ai.relaxedList()),
                toCachedPlaces(ai.wagleList()),
                generatedAt);
        return cacheAndReturn(cacheKey, entry);
    }

    /** 캐시 적중·미스 공통: 저장된 순서를 현재 활성 핀으로 다시 조립한다(활성 핀 없는 장소는 제외). */
    private RecommendationResponse assembleResponse(
            ResolvedLocation location, RecommendationCacheEntry entry, int limit, Instant now) {

        List<Long> placeIds = new ArrayList<>();
        entry.relaxed().forEach(cachedPlace -> placeIds.add(cachedPlace.placeId()));
        entry.wagle().forEach(cachedPlace -> placeIds.add(cachedPlace.placeId()));
        List<Long> distinctPlaceIds = placeIds.stream().distinct().toList();

        Map<Long, List<Pin>> activePinsByPlace = distinctPlaceIds.isEmpty()
                ? Map.of()
                : groupActivePinsByPlace(distinctPlaceIds, now);
        Map<Long, Place> placesById = extractPlaces(activePinsByPlace);

        List<PlaceCard> relaxed = responseAssembler.assemble(entry.relaxed(), limit, placesById, activePinsByPlace);
        List<PlaceCard> wagle = responseAssembler.assemble(entry.wagle(), limit, placesById, activePinsByPlace);

        return new RecommendationResponse(
                location.source(),
                entry.generatedAt(),
                new RecommendationResponse.Recommendations(relaxed, wagle));
    }

    private RecommendationCacheEntry cacheAndReturn(String cacheKey, RecommendationCacheEntry entry) {
        recommendationCacheStore.save(cacheKey, entry); // 저장 실패는 스토어가 무시한다.
        return entry;
    }

    private Map<Long, List<Pin>> groupActivePinsByPlace(List<Long> placeIds, Instant now) {
        return pinRepository.findActivePinsByPlaceIdIn(placeIds, now).stream()
                .collect(Collectors.groupingBy(
                        pin -> pin.getPlace().getId(), LinkedHashMap::new, Collectors.toList()));
    }

    /** 활성 핀에 fetch join된 place를 그대로 뽑아 placeId→Place 맵을 만든다(중복 조회 없음). */
    private Map<Long, Place> extractPlaces(Map<Long, List<Pin>> activePinsByPlace) {
        Map<Long, Place> places = new LinkedHashMap<>();
        activePinsByPlace.forEach((placeId, pins) -> {
            if (!pins.isEmpty()) {
                places.put(placeId, pins.get(0).getPlace());
            }
        });
        return places;
    }

    private Map<Long, Long> loadUnlockCounts(List<Long> placeIds, Instant now) {
        return pinUnlockRepository.countByPlaceSince(placeIds, now.minus(UNLOCK_WINDOW)).stream()
                .collect(Collectors.toMap(PlaceUnlockCountRow::getPlaceId, PlaceUnlockCountRow::getUnlockCount));
    }

    /** 선호 카테고리(1~3). 사용자 선호가 없으면 주변 후보 카테고리로 대체해 AI 필수 제약(≥1)을 만족시킨다. */
    private List<String> resolvePreferredCategories(Long memberId, List<CandidatePlace> candidates) {
        List<String> preferred = categoryPreferenceRepository.findPreferredCategoryCodes(memberId);
        if (preferred.isEmpty()) {
            preferred = candidates.stream().map(CandidatePlace::category).distinct().toList();
        }
        return preferred.stream().limit(MAX_PREFERRED_CATEGORIES).toList();
    }

    private List<CachedPlace> toCachedPlaces(List<ScoredPlace> scored) {
        if (scored == null) {
            return List.of();
        }
        return scored.stream()
                .limit(MAX_PER_TYPE)
                .map(place -> new CachedPlace(place.placeId(), place.representativePinId()))
                .toList();
    }

    private int normalizeLimit(Integer limit) {
        if (limit == null) {
            return DEFAULT_LIMIT;
        }
        return Math.max(MIN_LIMIT, Math.min(MAX_LIMIT, limit));
    }
}
