package com.github.yildizmy.service.future;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * "Meu método" (ADR 0021): the budgeting methods the Wall.ia can run, as static content versioned with the code.
 * The Wall.ia does not impose a method; it shows explainable alternatives and the tool that runs each one. Nothing
 * here is investment advice: a method organises the person's own money, it never names a product.
 */
public final class MethodCatalog {

    /** Changes whenever a text or a rule of the catalog changes, so a stored choice can be read against its version. */
    public static final String VERSION = "2026-11-23";

    private MethodCatalog() {
    }

    /**
     * @param dataNeeded codes: CONFIRMED_INCOME, CONFIRMED_FIXED_BILLS, BALANCE, GOALS, LOANS_WITH_RATE
     * @param where      the tool in the Wall.ia that runs the method and its API route
     * @param preset     for the percent methods, the slices to load into the month plan (nothing committed)
     */
    public record Method(String id, String name, String howItWorks, String helpsWhen, String limitations,
                         List<String> dataNeeded, Where where, List<MonthPlanCalculator.Slice> preset) {
    }

    public record Where(String tool, String route) {
    }

    private static final Where PLAN = new Where("MONTH_PLAN", "/api/v1/plan");

    public static final List<Method> METHODS = List.of(
            new Method("PERCENT_503020", "50/30/20",
                    "Divide a renda em três partes: 50% para necessidades, 30% para desejos e 20% para poupança e dívidas.",
                    "Quando a pessoa quer uma regra simples para começar e as contas fixas cabem em metade da renda.",
                    "Não funciona bem quando as contas fixas passam de 50% da renda; os percentuais são uma referência, não uma lei.",
                    List.of("CONFIRMED_INCOME", "CONFIRMED_FIXED_BILLS"), PLAN, MonthPlanCalculator.PRESET_503020),
            new Method("PERCENT_ANDRE", "Plano do André",
                    "Proposta de André Graccia: 35% fixo, 20% lazer, 15% investimento, 7,5% futuro, 10% desenvolvimento "
                            + "pessoal e estudo e 12,5% reserva de emergência.",
                    "Quando a pessoa quer separar, além das contas e do lazer, uma parte para estudo e outra para a reserva.",
                    "Seis fatias pedem renda que comporte todas; com contas fixas acima de 35% a fatia Fixo estoura.",
                    List.of("CONFIRMED_INCOME", "CONFIRMED_FIXED_BILLS"), PLAN, MonthPlanCalculator.PRESET_ANDRE),
            new Method("ZERO_BASED", "Orçamento base zero",
                    "Cada real da renda recebe um destino: as fatias do plano somam exatamente 100%.",
                    "Quando a pessoa quer controle detalhado e saber para onde vai cada parte da renda.",
                    "Dá trabalho manter; exige revisar o plano quando a renda ou as contas mudam.",
                    List.of("CONFIRMED_INCOME"), PLAN, List.of()),
            new Method("PAY_YOURSELF_FIRST", "Pague-se primeiro",
                    "No dia em que a renda entra, o valor das metas sai do saldo antes de qualquer gasto.",
                    "Quando a pessoa sempre deixa para guardar o que sobra e no fim do mês não sobra nada.",
                    "Só funciona se o valor das metas cabe: confira com \"ver se cabe\" antes de criar a meta.",
                    List.of("CONFIRMED_INCOME", "GOALS"), new Where("GOALS", "/api/v1/future/goals"), List.of()),
            new Method("PRIORITIES", "Orçamento por prioridades",
                    "Uma lista ordenada do que precisa ser pago primeiro; o que vem depois só recebe o que sobrar.",
                    "Quando as contas fixas pesam mais da metade da renda e percentuais fixos não fecham.",
                    "Não diz quanto guardar; serve para atravessar meses apertados, não para planejar o longo prazo.",
                    List.of("CONFIRMED_FIXED_BILLS", "BALANCE"), PLAN, List.of()),
            new Method("INCOME_CYCLE", "Limite até a próxima entrada",
                    "O limite diário do Futuro: quanto dá para gastar por dia até a próxima renda sem ficar negativo.",
                    "Quando a renda varia de mês para mês ou as contas fixas apertam: olha o caixa, não o percentual.",
                    "Depende das recorrências confirmadas; o que não foi confirmado não entra na conta.",
                    List.of("BALANCE", "CONFIRMED_INCOME", "CONFIRMED_FIXED_BILLS"),
                    new Where("FUTURE", "/api/v1/future/overview"), List.of()),
            new Method("ENVELOPES", "Envelopes",
                    "Parte do saldo de hoje fica separada para um fim (viagem, IPVA); o limite diário não toca nela.",
                    "Quando há um gasto grande previsto que a projeção não conhece.",
                    "Envelope não move dinheiro e não tem aporte mensal; é um piso sobre o saldo.",
                    List.of("BALANCE"), new Where("ENVELOPES", "/api/v1/future/envelopes"), List.of()),
            new Method("DEBT_AVALANCHE", "Quitação avalanche",
                    "Paga o mínimo de todas as dívidas e coloca o dinheiro extra na de maior juros primeiro.",
                    "Quando há duas ou mais dívidas com taxa: é a ordem que paga menos juros no total.",
                    "A primeira dívida pode demorar a sumir, o que desanima algumas pessoas.",
                    List.of("LOANS_WITH_RATE"), new Where("DEBT_PAYOFF", "/api/v1/future/debt-payoff"), List.of()),
            new Method("DEBT_SNOWBALL", "Quitação bola de neve",
                    "Paga o mínimo de todas as dívidas e coloca o dinheiro extra na de menor saldo primeiro.",
                    "Quando há duas ou mais dívidas e ver uma delas acabar ajuda a manter o plano.",
                    "Costuma pagar mais juros que a avalanche; o planejador mostra a diferença em reais.",
                    List.of("LOANS_WITH_RATE"), new Where("DEBT_PAYOFF", "/api/v1/future/debt-payoff"), List.of()));

    private static final Map<String, Method> BY_ID = METHODS.stream()
            .collect(Collectors.toMap(Method::id, Function.identity()));

    public static Optional<Method> find(String id) {
        return Optional.ofNullable(id == null ? null : BY_ID.get(id));
    }
}
