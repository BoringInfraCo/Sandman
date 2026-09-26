export interface BudgetLimits {
  maxItems: number;
  maxItemChars: number;
}

export interface BudgetReport {
  limits: BudgetLimits;
  omittedItems: number;
  truncatedItems: number;
  withinBudget: boolean;
}

const DEFAULT_LIMITS: BudgetLimits = {
  maxItems: 50,
  maxItemChars: 500,
};

export function budgetArray<T>(
  items: T[],
  limits: BudgetLimits = DEFAULT_LIMITS,
  stringify: (item: T) => string = (item) => JSON.stringify(item),
): { items: T[]; budget: BudgetReport } {
  const result: T[] = [];
  let omittedItems = 0;
  let truncatedItems = 0;

  for (let i = 0; i < items.length; i++) {
    if (result.length >= limits.maxItems) {
      omittedItems = items.length - limits.maxItems;
      break;
    }
    const item = items[i];
    const text = stringify(item);
    if (text.length > limits.maxItemChars) {
      truncatedItems += 1;
    }
    result.push(item);
  }

  return {
    items: result,
    budget: {
      limits,
      omittedItems,
      truncatedItems,
      withinBudget: omittedItems === 0 && truncatedItems === 0,
    },
  };
}

export function budgetRecord(
  record: Record<string, unknown>,
  limits: BudgetLimits = DEFAULT_LIMITS,
): { record: Record<string, unknown>; budget: BudgetReport } {
  const entries = Object.entries(record);
  const { items, budget } = budgetArray(entries, limits, ([, value]) =>
    JSON.stringify(value),
  );
  return {
    record: Object.fromEntries(items),
    budget,
  };
}
