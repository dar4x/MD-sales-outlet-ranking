export function assertTestDatabase(database = process.env.POSTGRES_DB): void {
  if (database !== 'sales_ranking_test') {
    throw new Error(
      'Tests require sales_ranking_test; refusing another database.',
    );
  }
}
