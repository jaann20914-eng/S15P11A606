package com.yuhan.wagglewaggle.domain.pin.tag.controller;

import com.yuhan.wagglewaggle.domain.pin.dto.TaggedPinsResponse;
import com.yuhan.wagglewaggle.domain.pin.tag.dto.TagSearchResponse;
import com.yuhan.wagglewaggle.domain.pin.tag.service.TagSearchService;
import com.yuhan.wagglewaggle.domain.pin.tag.service.TaggedPinService;
import com.yuhan.wagglewaggle.global.response.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/pins/tags")
public class TagController {

    private final TagSearchService tagSearchService;
    private final TaggedPinService taggedPinService;

    @GetMapping("/search")
    public ApiResponse<TagSearchResponse> searchTags(
            @RequestParam String q,
            @RequestParam double southWestLatitude,
            @RequestParam double southWestLongitude,
            @RequestParam double northEastLatitude,
            @RequestParam double northEastLongitude
    ) {
        TagSearchResponse result = tagSearchService.search(
                q, southWestLatitude, southWestLongitude, northEastLatitude, northEastLongitude);

        return ApiResponse.success(HttpStatus.OK.value(), "태그 검색이 완료되었습니다.", result);
    }


    /**
     * 요청한 태그가 포함된 활성 핀 목록을 지도 영역 기준으로 조회한다(태그 검색 확정).
     * 태그는 '#'을 포함해 전달되며 서비스에서 정규화한다. 검색어는 최근 검색기록으로 저장된다.
     */
    @PostMapping("/search")
    public ApiResponse<TaggedPinsResponse> searchPinsByTag(
            @AuthenticationPrincipal Long memberId,
            @RequestParam String tag,
            @RequestParam double southWestLatitude,
            @RequestParam double southWestLongitude,
            @RequestParam double northEastLatitude,
            @RequestParam double northEastLongitude
    ) {
        TaggedPinsResponse result = taggedPinService.searchPinsByTag(
                memberId, tag,
                southWestLatitude, southWestLongitude, northEastLatitude, northEastLongitude);

        return ApiResponse.success(HttpStatus.OK.value(),
                "태그가 포함된 핀 목록 조회가 완료되었습니다.", result);
    }
}
