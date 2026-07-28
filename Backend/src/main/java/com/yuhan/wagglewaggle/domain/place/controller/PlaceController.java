package com.yuhan.wagglewaggle.domain.place.controller;

import com.yuhan.wagglewaggle.domain.place.dto.NearbyPlaceSearchResponse;
import com.yuhan.wagglewaggle.domain.place.service.PlaceService;
import com.yuhan.wagglewaggle.global.response.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/places")
public class PlaceController {

    private final PlaceService placeService;

    @GetMapping("/nearby")
    public ApiResponse<List<NearbyPlaceSearchResponse>> getNearbyPlaces(
            @RequestParam String q,
            @RequestParam double latitude,
            @RequestParam double longitude,
            @RequestParam(defaultValue = "50") int radius
    ) {
        List<NearbyPlaceSearchResponse> places =
                placeService.findNearby(q, latitude, longitude, radius);

        return ApiResponse.success(HttpStatus.OK.value(), "주변 장소 조회가 완료되었습니다.", places);
    }
}
