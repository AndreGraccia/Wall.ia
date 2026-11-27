package com.github.yildizmy.service.future;

import java.util.regex.Pattern;

/**
 * What a counterparty name says about an everyday purchase: essential (food shopping, health, getting around),
 * leisure, or nothing. The one list of names, shared by the month plan, "Entradas e saídas" and the Radar.
 * <p>
 * ponytail: keywords on the name, because movements carry no category. It misses shops with neutral names (they stay
 * unclassified, never leisure by default) and can be fooled by a name that merely contains a word. Upgrade: the
 * Open Finance category or card MCC, plus a correction by the person.
 */
public final class SpendingNames {

    public enum Group { ESSENTIAL, LEISURE, UNCLASSIFIED }

    // Checked first: "Restaurante do Mercado" and "Uber Eats" are leisure, not food shopping or transport.
    // Streaming is left out on purpose: the Radar must keep reporting a subscription whose price went up.
    private static final Pattern LEISURE = Pattern.compile(
            "restaurante|lanchonete|pizzaria|hamburgueria|sorveteria|cafeteria|ifood|rappi|uber ?eats"
                    + "|cinema|ingresso|\\bbar\\b|boteco|choperia");

    private static final Pattern ESSENTIAL = Pattern.compile(
            // Mercado Pago and Mercado Livre are a payment firm and a marketplace, not food shopping.
            "mercado(?! ?(pago|livre))|atacad|hortifruti|sacolao|padaria|acougue|\\bfeira\\b"
                    + "|farmacia|drogaria|drogasil|droga raia|\\bsaude\\b|hospital|clinica|laboratorio|odonto"
                    + "|\\bposto\\b|combustivel|gasolina|\\buber\\b|\\b99 ?(app|pop|taxi)|\\btaxi\\b|\\bmetro\\b|onibus"
                    + "|\\btransporte\\b|bilhete unico|estacionamento|pedagio");

    private SpendingNames() {
    }

    public static Group of(String counterparty) {
        String name = RecurrenceDetector.normalize(counterparty);
        if (LEISURE.matcher(name).find()) return Group.LEISURE;
        if (ESSENTIAL.matcher(name).find()) return Group.ESSENTIAL;
        return Group.UNCLASSIFIED;
    }
}
