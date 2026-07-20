/**
 * lead_events is APPEND-ONLY AND IMMUTABLE — "enforced at the DB, not by
 * policy" (strategy §7/§9.2). Every test here asserts what the database
 * REFUSES: UPDATE / DELETE / TRUNCATE must be rejected for every role,
 * including the service_role backend and the database owner itself.
 *
 * Enforcement is two-layer (migrations 06 + 07):
 *   - prevent_mutation() triggers raise check_violation (23514) for ALL roles
 *     (triggers are not bypassed by BYPASSRLS, and supabase's postgres role is
 *     not a superuser).
 *   - UPDATE/DELETE/TRUNCATE privileges are additionally REVOKED from
 *     service_role (42501 before the trigger even fires).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client as PgClient } from "pg";
import { isLocal, DB_URL, fixtures, type Fixtures } from "./helpers";

describe.skipIf(!isLocal)("lead_events immutability (SQL boundary)", () => {
  let fx: Fixtures;
  let pg: PgClient;
  let eventId: string;

  beforeAll(async () => {
    fx = await fixtures();
    pg = new PgClient({ connectionString: DB_URL });
    await pg.connect();
    // The fixture enquiry's auto-logged enquiry_received event is our victim row.
    const { data, error } = await fx.svc
      .from("lead_events")
      .select("id")
      .eq("lead_id", fx.a.enquiryId)
      .limit(1);
    if (error || !data?.length) throw new Error(`no lead_events for fixture enquiry: ${error?.message}`);
    eventId = data[0].id as string;
  });

  afterAll(async () => {
    await pg?.end();
  });

  async function expectSqlRejection(sql: string, codes: string[]): Promise<void> {
    // Each statement runs in its own transaction so a rejection can't poison
    // later queries on the shared connection.
    let code = "";
    let message = "";
    try {
      await pg.query("begin");
      await pg.query(sql);
      await pg.query("rollback"); // unreachable when the statement throws
    } catch (err) {
      const e = err as { code?: string; message?: string };
      code = e.code ?? "";
      message = e.message ?? "";
      await pg.query("rollback");
    }
    expect(codes, `expected rejection for: ${sql} — got code=${code} msg=${message}`).toContain(code);
  }

  it("all three immutability triggers exist on lead_events", async () => {
    const { rows } = await pg.query(
      `select tgname from pg_trigger
       where tgrelid = 'public.lead_events'::regclass
         and tgname in ('lead_events_no_update','lead_events_no_delete','lead_events_no_truncate')`,
    );
    expect(rows.map((r) => r.tgname).sort()).toEqual([
      "lead_events_no_delete",
      "lead_events_no_truncate",
      "lead_events_no_update",
    ]);
  });

  it("UPDATE is rejected even for the database owner (trigger, 23514)", async () => {
    await expectSqlRejection(
      `update public.lead_events set payload = '{}'::jsonb where id = '${eventId}'`,
      ["23514"],
    );
  });

  it("DELETE is rejected even for the database owner (trigger, 23514)", async () => {
    await expectSqlRejection(`delete from public.lead_events where id = '${eventId}'`, ["23514"]);
  });

  it("TRUNCATE is rejected even for the database owner (trigger, 23514)", async () => {
    await expectSqlRejection(`truncate table public.lead_events`, ["23514"]);
  });

  it("service_role lacks even the PRIVILEGE to UPDATE/DELETE/TRUNCATE (42501)", async () => {
    // Privileges were revoked in migration 07 — the request dies before the
    // trigger. SET ROLE inside a transaction, so the rejection also resets it.
    await expectSqlRejection(
      `set local role service_role;
       update public.lead_events set payload = '{}'::jsonb where id = '${eventId}'`,
      ["42501"],
    );
    await expectSqlRejection(
      `set local role service_role;
       delete from public.lead_events where id = '${eventId}'`,
      ["42501"],
    );
    await expectSqlRejection(`set local role service_role; truncate table public.lead_events`, ["42501"]);
  });

  it("service_role via PostgREST cannot UPDATE or DELETE either", async () => {
    const upd = await fx.svc.from("lead_events").update({ payload: {} }).eq("id", eventId);
    expect(upd.error, "service-role UPDATE must be rejected").not.toBeNull();
    const del = await fx.svc.from("lead_events").delete().eq("id", eventId);
    expect(del.error, "service-role DELETE must be rejected").not.toBeNull();

    const still = await fx.svc.from("lead_events").select("id").eq("id", eventId).single();
    expect(still.error).toBeNull();
  });

  it("authenticated clients cannot INSERT events directly (append path is locked)", async () => {
    const ins = await fx.a.client.from("lead_events").insert({
      lead_id: fx.a.enquiryId,
      event_type: "ack_sent",
      actor: "ai",
    });
    expect(ins.error, "client INSERT into lead_events must be rejected").not.toBeNull();
  });

  it("anon cannot call log_lead_event (EXECUTE is service_role-only)", async () => {
    const { error } = await fx.anon.rpc("log_lead_event", {
      p_lead_id: fx.a.enquiryId,
      p_event_type: "ack_sent",
      p_actor: "ai",
    });
    expect(error, "anon log_lead_event must be rejected").not.toBeNull();
  });
});
