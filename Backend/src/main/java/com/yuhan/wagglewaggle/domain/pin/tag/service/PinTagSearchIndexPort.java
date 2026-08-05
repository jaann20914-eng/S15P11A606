package com.yuhan.wagglewaggle.domain.pin.tag.service;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * 핀-태그 검색 인덱스(pin-tags) 쓰기 경계(Port).
 *
 * <p>핀 라이프사이클(ACTIVE 전환·태그 수정·영상 교체·삭제)에 맞춰 ES `pin-tags` 인덱스를
 * DB와 정합하도록 갱신한다. 읽기(자동완성)는 {@code TagSearchService}가 담당한다.</p>
 *
 * <p>모든 호출은 DB 트랜잭션 커밋 이후에 수행하며, 색인 실패는 요청/트랜잭션을 롤백하지 않는
 * best-effort로 처리한다(구현체가 예외를 삼키고 로깅한다).</p>
 */
public interface PinTagSearchIndexPort {

    /**
     * 지정한 핀의 태그를 현재 상태로 인덱스에 반영한다(최초 색인·갱신을 모두 포괄하는 upsert).
     * 기존 문서가 있으면 모두 제거한 뒤 전달된 태그로 다시 색인해(delete-first), 최초 색인은 물론
     * 태그 추가·삭제·변경도 균일하게 반영하고 중복 실행에도 멱등하다.
     * ACTIVE 핀에만 호출되므로 색인 문서의 active는 항상 true다.
     *
     * @param pinId     핀 PK(UUID)
     * @param tags      현재 태그 목록(빈 목록이면 기존 문서 제거만 수행)
     * @param latitude  촬영 좌표 위도
     * @param longitude 촬영 좌표 경도
     * @param expiresAt 노출 만료 시각
     */
    void index(UUID pinId, List<String> tags, double latitude, double longitude, Instant expiresAt);

    /**
     * 지정한 핀의 태그 문서를 모두 제거한다(핀 삭제 시). 이미 없으면 아무 일도 하지 않는다(멱등).
     */
    void removeByPin(UUID pinId);
}
