package com.github.yildizmy.config;

import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;

/**
 * Hosts such as Render and Neon hand out one {@code postgres://user:password@host/database} value, which JDBC does
 * not read. This turns {@code DATABASE_URL} into the three Spring datasource properties, so nobody has to take the
 * password apart by hand. An explicit {@code SPRING_DATASOURCE_URL} wins, and without {@code DATABASE_URL} nothing
 * changes.
 */
public final class DatabaseUrl {

    private DatabaseUrl() {
    }

    /** @return the datasource properties, or an empty map when the environment does not ask for this */
    public static Map<String, String> properties(Map<String, String> environment) {
        String raw = environment.get("DATABASE_URL");
        if (raw == null || raw.isBlank() || environment.containsKey("SPRING_DATASOURCE_URL")) return Map.of();
        // The messages never carry the value: it holds the password.
        URI uri;
        try {
            uri = URI.create(raw.trim());
        } catch (IllegalArgumentException invalid) {
            throw new IllegalStateException("DATABASE_URL is not a valid URL");
        }
        boolean postgres = "postgres".equals(uri.getScheme()) || "postgresql".equals(uri.getScheme());
        String credentials = uri.getRawUserInfo();
        int separator = credentials == null ? -1 : credentials.indexOf(':');
        if (!postgres || uri.getHost() == null || separator < 1 || uri.getPath() == null || uri.getPath().length() < 2) {
            throw new IllegalStateException("DATABASE_URL must look like postgres://user:password@host/database");
        }
        String port = uri.getPort() < 0 ? "" : ":" + uri.getPort();
        String query = uri.getRawQuery() == null ? "" : "?" + uri.getRawQuery();
        return Map.of(
                "spring.datasource.url", "jdbc:postgresql://" + uri.getHost() + port + uri.getRawPath() + query,
                "spring.datasource.username", decode(credentials.substring(0, separator)),
                "spring.datasource.password", decode(credentials.substring(separator + 1)));
    }

    private static String decode(String value) {
        // URLDecoder is for forms, where "+" is a space; in a URL's user info it is a plus.
        return URLDecoder.decode(value.replace("+", "%2B"), StandardCharsets.UTF_8);
    }
}
