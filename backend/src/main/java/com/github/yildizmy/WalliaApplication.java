package com.github.yildizmy;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.core.env.Environment;
import java.net.InetAddress;
import java.net.UnknownHostException;

@Slf4j
@SpringBootApplication
public class WalliaApplication {

	public static void main(String[] args) {
		// A generic DEBUG environment variable is commonly set by development tools.
		// Do not let it enable Spring's verbose request and SQL-adjacent diagnostics.
		System.setProperty("debug", System.getProperty("debug", "false"));
		// Render and Neon give one postgres:// value; system properties override application.yml.
		com.github.yildizmy.config.DatabaseUrl.properties(System.getenv()).forEach(System::setProperty);
		SpringApplication app = new SpringApplication(WalliaApplication.class);
		Environment env = app.run(args).getEnvironment();
		logApplicationStartup(env);
	}

	private static void logApplicationStartup(Environment env) {
		String protocol = (env.getProperty("server.ssl.key-store") != null) ? "https" : "http";
		String serverPort = env.getProperty("server.port");
		String contextPath = env.getProperty("server.servlet.context-path", "/");
		String hostAddress = "localhost";
		try {
			hostAddress = InetAddress.getLocalHost().getHostAddress();
		} catch (UnknownHostException e) {
			log.warn("The host name could not be determined, using `localhost` as fallback");
		}
		log.info("\n" +
				"-------------------------------------------------------\n" +
				"Application '" + env.getProperty("spring.application.name") + "' is running! Access URLs:\n" +
				"Local:      " + protocol + "://localhost:" + serverPort + contextPath + "\n" +
				"External:   " + protocol + "://" + hostAddress + ":" + serverPort + contextPath + "\n" +
				"Profile(s): " + String.join(",", env.getActiveProfiles()) + "\n" +
				"-------------------------------------------------------");
	}
}
