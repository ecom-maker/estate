export type NormalizedTransaction = {
  externalId: string;
  source: string;
  propertyExternalId?: string;
  kind: "sale" | "rental" | "offplan";
  date: string;
  amountAED: number;
  meta?: Record<string, unknown>;
};

const FIXTURE: NormalizedTransaction[] = [
  {
    externalId: "txn-sale-1",
    source: "txn-mock",
    propertyExternalId: "crm-villa-001",
    kind: "sale",
    date: "2024-06-12",
    amountAED: 27000000,
  },
  {
    externalId: "txn-rent-1",
    source: "txn-mock",
    propertyExternalId: "crm-apt-002",
    kind: "rental",
    date: "2025-01-08",
    amountAED: 520000,
  },
];

export class MockTransactionAdapter {
  name = "Mock Transactions";
  type = "TRANSACTION" as const;

  async fetchPage(page: number) {
    return page === 1 ? FIXTURE : [];
  }

  normalize(raw: NormalizedTransaction) {
    return raw;
  }
}
