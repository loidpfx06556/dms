package com.dms.api.gateway.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.gateway.route.RouteLocator;
import org.springframework.cloud.gateway.route.builder.RouteLocatorBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.reactive.CorsWebFilter;
import org.springframework.web.cors.reactive.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;

@Configuration
public class ApiGatewayConfiguration {
    @Value("${app.frontend.url}")
    private String frontendUrl;

    @Bean
    public RouteLocator gatewayRouter(RouteLocatorBuilder builder) {
        return builder.routes()
                // OAuth2 specific routes
                .route(r -> r.path("/login/oauth2/code/google")
                        .uri("lb://auth-service"))
                .route(r -> r.path("/oauth2/authorization/google")
                        .uri("lb://auth-service"))
                // Service routes
                .route(r -> r.path("/auth/**")
                        .filters(f -> f.rewritePath("/auth/(?<segment>.*)", "/${segment}"))
                        .uri("lb://auth-service"))
                .route(r -> r.path("/document-interaction/**")
                        .filters(f -> f.rewritePath("/document-interaction/(?<segment>.*)", "/${segment}"))
                        .uri("lb://document-interaction-service"))
                .route(r -> r.path("/document-search/**")
                        .filters(f -> f.rewritePath("/document-search/(?<segment>.*)", "/${segment}"))
                        .uri("lb://document-search-service"))
                .build();
    }

    @Bean
    public CorsWebFilter corsWebFilter() {
        CorsConfiguration corsConfig = new CorsConfiguration();
        corsConfig.setAllowedOrigins(List.of(frontendUrl));
        corsConfig.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        corsConfig.setAllowedHeaders(List.of("*"));
        corsConfig.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", corsConfig);

        return new CorsWebFilter(source);
    }
}