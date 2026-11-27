/** The name of a cash-flow category: the cash-flow wording first, then the one Futuro uses. */
export const categoryLabel = (key, t) =>
  t(`cashFlow.categories.${key}`, { defaultValue: t(`future.categories.${key}`, { defaultValue: key }) });
