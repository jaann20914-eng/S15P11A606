package com.yuhan.wagglewaggle.domain.auth.client;

import com.yuhan.wagglewaggle.domain.auth.entity.OAuthProvider;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * provider에 맞는 OAuthClient를 찾아준다.
 */
@Component
public class OAuthClientResolver {

    private final Map<OAuthProvider, OAuthClient> clients;

    public OAuthClientResolver(List<OAuthClient> oAuthClients) {
        this.clients = oAuthClients.stream()
                .collect(Collectors.toMap(OAuthClient::provider, Function.identity()));
    }

    public OAuthClient resolve(OAuthProvider provider) {
        OAuthClient client = clients.get(provider);
        if (client == null) {
            throw new CustomException(ErrorCode.AUTH_PROVIDER_INVALID);
        }
        return client;
    }
}
