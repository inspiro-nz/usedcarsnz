/**
 * Minimal in-memory double for the subset of the supabase-js query builder
 * used by lib/ai/trigger.ts and lib/ai/generate-draft.ts. Not a general
 * mock — just enough chain surface (from/select/eq/order/insert/update/
 * single/maybeSingle) plus the log_lead_event RPC, so the red-team suite can
 * drive the real orchestration code without a live database.
 */

type Row = Record<string, unknown>;
type Table = Row[];

export interface FakeDb {
  enquiries: Table;
  listings: Table;
  dealers: Table;
  messages: Table;
  ai_drafts: Table;
}

export interface RpcCall {
  fn: string;
  args: Record<string, unknown>;
}

export function createFakeDb(seed: Partial<FakeDb>): { db: FakeDb; rpcCalls: RpcCall[]; client: unknown } {
  const db: FakeDb = {
    enquiries: [],
    listings: [],
    dealers: [],
    messages: [],
    ai_drafts: [],
    ...seed,
  } as FakeDb;
  const rpcCalls: RpcCall[] = [];

  function table(name: keyof FakeDb): Table {
    if (!db[name]) db[name] = [];
    return db[name];
  }

  class Builder {
    private rows: Row[];
    private inserted: Row[] = [];
    private mode: "select" | "insert" | "update" = "select";
    private updatePatch: Row | null = null;

    constructor(private name: keyof FakeDb) {
      this.rows = table(name);
    }

    select() {
      return this;
    }

    eq(col: string, val: unknown) {
      this.rows = this.rows.filter((r) => r[col] === val);
      return this;
    }

    order(col: string, opts?: { ascending?: boolean }) {
      const dir = opts?.ascending === false ? -1 : 1;
      this.rows = [...this.rows].sort((a, b) => (a[col] as string > (b[col] as string) ? dir : -dir));
      return this;
    }

    insert(patch: Row) {
      this.mode = "insert";
      const row: Row = { id: `id-${table(this.name).length + 1}-${Math.random().toString(36).slice(2, 8)}`, created_at: new Date().toISOString(), ...patch };
      table(this.name).push(row);
      this.inserted = [row];
      this.rows = this.inserted;
      return this;
    }

    update(patch: Row) {
      this.mode = "update";
      this.updatePatch = patch;
      return this;
    }

    single<T = Row>() {
      return this._resolve<T>(true);
    }

    maybeSingle<T = Row>() {
      return this._resolve<T>(true);
    }

    private applyUpdateIfPending() {
      if (this.mode === "update" && this.updatePatch) {
        for (const row of this.rows) Object.assign(row, this.updatePatch);
      }
    }

    private _resolve<T>(single: boolean) {
      this.applyUpdateIfPending();
      const data = single ? (this.rows[0] as T | undefined) ?? null : (this.rows as unknown as T);
      return Promise.resolve({ data, error: null });
    }

    // Makes `await builder` work when no terminal method is chained
    // (matches supabase-js's PromiseLike query builders).
    then<TResult1 = { data: unknown; error: null }, TResult2 = never>(
      onfulfilled?: ((value: { data: unknown; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ): PromiseLike<TResult1 | TResult2> {
      this.applyUpdateIfPending();
      const data = this.mode === "insert" ? this.inserted : this.rows;
      return Promise.resolve({ data, error: null }).then(onfulfilled, onrejected);
    }
  }

  const client = {
    from(name: keyof FakeDb) {
      return new Builder(name);
    },
    rpc(fn: string, args: Record<string, unknown>) {
      rpcCalls.push({ fn, args });
      if (fn === "log_lead_event") {
        return Promise.resolve({ data: `event-${rpcCalls.length}`, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    },
  };

  return { db, rpcCalls, client };
}
