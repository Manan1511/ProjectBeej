create table if not exists public.tracking_visitors (
  visitor_id uuid primary key,
  consent jsonb not null check (jsonb_typeof(consent) = 'object'),
  updated_at timestamptz not null default now()
);

create table if not exists public.tracking_checkout_contexts (
  context_id uuid primary key,
  visitor_id uuid not null references public.tracking_visitors(visitor_id) on delete cascade,
  consent jsonb not null,
  attribution jsonb,
  identifiers jsonb not null default '{}'::jsonb,
  client_ip inet,
  user_agent varchar(256),
  created_at timestamptz not null default now(),
  identifiers_expires_at timestamptz not null default (now() + interval '30 days'),
  ephemeral_expires_at timestamptz not null default (now() + interval '7 days'),
  expires_at timestamptz not null default (now() + interval '180 days')
);
create index if not exists tracking_context_visitor_created_idx on public.tracking_checkout_contexts(visitor_id, created_at desc);
create index if not exists tracking_context_expiry_idx on public.tracking_checkout_contexts(expires_at);

create table if not exists public.tracking_orders (
  order_gid text primary key,
  order_name varchar(80),
  context_id uuid references public.tracking_checkout_contexts(context_id) on delete set null,
  visitor_id uuid references public.tracking_visitors(visitor_id) on delete set null,
  consent jsonb not null,
  attribution jsonb,
  identifiers jsonb not null default '{}'::jsonb,
  transaction_id varchar(120) not null,
  currency varchar(3) not null check (currency ~ '^[A-Z]{3}$'),
  paid_at timestamptz not null,
  identifiers_expires_at timestamptz not null default (now() + interval '30 days'),
  attribution_expires_at timestamptz not null default (now() + interval '30 days'),
  test_order boolean not null default false,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '180 days')
);
create index if not exists tracking_orders_expiry_idx on public.tracking_orders(expires_at);

create table if not exists public.tracking_webhook_receipts (
  delivery_id uuid primary key,
  shop_domain text not null,
  topic text not null,
  order_gid text,
  received_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '180 days')
);

create table if not exists public.tracking_provider_outbox (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('ga4', 'meta')),
  event_name text not null,
  event_id text not null,
  order_gid text not null,
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'sending', 'delivered', 'manual', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  lease_token uuid,
  lease_until timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  payload_expires_at timestamptz not null default (now() + interval '7 days'),
  unique(provider, event_id)
);
create index if not exists tracking_outbox_claim_idx on public.tracking_provider_outbox(status, next_attempt_at, lease_until);
create index if not exists tracking_outbox_order_idx on public.tracking_provider_outbox(order_gid);

create table if not exists public.tracking_pending_refunds (
  refund_gid text primary key,
  order_gid text not null,
  status text not null default 'pending' check (status in ('pending', 'succeeded', 'failed', 'manual')),
  first_seen_at timestamptz not null default now(),
  last_checked_at timestamptz,
  next_attempt_at timestamptz not null default now(),
  attempts integer not null default 0,
  lease_token uuid,
  lease_until timestamptz,
  expires_at timestamptz not null default (now() + interval '180 days')
);
create index if not exists tracking_pending_refunds_status_idx on public.tracking_pending_refunds(status, last_checked_at);

create table if not exists public.tracking_rate_limits (
  bucket_key text primary key check (bucket_key ~ '^[a-f0-9]{64}$'),
  window_started_at timestamptz not null,
  attempts integer not null,
  expires_at timestamptz not null
);

create table if not exists public.tracking_checkout_events (
  event_id varchar(128) primary key,
  context_id uuid not null references public.tracking_checkout_contexts(context_id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days')
);

alter table public.tracking_visitors enable row level security;
alter table public.tracking_checkout_contexts enable row level security;
alter table public.tracking_orders enable row level security;
alter table public.tracking_webhook_receipts enable row level security;
alter table public.tracking_provider_outbox enable row level security;
alter table public.tracking_pending_refunds enable row level security;
alter table public.tracking_rate_limits enable row level security;
alter table public.tracking_checkout_events enable row level security;

revoke all on public.tracking_visitors, public.tracking_checkout_contexts, public.tracking_orders,
  public.tracking_webhook_receipts, public.tracking_provider_outbox, public.tracking_pending_refunds
  from public, anon, authenticated;
revoke all on public.tracking_rate_limits from public, anon, authenticated;
revoke all on public.tracking_checkout_events from public, anon, authenticated;
grant all on public.tracking_visitors, public.tracking_checkout_contexts, public.tracking_orders,
  public.tracking_webhook_receipts, public.tracking_provider_outbox, public.tracking_pending_refunds to service_role;
grant all on public.tracking_rate_limits to service_role;
grant all on public.tracking_checkout_events to service_role;

create or replace function public.tracking_record_checkout_event(p_context_id uuid, p_event_id text)
returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_count integer;
begin
  insert into public.tracking_checkout_events(event_id, context_id)
  values (left(p_event_id, 128), p_context_id)
  on conflict (event_id) do nothing;
  get diagnostics v_count = row_count;
  return v_count = 1;
end;
$$;

create or replace function public.tracking_create_context(
  p_visitor_id uuid,
  p_context_id uuid,
  p_consent jsonb,
  p_attribution jsonb,
  p_identifiers jsonb,
  p_client_ip inet,
  p_user_agent text
) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.tracking_visitors(visitor_id, consent, updated_at)
  values (p_visitor_id, p_consent, now())
  on conflict (visitor_id) do update set consent = excluded.consent, updated_at = now();

  insert into public.tracking_checkout_contexts(context_id, visitor_id, consent, attribution, identifiers, client_ip, user_agent)
  values (p_context_id, p_visitor_id, p_consent, p_attribution, p_identifiers, p_client_ip, left(p_user_agent, 256));

  update public.tracking_checkout_contexts set identifiers =
    (case when p_consent->>'analytics' = 'false' then identifiers - 'clientId' - 'sessionId' else identifiers end)
    - (case when p_consent->>'marketing' = 'false' then array['gclid','gbraid','wbraid','fbclid','fbp','fbc']::text[] else array[]::text[] end),
    attribution = case when p_consent->>'analytics' = 'false' and p_consent->>'marketing' = 'false' then null else attribution end,
    client_ip = case when p_consent->>'marketing' = 'false' then null else client_ip end,
    user_agent = case when p_consent->>'marketing' = 'false' then null else user_agent end
    where visitor_id = p_visitor_id;
  update public.tracking_orders set identifiers =
    (case when p_consent->>'analytics' = 'false' then identifiers - 'clientId' - 'sessionId' else identifiers end)
    - (case when p_consent->>'marketing' = 'false' then array['gclid','gbraid','wbraid','fbclid','fbp','fbc']::text[] else array[]::text[] end),
    attribution = case when p_consent->>'analytics' = 'false' and p_consent->>'marketing' = 'false' then null else attribution end
    where visitor_id = p_visitor_id;
  update public.tracking_provider_outbox set status = 'failed', payload = '{}'::jsonb, lease_token = null, lease_until = null,
    last_error_code = 'consent_withdrawn', updated_at = now()
    where status in ('pending','sending') and order_gid in (select order_gid from public.tracking_orders where visitor_id = p_visitor_id)
      and ((provider = 'ga4' and p_consent->>'analytics' = 'false') or (provider = 'meta' and p_consent->>'marketing' = 'false'));
end;
$$;

create or replace function public.tracking_reduce_consent(p_context_id uuid, p_consent jsonb)
returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_visitor_id uuid;
  v_current jsonb;
begin
  select visitor_id into v_visitor_id from public.tracking_checkout_contexts where context_id = p_context_id;
  if v_visitor_id is null then return false; end if;
  select consent into v_current from public.tracking_visitors where visitor_id = v_visitor_id for update;
  if v_current is null then return false; end if;
  if (p_consent->>'analytics') not in ('true', 'false')
    or (p_consent->>'marketing') not in ('true', 'false')
    or (p_consent->>'preferences') not in ('true', 'false') then return false; end if;
  if ((v_current->>'analytics') = 'false' and (p_consent->>'analytics') = 'true')
    or ((v_current->>'marketing') = 'false' and (p_consent->>'marketing') = 'true')
    or ((v_current->>'preferences') = 'false' and (p_consent->>'preferences') = 'true') then return false; end if;
  update public.tracking_visitors set consent = p_consent, updated_at = now() where visitor_id = v_visitor_id;
  update public.tracking_checkout_contexts set identifiers =
    (case when p_consent->>'analytics' = 'false' then identifiers - 'clientId' - 'sessionId' else identifiers end)
    - (case when p_consent->>'marketing' = 'false' then array['gclid','gbraid','wbraid','fbclid','fbp','fbc']::text[] else array[]::text[] end),
    attribution = case when p_consent->>'analytics' = 'false' and p_consent->>'marketing' = 'false' then null else attribution end,
    client_ip = case when p_consent->>'marketing' = 'false' then null else client_ip end,
    user_agent = case when p_consent->>'marketing' = 'false' then null else user_agent end
    where visitor_id = v_visitor_id;
  update public.tracking_orders set identifiers =
    (case when p_consent->>'analytics' = 'false' then identifiers - 'clientId' - 'sessionId' else identifiers end)
    - (case when p_consent->>'marketing' = 'false' then array['gclid','gbraid','wbraid','fbclid','fbp','fbc']::text[] else array[]::text[] end),
    attribution = case when p_consent->>'analytics' = 'false' and p_consent->>'marketing' = 'false' then null else attribution end
    where visitor_id = v_visitor_id;
  update public.tracking_provider_outbox set status = 'failed', payload = '{}'::jsonb, lease_token = null, lease_until = null,
    last_error_code = 'consent_withdrawn', updated_at = now()
    where status in ('pending','sending') and order_gid in (select order_gid from public.tracking_orders where visitor_id = v_visitor_id)
      and ((provider = 'ga4' and p_consent->>'analytics' = 'false') or (provider = 'meta' and p_consent->>'marketing' = 'false'));
  return true;
end;
$$;

create or replace function public.tracking_record_receipt(p_delivery_id uuid, p_shop_domain text, p_topic text, p_order_gid text)
returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_count integer;
begin
  insert into public.tracking_webhook_receipts(delivery_id, shop_domain, topic, order_gid)
  values (p_delivery_id, p_shop_domain, p_topic, p_order_gid) on conflict (delivery_id) do nothing;
  get diagnostics v_count = row_count;
  return v_count = 1;
end;
$$;

create or replace function public.tracking_record_refund(
  p_delivery_id uuid, p_shop_domain text, p_topic text, p_order_gid text, p_refund_gid text
) returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_count integer;
begin
  insert into public.tracking_webhook_receipts(delivery_id, shop_domain, topic, order_gid)
  values (p_delivery_id, p_shop_domain, p_topic, p_order_gid) on conflict (delivery_id) do nothing;
  get diagnostics v_count = row_count;
  if v_count = 0 then return false; end if;
  insert into public.tracking_pending_refunds(refund_gid, order_gid)
  values (p_refund_gid, p_order_gid) on conflict (refund_gid) do nothing;
  return true;
end;
$$;

create or replace function public.tracking_claim_pending_refunds(p_lease_token uuid, p_limit integer default 4)
returns setof public.tracking_pending_refunds
language sql security definer set search_path = public, pg_temp as $$
  with due as (
    select refund_gid from public.tracking_pending_refunds
    where status = 'pending' and next_attempt_at <= now() and (lease_until is null or lease_until < now())
    order by next_attempt_at, first_seen_at
    limit least(4, greatest(0, p_limit))
    for update skip locked
  )
  update public.tracking_pending_refunds r
  set lease_token = p_lease_token, lease_until = now() + interval '60 seconds', attempts = r.attempts + 1
  from due where r.refund_gid = due.refund_gid
  returning r.*;
$$;

create or replace function public.tracking_finish_refund_poll(
  p_refund_gid text, p_lease_token uuid, p_status text, p_next_attempt_at timestamptz, p_events jsonb
) returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_count integer; v_event jsonb;
begin
  update public.tracking_pending_refunds set status = p_status, last_checked_at = now(),
    next_attempt_at = coalesce(p_next_attempt_at, next_attempt_at), lease_token = null, lease_until = null
    where refund_gid = p_refund_gid and status = 'pending' and lease_token = p_lease_token;
  get diagnostics v_count = row_count;
  if v_count = 0 then return false; end if;
  if p_status = 'succeeded' then
    for v_event in select * from jsonb_array_elements(coalesce(p_events, '[]'::jsonb)) loop
      insert into public.tracking_provider_outbox(provider, event_name, event_id, order_gid, payload)
      values (v_event->>'provider', v_event->>'event_name', v_event->>'event_id',
        (select order_gid from public.tracking_pending_refunds where refund_gid = p_refund_gid), v_event->'payload')
      on conflict (provider, event_id) do nothing;
    end loop;
  end if;
  return true;
end;
$$;

create or replace function public.tracking_consume_rate_limit(p_bucket_key text, p_limit integer default 5, p_window_seconds integer default 60)
returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_attempts integer;
begin
  insert into public.tracking_rate_limits(bucket_key, window_started_at, attempts, expires_at)
  values (p_bucket_key, now(), 1, now() + make_interval(secs => p_window_seconds))
  on conflict (bucket_key) do update set
    attempts = case when tracking_rate_limits.window_started_at + make_interval(secs => p_window_seconds) <= now() then 1 else tracking_rate_limits.attempts + 1 end,
    window_started_at = case when tracking_rate_limits.window_started_at + make_interval(secs => p_window_seconds) <= now() then now() else tracking_rate_limits.window_started_at end,
    expires_at = now() + make_interval(secs => p_window_seconds)
  returning attempts into v_attempts;
  return v_attempts <= p_limit;
end;
$$;

create or replace function public.tracking_record_paid_order(
  p_delivery_id uuid,
  p_shop_domain text,
  p_topic text,
  p_order_gid text,
  p_order_name text,
  p_context_id uuid,
  p_transaction_id text,
  p_currency text,
  p_paid_at timestamptz,
  p_test_order boolean,
  p_consent jsonb,
  p_attribution jsonb,
  p_identifiers jsonb,
  p_events jsonb
) returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_visitor_id uuid;
  v_inserted integer;
  v_event jsonb;
begin
  insert into public.tracking_webhook_receipts(delivery_id, shop_domain, topic, order_gid)
  values (p_delivery_id, p_shop_domain, p_topic, p_order_gid)
  on conflict (delivery_id) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then return false; end if;

  select visitor_id into v_visitor_id from public.tracking_checkout_contexts where context_id = p_context_id;
  insert into public.tracking_orders(order_gid, order_name, context_id, visitor_id, consent, attribution, identifiers,
    transaction_id, currency, paid_at, test_order)
  values (p_order_gid, left(p_order_name, 80), p_context_id, v_visitor_id, p_consent, p_attribution, p_identifiers,
    p_transaction_id, p_currency, p_paid_at, p_test_order)
  on conflict (order_gid) do nothing;

  if not p_test_order then
    for v_event in select * from jsonb_array_elements(coalesce(p_events, '[]'::jsonb)) loop
      insert into public.tracking_provider_outbox(provider, event_name, event_id, order_gid, payload, payload_expires_at)
      values (v_event->>'provider', v_event->>'event_name', v_event->>'event_id', p_order_gid,
        v_event->'payload', now() + make_interval(hours => least(168, greatest(1, coalesce((v_event->>'payload_retention_hours')::integer, 168)))))
      on conflict (provider, event_id) do nothing;
    end loop;
  end if;
  return true;
end;
$$;

create or replace function public.tracking_claim_outbox(p_lease_token uuid, p_limit integer default 4)
returns setof public.tracking_provider_outbox
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.tracking_provider_outbox set status = 'manual', payload = '{}'::jsonb,
    lease_token = null, lease_until = null, last_error_code = 'ambiguous_ga4_refund', updated_at = now()
    where status = 'sending' and lease_until < now() and provider = 'ga4' and event_name = 'refund';
  return query
  with due as (
    select id from public.tracking_provider_outbox
    where (status = 'pending' and next_attempt_at <= now())
      or (status = 'sending' and lease_until < now())
    order by next_attempt_at, created_at
    limit least(4, greatest(0, p_limit))
    for update skip locked
  )
  update public.tracking_provider_outbox o
    set status = 'sending', lease_token = p_lease_token, lease_until = now() + interval '60 seconds',
      attempts = o.attempts + 1, updated_at = now()
    from due where o.id = due.id
  returning o.*;
end;
$$;

create or replace function public.tracking_finish_outbox(
  p_id uuid, p_lease_token uuid, p_status text, p_next_attempt_at timestamptz, p_error_code text
) returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_count integer;
begin
  update public.tracking_provider_outbox
  set status = p_status,
      next_attempt_at = coalesce(p_next_attempt_at, next_attempt_at),
      lease_token = null, lease_until = null,
      last_error_code = left(p_error_code, 120), updated_at = now(),
      payload = case when p_status in ('delivered','manual') or p_error_code = 'consent_withdrawn' or payload_expires_at <= now() then '{}'::jsonb else payload end
  where id = p_id and status = 'sending' and lease_token = p_lease_token;
  get diagnostics v_count = row_count;
  return v_count = 1;
end;
$$;

create or replace function public.tracking_dispatch_consent(p_order_gid text)
returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object('order_consent', o.consent, 'current_consent', v.consent,
    'identifiers', case when o.expires_at > now() then o.identifiers else '{}'::jsonb end,
    'attribution', case when o.expires_at > now() then o.attribution else null end,
    'test_order', o.test_order)
  from public.tracking_orders o
  left join public.tracking_visitors v on v.visitor_id = o.visitor_id
  where o.order_gid = p_order_gid;
$$;

create or replace function public.tracking_cleanup()
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.tracking_checkout_contexts set client_ip = null, user_agent = null
    where ephemeral_expires_at <= now();
  update public.tracking_checkout_contexts set attribution = null where identifiers_expires_at <= now();
  update public.tracking_checkout_contexts set identifiers = '{}'::jsonb where identifiers_expires_at <= now();
  update public.tracking_orders set attribution = null where attribution_expires_at <= now();
  update public.tracking_orders set identifiers = '{}'::jsonb where identifiers_expires_at <= now();
  update public.tracking_provider_outbox set payload = '{}'::jsonb where payload_expires_at <= now() and status <> 'sending';
  delete from public.tracking_provider_outbox where status in ('delivered', 'manual', 'failed') and updated_at < now() - interval '180 days';
  delete from public.tracking_webhook_receipts where expires_at <= now();
  delete from public.tracking_rate_limits where expires_at <= now();
  delete from public.tracking_checkout_events where expires_at <= now();
  delete from public.tracking_pending_refunds where expires_at <= now();
  delete from public.tracking_orders where expires_at <= now();
  delete from public.tracking_checkout_contexts where expires_at <= now();
  delete from public.tracking_visitors v where v.updated_at < now() - interval '180 days'
    and not exists (select 1 from public.tracking_checkout_contexts c where c.visitor_id = v.visitor_id);
end;
$$;

revoke all on function public.tracking_create_context(uuid, uuid, jsonb, jsonb, jsonb, inet, text) from public, anon, authenticated;
revoke all on function public.tracking_reduce_consent(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.tracking_record_paid_order(uuid, text, text, text, text, uuid, text, text, timestamptz, boolean, jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.tracking_claim_outbox(uuid, integer) from public, anon, authenticated;
revoke all on function public.tracking_finish_outbox(uuid, uuid, text, timestamptz, text) from public, anon, authenticated;
revoke all on function public.tracking_dispatch_consent(text) from public, anon, authenticated;
revoke all on function public.tracking_cleanup() from public, anon, authenticated;
revoke all on function public.tracking_record_receipt(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.tracking_record_refund(uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function public.tracking_claim_pending_refunds(uuid, integer) from public, anon, authenticated;
revoke all on function public.tracking_finish_refund_poll(text, uuid, text, timestamptz, jsonb) from public, anon, authenticated;
revoke all on function public.tracking_consume_rate_limit(text, integer, integer) from public, anon, authenticated;
revoke all on function public.tracking_record_checkout_event(uuid, text) from public, anon, authenticated;
grant execute on function public.tracking_create_context(uuid, uuid, jsonb, jsonb, jsonb, inet, text) to service_role;
grant execute on function public.tracking_reduce_consent(uuid, jsonb) to service_role;
grant execute on function public.tracking_record_paid_order(uuid, text, text, text, text, uuid, text, text, timestamptz, boolean, jsonb, jsonb, jsonb, jsonb) to service_role;
grant execute on function public.tracking_claim_outbox(uuid, integer) to service_role;
grant execute on function public.tracking_finish_outbox(uuid, uuid, text, timestamptz, text) to service_role;
grant execute on function public.tracking_dispatch_consent(text) to service_role;
grant execute on function public.tracking_cleanup() to service_role;
grant execute on function public.tracking_record_receipt(uuid, text, text, text) to service_role;
grant execute on function public.tracking_record_refund(uuid, text, text, text, text) to service_role;
grant execute on function public.tracking_claim_pending_refunds(uuid, integer) to service_role;
grant execute on function public.tracking_finish_refund_poll(text, uuid, text, timestamptz, jsonb) to service_role;
grant execute on function public.tracking_consume_rate_limit(text, integer, integer) to service_role;
grant execute on function public.tracking_record_checkout_event(uuid, text) to service_role;
