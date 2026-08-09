package com.yuhan.wagglewaggle.domain.pin.tag.controller;

import com.yuhan.wagglewaggle.domain.pin.tag.service.PinTagIndexingService;
import com.yuhan.wagglewaggle.global.response.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * 태그 검색 인덱스 재색인(내부 전용). DB(ACTIVE·미삭제 핀) 기준으로 ES를 다시 채운다.
 * 시연 직전 DB 직접 INSERT 등 정상 색인 경로를 거치지 못한 핀을 ES에 반영할 때 사용한다.
 * 인증은 X-Internal-Secret 헤더로 InternalSecretAuthFilter가 담당한다(JWT 불필요).
 */
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/internal/pin-tags")
public class PinTagInternalController {

    private final PinTagIndexingService pinTagIndexingService;

    @PostMapping("/reindex")
    @ResponseStatus(HttpStatus.OK)
    public ApiResponse<Integer> reindexAll() {
        int count = pinTagIndexingService.reindexAllActivePins();
        return ApiResponse.success(HttpStatus.OK.value(), "태그 인덱스 재색인을 완료했습니다.", count);
    }
}
