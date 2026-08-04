package com.yuhan.wagglewaggle.domain.recommendation.service;

import com.yuhan.wagglewaggle.domain.pin.entity.Pin;
import com.yuhan.wagglewaggle.domain.place.entity.Place;
import com.yuhan.wagglewaggle.domain.recommendation.cache.RecommendationCacheEntry.CachedPlace;
import com.yuhan.wagglewaggle.domain.recommendation.dto.PinPreview;
import com.yuhan.wagglewaggle.domain.recommendation.dto.PlaceCard;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 캐시(또는 신규)의 장소 순서 목록을 현재 활성 핀으로 다시 조립해 응답 카드를 만든다.
 * - 현재 활성 핀이 없는 장소는 제외한다.
 * - 대표 핀: 캐시된 representativePinId가 아직 활성이면 그 핀을, 아니면 가장 최근 활성 핀을 pinPreviews[0]에 둔다.
 * - 나머지는 활성화 시각 내림차순(입력 정렬 유지)으로 pinPreviews 최대 5개까지.
 * - limit은 이 시점에 유형별로 적용한다(활성 핀이 있는 장소 기준 최대 limit개).
 */
@Component
public class RecommendationResponseAssembler {

    private static final int MAX_PIN_PREVIEWS = 5;

    public List<PlaceCard> assemble(
            List<CachedPlace> orderedPlaces,
            int limit,
            Map<Long, Place> placesById,
            Map<Long, List<Pin>> activePinsByPlace) {

        List<PlaceCard> cards = new ArrayList<>();
        for (CachedPlace cachedPlace : orderedPlaces) {
            if (cards.size() >= limit) {
                break;
            }
            List<Pin> activePins = activePinsByPlace.get(cachedPlace.placeId());
            Place place = placesById.get(cachedPlace.placeId());
            if (activePins == null || activePins.isEmpty() || place == null) {
                continue; // 현재 열람 가능한 핀이 모두 사라진 장소는 제외
            }
            cards.add(buildCard(place, activePins, cachedPlace.representativePinId()));
        }
        return cards;
    }

    private PlaceCard buildCard(Place place, List<Pin> activePins, UUID cachedRepresentativePinId) {
        // activePins는 expiresAt DESC(활성화 시각 최신순) 정렬 가정.
        Pin representative = activePins.stream()
                .filter(pin -> pin.getId().equals(cachedRepresentativePinId))
                .findFirst()
                .orElse(activePins.get(0)); // 캐시 대표 핀이 비활성/삭제면 가장 최근 활성 핀으로 재선정

        List<Pin> previewPins = new ArrayList<>();
        previewPins.add(representative);
        for (Pin pin : activePins) {
            if (previewPins.size() >= MAX_PIN_PREVIEWS) {
                break;
            }
            if (!pin.getId().equals(representative.getId())) {
                previewPins.add(pin);
            }
        }

        List<PinPreview> pinPreviews = previewPins.stream()
                .map(pin -> new PinPreview(pin.getId(), pin.getMember().getViewAngle().doubleValue()))
                .toList();

        long uploaderCount = activePins.stream()
                .map(pin -> pin.getMember().getId())
                .distinct()
                .count();

        return new PlaceCard(
                place.getId(),
                place.getName(),
                place.getAddressName(),
                StringUtils.hasText(place.getPhone()) ? place.getPhone() : null,
                activePins.size(),
                (int) uploaderCount,
                representative.getMember().getNickname(),
                pinPreviews);
    }
}
