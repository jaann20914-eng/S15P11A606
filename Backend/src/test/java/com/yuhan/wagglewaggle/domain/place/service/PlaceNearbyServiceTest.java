package com.yuhan.wagglewaggle.domain.place.service;

import com.yuhan.wagglewaggle.domain.place.client.KakaoLocalClient;
import com.yuhan.wagglewaggle.domain.place.client.dto.KakaoKeywordResponse;
import com.yuhan.wagglewaggle.domain.place.client.dto.KakaoKeywordResponse.Document;
import com.yuhan.wagglewaggle.domain.place.dto.PlaceNearbyItem;
import com.yuhan.wagglewaggle.domain.place.dto.PlaceNearbyResponse;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.ResourceAccessException;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PlaceNearbyServiceTest {

    @Mock private KakaoLocalClient kakaoLocalClient;

    @InjectMocks private PlaceNearbyService placeNearbyService;

    // 강남역 인근 사용자 좌표.
    private static final double USER_LAT = 37.501;
    private static final double USER_LNG = 127.039;

    @BeforeEach
    void setUp() {
        // 기본적으로 모든 카테고리·키워드 검색은 빈 결과를 반환한다.
        given(kakaoLocalClient.searchCategory(anyString(), anyDouble(), anyDouble(), anyInt(), anyInt(), anyString()))
                .willReturn(new KakaoKeywordResponse(List.of()));
        given(kakaoLocalClient.searchNearby(anyString(), anyDouble(), anyDouble(), anyInt(), anyInt(), anyInt(), anyString()))
                .willReturn(new KakaoKeywordResponse(List.of()));
    }

    private Document document(String id, String name, String categoryGroupCode, String distance) {
        return new Document(
                id, name, "서울 강남구 역삼동 826", "서울 강남구 테헤란로 101",
                categoryGroupCode, "카페", "음식점 > 카페 > 커피전문점",
                "02-1234-5678", String.valueOf(USER_LNG), String.valueOf(USER_LAT), distance);
    }

    @Test
    void 각_카테고리와_키워드에서_후보를_모아_거리_오름차순으로_반환한다() {
        given(kakaoLocalClient.searchCategory(eq("CE7"), anyDouble(), anyDouble(), anyInt(), anyInt(), anyString()))
                .willReturn(new KakaoKeywordResponse(List.of(
                        document("1", "카페A", "CE7", "40"),
                        document("2", "카페B", "CE7", "10"))));
        given(kakaoLocalClient.searchNearby(eq("공원"), anyDouble(), anyDouble(), anyInt(), anyInt(), anyInt(), anyString()))
                .willReturn(new KakaoKeywordResponse(List.of(
                        document("3", "공원A", "AT4", "25"))));

        PlaceNearbyResponse response = placeNearbyService.getNearbyPlaces(USER_LAT, USER_LNG);

        assertThat(response.places()).extracting(PlaceNearbyItem::kakaoPlaceId)
                .containsExactly("2", "3", "1");
        assertThat(response.places()).extracting(PlaceNearbyItem::distanceMeters)
                .containsExactly(10, 25, 40);
    }

    @Test
    void 카테고리별_최대_2개까지만_취한다() {
        given(kakaoLocalClient.searchCategory(eq("CE7"), anyDouble(), anyDouble(), anyInt(), anyInt(), anyString()))
                .willReturn(new KakaoKeywordResponse(List.of(
                        document("1", "카페A", "CE7", "10"),
                        document("2", "카페B", "CE7", "20"),
                        document("3", "카페C", "CE7", "30"))));

        PlaceNearbyResponse response = placeNearbyService.getNearbyPlaces(USER_LAT, USER_LNG);

        assertThat(response.places()).extracting(PlaceNearbyItem::kakaoPlaceId)
                .containsExactly("1", "2");
    }

//    @Test
//    void 반경_50m를_초과하는_후보는_제외한다() {
//        given(kakaoLocalClient.searchCategory(eq("CE7"), anyDouble(), anyDouble(), anyInt(), anyInt(), anyString()))
//                .willReturn(new KakaoKeywordResponse(List.of(
//                        document("1", "가까운카페", "CE7", "30"),
//                        document("2", "먼카페", "CE7", "80"))));
//
//        PlaceNearbyResponse response = placeNearbyService.getNearbyPlaces(USER_LAT, USER_LNG);
//
//        assertThat(response.places()).extracting(PlaceNearbyItem::kakaoPlaceId)
//                .containsExactly("1");
//    }

    @Test
    void 결과가_없으면_빈_배열을_반환한다() {
        PlaceNearbyResponse response = placeNearbyService.getNearbyPlaces(USER_LAT, USER_LNG);

        assertThat(response.places()).isEmpty();
    }

    @Test
    void 좌표_범위를_벗어나면_INVALID_PLACE_SEARCH_QUERY를_던진다() {
        assertThatThrownBy(() -> placeNearbyService.getNearbyPlaces(100.0, USER_LNG))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.INVALID_PLACE_SEARCH_QUERY);
    }

    @Test
    void 카카오_타임아웃이면_EXTERNAL_PLACE_API_UNAVAILABLE를_던진다() {
        given(kakaoLocalClient.searchCategory(eq("CE7"), anyDouble(), anyDouble(), anyInt(), anyInt(), anyString()))
                .willThrow(new ResourceAccessException("timeout"));

        assertThatThrownBy(() -> placeNearbyService.getNearbyPlaces(USER_LAT, USER_LNG))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.EXTERNAL_PLACE_API_UNAVAILABLE);
    }

    @Test
    void 카카오_오류_응답이면_EXTERNAL_PLACE_API_ERROR를_던진다() {
        given(kakaoLocalClient.searchCategory(eq("FD6"), anyDouble(), anyDouble(), anyInt(), anyInt(), anyString()))
                .willThrow(HttpClientErrorException.create(
                        org.springframework.http.HttpStatus.BAD_REQUEST, "Bad Request", null, null, null));

        assertThatThrownBy(() -> placeNearbyService.getNearbyPlaces(USER_LAT, USER_LNG))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.EXTERNAL_PLACE_API_ERROR);
    }

    @Test
    void distance가_없으면_사용자_좌표로_재계산한다() {
        // 장소 좌표를 사용자와 다르게 두고 distance=null → Haversine 재계산 경로.
        Document withoutDistance = new Document(
                "1", "카페A", "서울 강남구 역삼동 826", "서울 강남구 테헤란로 101",
                "CE7", "카페", "음식점 > 카페 > 커피전문점",
                "02-1234-5678", String.valueOf(USER_LNG), String.valueOf(USER_LAT + 0.0002), null);
        given(kakaoLocalClient.searchCategory(eq("CE7"), anyDouble(), anyDouble(), anyInt(), anyInt(), anyString()))
                .willReturn(new KakaoKeywordResponse(List.of(withoutDistance)));

        PlaceNearbyResponse response = placeNearbyService.getNearbyPlaces(USER_LAT, USER_LNG);

        // 위도 0.0002도 차이는 약 22m로 50m 이내 → 결과에 포함되고 거리가 0보다 크다.
        assertThat(response.places()).hasSize(1);
        assertThat(response.places().get(0).distanceMeters()).isGreaterThan(0);
    }

    @Test
    void 응답_항목에_카카오_필드가_그대로_매핑된다() {
        given(kakaoLocalClient.searchCategory(eq("CE7"), anyDouble(), anyDouble(), anyInt(), anyInt(), anyString()))
                .willReturn(new KakaoKeywordResponse(List.of(
                        document("1", "바나프레소 테헤란로점", "CE7", "42"))));

        PlaceNearbyItem item = placeNearbyService.getNearbyPlaces(USER_LAT, USER_LNG).places().get(0);

        assertThat(item.kakaoPlaceId()).isEqualTo("1");
        assertThat(item.placeName()).isEqualTo("바나프레소 테헤란로점");
        assertThat(item.categoryGroupCode()).isEqualTo("CE7");
        assertThat(item.categoryGroupName()).isEqualTo("카페");
        assertThat(item.categoryName()).isEqualTo("음식점 > 카페 > 커피전문점");
        assertThat(item.phone()).isEqualTo("02-1234-5678");
        // addressName은 지번 주소(address_name)를 반환한다.
        assertThat(item.addressName()).isEqualTo("서울 강남구 역삼동 826");
        assertThat(item.distanceMeters()).isEqualTo(42);
    }
}
