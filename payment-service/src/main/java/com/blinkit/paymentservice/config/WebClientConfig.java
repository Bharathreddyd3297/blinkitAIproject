package com.blinkit.paymentservice.config;

import io.netty.channel.ChannelOption;
import io.netty.handler.timeout.ReadTimeoutHandler;
import io.netty.handler.timeout.WriteTimeoutHandler;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.web.reactive.function.client.ExchangeFilterFunction;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.netty.http.client.HttpClient;

import java.util.concurrent.TimeUnit;

/**
 * WebClient beans for downstream microservice calls.
 *
 * <p>payment-service fans out to one upstream service during a payment lifecycle:
 * <ul>
 *   <li>{@code order-service} — fetch order details before creating a payment, and
 *       update the order status (PAID/FAILED) after payment processing.</li>
 * </ul>
 *
 * <p>The WebClient is bound to its base URL via the {@code ORDER_SERVICE_BASE_URL}
 * env var so the service is portable across local/Docker/AKS deployments.
 * Timeouts are configurable to prevent thread exhaustion when an upstream is slow.
 */
@Slf4j
@Configuration
public class WebClientConfig {

    @Value("${app.order-service.base-url}")
    private String orderServiceBaseUrl;

    @Value("${app.webclient.connect-timeout-ms:5000}")
    private int connectTimeoutMs;

    @Value("${app.webclient.read-timeout-ms:5000}")
    private int readTimeoutMs;

    @Value("${app.webclient.write-timeout-ms:5000}")
    private int writeTimeoutMs;

    @Bean(name = "orderServiceWebClient")
    public WebClient orderServiceWebClient(WebClient.Builder builder) {
        return buildWebClient(builder, orderServiceBaseUrl);
    }

    private WebClient buildWebClient(WebClient.Builder builder, String baseUrl) {
        HttpClient httpClient = HttpClient.create()
                .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, connectTimeoutMs)
                .doOnConnected(conn -> conn
                        .addHandlerLast(new ReadTimeoutHandler(readTimeoutMs, TimeUnit.MILLISECONDS))
                        .addHandlerLast(new WriteTimeoutHandler(writeTimeoutMs, TimeUnit.MILLISECONDS)));

        return builder
                .baseUrl(baseUrl)
                .clientConnector(new ReactorClientHttpConnector(httpClient))
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .defaultHeader(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE)
                .filter(logRequest())
                .filter(logResponse())
                .build();
    }

    private ExchangeFilterFunction logRequest() {
        return ExchangeFilterFunction.ofRequestProcessor(req -> {
            log.debug("WebClient request: {} {}", req.method(), req.url());
            return reactor.core.publisher.Mono.just(req);
        });
    }

    private ExchangeFilterFunction logResponse() {
        return ExchangeFilterFunction.ofResponseProcessor(res -> {
            log.debug("WebClient response status: {}", res.statusCode());
            return reactor.core.publisher.Mono.just(res);
        });
    }
}
