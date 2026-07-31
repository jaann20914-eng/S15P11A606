package com.yuhan.wagglewaggle.domain.pin.tag.controller;

import com.yuhan.wagglewaggle.domain.pin.tag.dto.TagSearchResponse;
import com.yuhan.wagglewaggle.domain.pin.tag.service.TagSearchService;
import com.yuhan.wagglewaggle.global.response.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/pins/tags")
public class TagController {

    private final TagSearchService tagSearchService;

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
}
