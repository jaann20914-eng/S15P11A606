package com.yuhan.wagglewaggle.domain.pin.tag.dto;

import java.util.List;

public record TagSearchResponse(
        List<TagSearchResult> tags
) {
}
