package com.yuhan.wagglewaggle.domain.place.controller;

import com.yuhan.wagglewaggle.domain.place.dto.PlaceDetailResponse;
import com.yuhan.wagglewaggle.domain.place.dto.PlaceListResponse;
import com.yuhan.wagglewaggle.domain.place.dto.PlaceSearchConfirmRequest;
import com.yuhan.wagglewaggle.domain.place.dto.PlaceSearchResponse;
import com.yuhan.wagglewaggle.domain.place.service.PlaceDetailService;
import com.yuhan.wagglewaggle.domain.place.service.PlacePinService;
import com.yuhan.wagglewaggle.domain.place.service.PlaceSearchConfirmService;
import com.yuhan.wagglewaggle.domain.place.service.PlaceService;
import com.yuhan.wagglewaggle.global.response.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/places")
public class PlaceController {

    private final PlaceService placeService;
    private final PlacePinService placePinService;
    private final PlaceDetailService placeDetailService;
    private final PlaceSearchConfirmService placeSearchConfirmService;

    @GetMapping("/search")
    public ApiResponse<PlaceSearchResponse> searchPlaces(
            @RequestParam String q,
            @RequestParam double latitude,
            @RequestParam double longitude,
            @RequestParam(required = false) Integer radius
    ) {
        PlaceSearchResponse result = placeService.searchPlaces(q, latitude, longitude, radius);

        return ApiResponse.success(HttpStatus.OK.value(), "장소 검색이 완료되었습니다.", result);
    }

    @PostMapping("/search/{kakaoPlaceId}")
    public ApiResponse<PlaceDetailResponse> confirmPlaceSearch(
            @PathVariable String kakaoPlaceId,
            @RequestBody PlaceSearchConfirmRequest request,
            @AuthenticationPrincipal Long memberId
    ) {
        PlaceDetailResponse result = placeSearchConfirmService.confirmPlaceSearch(
                kakaoPlaceId, request.placeName(), memberId);

        return ApiResponse.success(HttpStatus.OK.value(), "장소 검색 확정이 완료되었습니다.", result);
    }

    @GetMapping
    public ApiResponse<PlaceListResponse> getPlaces(
            @RequestParam double southWestLatitude,
            @RequestParam double southWestLongitude,
            @RequestParam double northEastLatitude,
            @RequestParam double northEastLongitude,
            @RequestParam String filter
    ) {
        PlaceListResponse result = placePinService.getPlacesInMapRange(
                southWestLatitude, southWestLongitude, northEastLatitude, northEastLongitude, filter);

        return ApiResponse.success(HttpStatus.OK.value(), "장소 목록 조회가 완료되었습니다.", result);
    }

    @GetMapping("/{placeId}")
    public ApiResponse<PlaceDetailResponse> getPlaceDetail(
            @PathVariable String placeId,
            @AuthenticationPrincipal Long memberId
    ) {
        PlaceDetailResponse result = placeDetailService.getPlaceDetail(placeId, memberId);

        return ApiResponse.success(HttpStatus.OK.value(), "장소 상세 조회가 완료되었습니다.", result);
    }
}
