package com.github.yildizmy.config;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class DatabaseUrlTest {

    @Test
    void theHostsUrlBecomesTheThreeDatasourceProperties() {
        Map<String, String> found = DatabaseUrl.properties(Map.of("DATABASE_URL",
                "postgresql://wallia:p%40ss+word@dpg-abc-a/wallia"));

        assertEquals("jdbc:postgresql://dpg-abc-a/wallia", found.get("spring.datasource.url"));
        assertEquals("wallia", found.get("spring.datasource.username"));
        assertEquals("p@ss+word", found.get("spring.datasource.password"));
    }

    @Test
    void thePortAndTheTlsParameterAreKept() {
        Map<String, String> found = DatabaseUrl.properties(Map.of("DATABASE_URL",
                "postgres://u:s@ep-x.aws.neon.tech:5433/neondb?sslmode=require"));

        assertEquals("jdbc:postgresql://ep-x.aws.neon.tech:5433/neondb?sslmode=require",
                found.get("spring.datasource.url"));
    }

    @Test
    void anExplicitJdbcUrlWinsAndNothingHappensWithoutTheVariable() {
        assertTrue(DatabaseUrl.properties(Map.of()).isEmpty());
        assertTrue(DatabaseUrl.properties(Map.of("DATABASE_URL", "postgres://u:s@h/d",
                "SPRING_DATASOURCE_URL", "jdbc:postgresql://other/d")).isEmpty());
    }

    @Test
    void aBadValueFailsWithoutPrintingIt() {
        var error = assertThrows(IllegalStateException.class,
                () -> DatabaseUrl.properties(Map.of("DATABASE_URL", "mysql://user:topsecret@h/d")));

        assertFalse(error.getMessage().contains("topsecret"));
    }
}
