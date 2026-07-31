package com.yuhan.wagglewaggle.domain.pin.service;

import com.yuhan.wagglewaggle.domain.pin.entity.Pin;
import com.yuhan.wagglewaggle.domain.pin.entity.PinTag;
import com.yuhan.wagglewaggle.domain.pin.repository.PinTagRepository;
import com.yuhan.wagglewaggle.domain.pin.repository.PinUnlockRepository;
import com.yuhan.wagglewaggle.domain.place.dto.PinCard;
import com.yuhan.wagglewaggle.domain.user.entity.Member;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * 핀 목록을 핀 카드({@link PinCard})로 조립하는 공통 컴포넌트.
 * 태그·열람 여부를 각각 한 번씩 배치 조회해 핀별 N+1을 방지한다.
 * 작성자(닉네임·뷰 각도) 확보 방식은 호출자마다 다르므로(장소 상세는 fetch join된 member,
 * 태그 검색은 네이티브 조회 후 별도 배치 조회한 작성자) authorResolver로 위임한다.
 */
@Component
@RequiredArgsConstructor
public class PinCardAssembler {

    private final PinTagRepository pinTagRepository;
    private final PinUnlockRepository pinUnlockRepository;

    /**
     * 핀 목록을 핀 카드 목록으로 조립한다.
     * memberId가 null이면 열람 정보를 조회하지 않고 모든 핀을 미열람으로 처리한다.
     *
     * @param authorResolver 핀에서 작성자(Member)를 얻는 함수
     */
    public List<PinCard> assemble(List<Pin> pins, Long memberId, Function<Pin, Member> authorResolver) {
        if (pins.isEmpty()) {
            return List.of();
        }

        List<UUID> pinIds = pins.stream().map(Pin::getId).toList();

        Map<UUID, List<String>> tagsByPinId = pinTagRepository.findByPin_IdIn(pinIds).stream()
                .collect(Collectors.groupingBy(
                        pinTag -> pinTag.getPin().getId(),
                        Collectors.mapping(PinTag::getTag, Collectors.toList())));

        Set<UUID> unlockedPinIds = memberId == null
                ? Set.of()
                : new HashSet<>(pinUnlockRepository.findUnlockedPinIds(memberId, pinIds));

        return pins.stream()
                .map(pin -> {
                    Member author = authorResolver.apply(pin);
                    return new PinCard(
                            pin.getId(),
                            author.getNickname(),
                            author.getViewAngle(),
                            pin.getCreatedAt(),
                            pin.getMemo(),
                            pin.getThumbnailKey(),
                            unlockedPinIds.contains(pin.getId()),
                            tagsByPinId.getOrDefault(pin.getId(), List.of()));
                })
                .toList();
    }
}
