package com.yuhan.wagglewaggle.domain.search.controller;

import com.yuhan.wagglewaggle.domain.search.dto.RecentSearchResponse;
import com.yuhan.wagglewaggle.domain.search.service.RecentSearchService;
import com.yuhan.wagglewaggle.global.response.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/places/search")
public class RecentSearchController {

    private final RecentSearchService recentSearchService;

    @GetMapping("/recent")
    public ApiResponse<List<RecentSearchResponse>> getRecentSearches(
            @AuthenticationPrincipal Long memberId,
            @RequestParam(required = false) Integer limit
    ) {
        List<RecentSearchResponse> result = recentSearchService.getRecentSearches(memberId, limit);

        return ApiResponse.success(HttpStatus.OK.value(), "최근 검색기록 조회가 완료되었습니다.", result);
    }
}
