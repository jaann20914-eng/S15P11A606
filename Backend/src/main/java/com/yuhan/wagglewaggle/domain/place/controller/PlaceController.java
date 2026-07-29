package com.yuhan.wagglewaggle.domain.place.controller;

import com.yuhan.wagglewaggle.domain.place.dto.PlaceSearchResponse;
import com.yuhan.wagglewaggle.domain.place.service.PlaceService;
import com.yuhan.wagglewaggle.global.response.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/places")
public class PlaceController {

    private final PlaceService placeService;

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
}
