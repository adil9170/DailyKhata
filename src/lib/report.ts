import { computeReport, type MoneyIn } from './calc';

/** Loads the company's ledger up to `to` and runs the financial engine. Always scoped by company id. */
export async function loadReport(db: D1Database, companyId: number, from: string, to: string, detail = false) {
  const [products, purchases, counts, money, closings] = await db.batch([
    db.prepare(`SELECT id, name, unit, pieces_per_unit, default_unit_cost_paise, sale_price_paise FROM products WHERE company_id = ? ORDER BY name`).bind(companyId),
    db.prepare(`SELECT entry_date AS d, product_id, SUM(pieces) AS pieces, SUM(total_cost_paise) AS cost, SUM(qty_units) AS units
                FROM purchases WHERE company_id = ? AND entry_date <= ? GROUP BY entry_date, product_id`).bind(companyId, to),
    db.prepare(`SELECT entry_date AS d, product_id, closing_pieces AS closing FROM stock_counts WHERE company_id = ? AND entry_date <= ?`).bind(companyId, to),
    db.prepare(`SELECT entry_date AS d, 'purchase' AS kind, payment_mode AS mode, SUM(total_cost_paise) AS amount FROM purchases WHERE company_id = ?1 AND entry_date <= ?2 GROUP BY 1, 3
                UNION ALL SELECT entry_date, 'expense', payment_mode, SUM(amount_paise) FROM expenses WHERE company_id = ?1 AND entry_date <= ?2 GROUP BY 1, 3
                UNION ALL SELECT entry_date, 'collection', mode, SUM(amount_paise) FROM collections WHERE company_id = ?1 AND entry_date <= ?2 GROUP BY 1, 3
                UNION ALL SELECT entry_date, direction, mode, SUM(amount_paise) FROM payments WHERE company_id = ?1 AND entry_date <= ?2 GROUP BY 1, 2, 3`).bind(companyId, to),
    db.prepare(`SELECT entry_date AS d, opening_cash_paise AS opening, counted_cash_paise AS counted FROM day_closings WHERE company_id = ? AND entry_date <= ?`).bind(companyId, to),
  ]);
  return computeReport({
    from, to, detail,
    products: products.results as never,
    purchases: purchases.results as never,
    counts: counts.results as never,
    money: money.results as unknown as MoneyIn[],
    closings: closings.results as never,
  });
}
