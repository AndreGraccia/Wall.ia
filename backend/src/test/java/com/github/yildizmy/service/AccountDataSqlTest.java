package com.github.yildizmy.service;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

/**
 * The export and the account deletion are hand-written SQL, and the unit tests mock JdbcTemplate. This runs every one
 * of those statements against the real schema, with data in the month plan and profile tables (ADR 0021), so a typo
 * or a forgotten child table shows up here and not on the day someone asks for their data.
 */
@EnabledIfEnvironmentVariable(named = "WALLIA_IT_DB_URL", matches = ".+")
class AccountDataSqlTest {

    private static final String URL = System.getenv("WALLIA_IT_DB_URL");
    private static final String USER = System.getenv().getOrDefault("WALLIA_IT_DB_USER", "postgres");
    private static final String PASSWORD = System.getenv().getOrDefault("WALLIA_IT_DB_PASSWORD", "postgres");
    private static final long ID = 9300;

    @BeforeAll
    static void migrate() {
        Flyway.configure().dataSource(URL, USER, PASSWORD).load().migrate();
    }

    @Test
    void theMonthPlanAndProfileRulesHoldInTheDatabase() throws SQLException {
        person(9301);
        execute("INSERT INTO month_plan (id, user_id, active, updated_at) VALUES (9301, 9301, false, now())");
        execute("INSERT INTO month_plan_slice VALUES (9301, 0, 'FIXED', 'Fixo', 35.00, false)");
        assertThrows(SQLException.class, () -> execute(
                "INSERT INTO month_plan_slice VALUES (9301, 1, 'LEISURE', 'Lazer', 20.00, true)"), "leisure is measured");
        assertThrows(SQLException.class, () -> execute(
                "INSERT INTO month_plan_slice VALUES (9301, 1, 'CUSTOM', 'X', 100.01, false)"));
        assertThrows(SQLException.class, () -> execute(
                "INSERT INTO month_plan_slice VALUES (9301, 12, 'CUSTOM', 'X', 1, false)"), "twelve slices at most");
        assertThrows(SQLException.class, () -> execute(
                "INSERT INTO month_plan_slice VALUES (9301, 1, 'SALARY', 'X', 1, false)"));
        assertThrows(SQLException.class, () -> execute(
                "INSERT INTO month_plan (user_id, active, updated_at) VALUES (9301, false, now())"), "one plan per person");
        execute("INSERT INTO financial_profile (user_id, preference, main_goal, updated_at) VALUES (9301, 'SIMPLE', 'LEAVE_DEBT', now())");
        assertThrows(SQLException.class, () -> execute(
                "INSERT INTO financial_profile (user_id, preference, main_goal, updated_at) VALUES (9301, 'SIMPLE', 'X', now())"));
        assertThrows(SQLException.class, () -> execute(
                "INSERT INTO method_choice (user_id, method, catalog_version, chosen_at) VALUES (9301, 'BUY_STOCKS', 'v', now())"));
    }

    @Test
    void theGoalTargetRulesHoldInTheDatabase() throws SQLException {
        person(9302);
        execute("DELETE FROM goal WHERE user_id = 9302");
        String insert = "INSERT INTO goal (user_id, name, monthly_amount, day_of_month, created_at, target_amount, "
                + "target_date, saved_amount) VALUES (9302, 'Viagem', 100, 10, now(), ";
        execute(insert + "NULL, NULL, NULL)");
        execute(insert + "3000, '2027-12-10', 0)");
        assertThrows(SQLException.class, () -> execute(insert + "0, NULL, NULL)"));
        assertThrows(SQLException.class, () -> execute(insert + "3000, NULL, -1)"));
        assertThrows(SQLException.class, () -> execute(insert + "NULL, '2027-12-10', NULL)"), "a date needs a target");
    }

    @Test
    void everyExportQueryRunsAndEveryDeletionStatementCleansTheNewTables() throws SQLException {
        person(ID);
        execute("INSERT INTO month_plan (id, user_id, active, activated_at, updated_at) VALUES (" + ID + ", " + ID + ", true, now(), now())");
        execute("INSERT INTO month_plan_slice VALUES (" + ID + ", 0, 'FIXED', 'Fixo', 50.00, false)");
        execute("INSERT INTO month_plan_slice VALUES (" + ID + ", 1, 'EMERGENCY', 'Reserva', 50.00, true)");
        execute("INSERT INTO financial_profile (user_id, preference, main_goal, updated_at) VALUES (" + ID + ", 'DETAILED', 'BUILD_RESERVE', now())");
        execute("INSERT INTO method_choice (user_id, method, catalog_version, chosen_at) VALUES (" + ID + ", 'ENVELOPES', '2026-11-23', now())");

        execute("INSERT INTO investment (id, user_id, institution, name, asset_class, created_at) VALUES (" + ID + ", " + ID
                + ", 'Corretora', 'Reserva', 'FUND', now())");
        execute("INSERT INTO investment_value VALUES (" + ID + ", current_date, 10.00)");
        assertThrows(SQLException.class, () -> execute(
                "INSERT INTO investment_value VALUES (" + ID + ", current_date, 11.00)"), "one value per date");
        assertThrows(SQLException.class, () -> execute(
                "INSERT INTO investment_value VALUES (" + ID + ", current_date - 1, -1)"));

        execute("INSERT INTO goal (id, user_id, name, monthly_amount, day_of_month, created_at) OVERRIDING SYSTEM VALUE VALUES ("
                + ID + ", " + ID + ", 'Curso', 10, 5, now())");
        execute("INSERT INTO life_goal (id, user_id, title, current_situation, desired_situation, goal_id, created_at) VALUES ("
                + ID + ", " + ID + ", 't', 'a', 'b', " + ID + ", now())");
        execute("INSERT INTO life_goal_step (life_goal_id, position, description) VALUES (" + ID + ", 0, 'passo')");
        execute("DELETE FROM goal WHERE id = " + ID);
        assertEquals("1", scalar("SELECT count(*)::text FROM life_goal WHERE id = " + ID + " AND goal_id IS NULL"),
                "deleting the goal only drops the link");

        for (AccountExportService.Section section : AccountExportService.SECTIONS) {
            try (Connection connection = connection(); PreparedStatement statement = connection.prepareStatement(section.sql())) {
                for (int i = 1; i <= section.idParams(); i++) statement.setLong(i, ID);
                statement.executeQuery().close();
            }
        }
        assertEquals("2", scalar("SELECT count(*)::text FROM month_plan_slice s JOIN month_plan p ON p.id = s.month_plan_id "
                + "WHERE p.user_id = " + ID));

        for (String sql : AccountDeletionService.OWN_ROWS) {
            try (Connection connection = connection(); PreparedStatement statement = connection.prepareStatement(sql)) {
                statement.setLong(1, ID);
                statement.executeUpdate();
            }
        }
        assertEquals("0", scalar("SELECT count(*)::text FROM month_plan_slice WHERE month_plan_id = " + ID));
        assertEquals("0", scalar("SELECT (SELECT count(*) FROM investment WHERE user_id = " + ID + ") + "
                + "(SELECT count(*) FROM investment_value WHERE investment_id = " + ID + ")"));
        assertEquals("0", scalar("SELECT (SELECT count(*) FROM life_goal WHERE user_id = " + ID + ") + "
                + "(SELECT count(*) FROM life_goal_step WHERE life_goal_id = " + ID + ")"));
        assertEquals("0", scalar("SELECT (SELECT count(*) FROM month_plan WHERE user_id = " + ID + ") + "
                + "(SELECT count(*) FROM financial_profile WHERE user_id = " + ID + ") + "
                + "(SELECT count(*) FROM method_choice WHERE user_id = " + ID + ")"));
    }

    private static void person(long id) throws SQLException {
        execute("INSERT INTO \"user\" (id, first_name, last_name, username, email, password) VALUES (" + id
                + ", 'Ana', 'Plano', 'ana_plano_" + id + "', 'ana" + id + "@plano.test', 'x') ON CONFLICT DO NOTHING");
        // The database outlives a run unless FlywayMigrationsTest cleaned it first: start from nothing either way.
        for (String table : new String[]{"month_plan", "financial_profile", "method_choice", "investment", "life_goal", "goal"}) {
            execute("DELETE FROM " + table + " WHERE user_id = " + id);
        }
    }

    private static Connection connection() throws SQLException {
        return DriverManager.getConnection(URL, USER, PASSWORD);
    }

    private static String scalar(String sql) throws SQLException {
        try (Connection connection = connection(); Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery(sql)) {
            result.next();
            return result.getString(1);
        }
    }

    private static void execute(String sql) throws SQLException {
        try (Connection connection = connection(); Statement statement = connection.createStatement()) {
            statement.execute(sql);
        }
    }
}
