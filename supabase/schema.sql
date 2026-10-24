-- Synaps database schema (Supabase / Postgres 15+)
-- Run once in the Supabase SQL editor. The app talks to the database only with the
-- service-role key from server code; every table has RLS on and no public grants.

-- ───────────────────────────── tables ─────────────────────────────

create table if not exists public.syn_users (
  address        text primary key,                 -- lowercase wallet address
  balance_micros bigint not null default 0,        -- USD × 1,000,000
  free_used      integer not null default 0,
  free_day       date not null default current_date,
  created_at     timestamptz not null default now(),
  ref_code       text unique,                      -- invite code
  referred_by    text,                             -- inviter's address
  ref_rewarded   boolean not null default false,
  instructions   text                              -- custom instructions for every reply
);
create index if not exists syn_users_referred_by_idx on public.syn_users(referred_by);

create table if not exists public.syn_nonces (
  nonce      text primary key,
  expires_at timestamptz not null
);

create table if not exists public.syn_topups (
  tx_hash      text primary key,                   -- one credit per transaction
  chain        text not null,
  address      text not null references public.syn_users(address),
  asset        text not null,                      -- ETH | USDC | SYNAPS
  amount_raw   text not null,
  usd_micros   bigint not null,                    -- value of the payment
  bonus_micros bigint not null default 0,          -- extra credit (e.g. $SYNAPS bonus)
  created_at   timestamptz not null default now()
);

create table if not exists public.syn_api_keys (
  id                 uuid primary key default gen_random_uuid(),
  address            text not null references public.syn_users(address),
  name               text not null,
  prefix             text not null,
  key_hash           text not null unique,         -- sha256 of the key; the key itself is never stored
  daily_limit_micros bigint,
  revoked_at         timestamptz,
  created_at         timestamptz not null default now()
);

create table if not exists public.syn_usage (
  id                bigserial primary key,
  address           text not null,
  key_id            uuid references public.syn_api_keys(id),
  source            text not null,                 -- chat | api
  model             text not null,
  prompt_tokens     integer not null default 0,
  completion_tokens integer not null default 0,
  cost_micros       bigint not null default 0,     -- what the provider charged
  charged_micros    bigint not null default 0,     -- what the user paid
  created_at        timestamptz not null default now()
);

create table if not exists public.syn_free_ip (
  ip   text not null,                               -- IP, "dev:<browser id>", "key:<api key id>" or "global"
  day  date not null default current_date,
  used integer not null default 0,
  primary key (ip, day)
);

create table if not exists public.syn_rate (
  bucket       text primary key,
  window_start timestamptz not null default now(),
  hits         integer not null default 0
);

create table if not exists public.syn_config (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.syn_referrals (
  id              bigserial primary key,
  referrer        text not null,
  referee         text not null unique,
  tx_hash         text not null,
  topup_micros    bigint not null,
  referrer_micros bigint not null,
  referee_micros  bigint not null,
  created_at      timestamptz not null default now()
);

create table if not exists public.syn_chats (
  address    text not null,
  id         text not null,
  title      text not null default '',
  model      text not null default '',
  messages   jsonb not null default '[]'::jsonb,   -- text only; no file contents or images
  updated_at timestamptz not null default now(),
  primary key (address, id)
);
create index if not exists syn_chats_address_updated_idx on public.syn_chats(address, updated_at desc);

create table if not exists public.syn_shares (
  id           text primary key,
  address      text,
  delete_token text not null,
  title        text not null default '',
  model        text not null default '',
  messages     jsonb not null,
  views        integer not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists syn_shares_address_idx on public.syn_shares(address);

-- lock everything down: only the service role (server) can touch these tables
do $$
declare t text;
begin
  foreach t in array array['syn_users','syn_nonces','syn_topups','syn_api_keys','syn_usage','syn_free_ip','syn_rate','syn_config','syn_referrals','syn_chats','syn_shares'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
  end loop;
end $$;

-- ───────────────────────────── functions ─────────────────────────────

-- deducts a charge; never goes below zero; returns the new balance
create or replace function public.syn_debit(p_address text, p_amount bigint)
returns bigint language plpgsql security definer set search_path to 'public' as $$
declare nb bigint;
begin
  update syn_users set balance_micros = greatest(balance_micros - p_amount, 0)
  where address = p_address returning balance_micros into nb;
  return nb;
end $$;

-- credits a verified top-up exactly once per transaction hash
create or replace function public.syn_apply_topup_bonus(p_tx text, p_chain text, p_address text, p_asset text, p_amount_raw text, p_usd bigint, p_bonus bigint)
returns boolean language plpgsql security definer set search_path to 'public' as $$
declare ins int;
begin
  insert into syn_users(address) values (p_address) on conflict do nothing;
  insert into syn_topups(tx_hash, chain, address, asset, amount_raw, usd_micros, bonus_micros)
  values (lower(p_tx), p_chain, p_address, p_asset, p_amount_raw, p_usd, greatest(coalesce(p_bonus, 0), 0))
  on conflict do nothing;
  get diagnostics ins = row_count;
  if ins = 1 then
    update syn_users set balance_micros = balance_micros + p_usd + greatest(coalesce(p_bonus, 0), 0) where address = p_address;
    return true;
  end if;
  return false;
end $$;

-- fixed-window rate limiter
create or replace function public.syn_rate_hit(p_bucket text, p_limit integer, p_window_seconds integer)
returns boolean language plpgsql security definer set search_path to 'public' as $$
declare h int;
begin
  insert into syn_rate(bucket, window_start, hits) values (p_bucket, now(), 1)
  on conflict (bucket) do update set
    hits = case when syn_rate.window_start < now() - make_interval(secs => p_window_seconds) then 1 else syn_rate.hits + 1 end,
    window_start = case when syn_rate.window_start < now() - make_interval(secs => p_window_seconds) then now() else syn_rate.window_start end
  returning hits into h;
  return h <= p_limit;
end $$;

-- free tier: every counter must be under its limit; then all are incremented. Returns 0 or the index of the limit hit.
create or replace function public.syn_take_free_multi(p_keys text[], p_limits integer[])
returns integer language plpgsql security definer set search_path to 'public' as $$
declare i int; u int;
begin
  for i in 1 .. array_length(p_keys, 1) loop
    select used into u from syn_free_ip where ip = p_keys[i] and day = current_date;
    if coalesce(u, 0) >= p_limits[i] then return i; end if;
  end loop;
  for i in 1 .. array_length(p_keys, 1) loop
    insert into syn_free_ip(ip, day, used) values (p_keys[i], current_date, 1)
    on conflict (ip, day) do update set used = syn_free_ip.used + 1;
  end loop;
  return 0;
end $$;

create or replace function public.syn_free_left(p_keys text[], p_limits integer[])
returns integer language plpgsql stable security definer set search_path to 'public' as $$
declare i int; u int; m int := 2147483647;
begin
  for i in 1 .. array_length(p_keys, 1) loop
    select used into u from syn_free_ip where ip = p_keys[i] and day = current_date;
    m := least(m, p_limits[i] - coalesce(u, 0));
  end loop;
  return greatest(m, 0);
end $$;

-- referrals
create or replace function public.syn_ref_code(p_address text)
returns text language plpgsql security definer set search_path to 'public' as $$
declare c text; tries int := 0;
begin
  insert into syn_users(address) values (p_address) on conflict do nothing;
  select ref_code into c from syn_users where address = p_address;
  while c is null and tries < 8 loop
    begin
      update syn_users set ref_code = lower(substr(md5(random()::text || p_address || clock_timestamp()::text), 1, 8))
      where address = p_address and ref_code is null returning ref_code into c;
    exception when unique_violation then c := null;
    end;
    tries := tries + 1;
  end loop;
  return c;
end $$;

create or replace function public.syn_set_referrer(p_address text, p_code text)
returns boolean language plpgsql security definer set search_path to 'public' as $$
declare ref text;
begin
  select address into ref from syn_users where ref_code = lower(p_code);
  if ref is null or ref = p_address then return false; end if;
  if exists (select 1 from syn_topups where address = p_address) then return false; end if;
  update syn_users set referred_by = ref where address = p_address and referred_by is null;
  return found;
end $$;

create or replace function public.syn_referral_reward(p_address text, p_tx text, p_usd bigint, p_referrer_pct numeric, p_referee_pct numeric, p_cap bigint, p_min bigint)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare ref text; a bigint; b bigint;
begin
  if p_usd < p_min then return null; end if;
  update syn_users set ref_rewarded = true
  where address = p_address and referred_by is not null and ref_rewarded = false
  returning referred_by into ref;
  if ref is null then return null; end if;
  a := least(floor(p_usd * p_referrer_pct)::bigint, p_cap);
  b := least(floor(p_usd * p_referee_pct)::bigint, p_cap);
  update syn_users set balance_micros = balance_micros + a where address = ref;
  update syn_users set balance_micros = balance_micros + b where address = p_address;
  insert into syn_referrals(referrer, referee, tx_hash, topup_micros, referrer_micros, referee_micros)
  values (ref, p_address, lower(p_tx), p_usd, a, b);
  return jsonb_build_object('referrer', ref, 'referrer_micros', a, 'referee_micros', b);
end $$;

create or replace function public.syn_referral_stats(p_address text)
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select jsonb_build_object(
    'invited', (select count(*) from syn_users where referred_by = p_address),
    'converted', (select count(*) from syn_referrals where referrer = p_address),
    'earned_micros', (select coalesce(sum(referrer_micros), 0) from syn_referrals where referrer = p_address),
    'referred_by', (select referred_by is not null from syn_users where address = p_address),
    'rewarded', (select ref_rewarded from syn_users where address = p_address)
  );
$$;

create or replace function public.syn_share_view(p_id text)
returns void language sql security definer set search_path to 'public' as $$
  update syn_shares set views = views + 1 where id = p_id;
$$;

-- admin dashboard numbers in one call
create or replace function public.syn_admin_stats(p_days integer default 30)
returns jsonb language sql stable security definer set search_path to 'public' as $$
with
 d as (select g::date as day from generate_series((now() at time zone 'utc')::date - (p_days - 1), (now() at time zone 'utc')::date, interval '1 day') g),
 u as (select (created_at at time zone 'utc')::date as day, count(*) as req, sum(cost_micros) as cost, sum(charged_micros) as charged from syn_usage where created_at >= now() - make_interval(days => p_days) group by 1),
 t as (select (created_at at time zone 'utc')::date as day, count(*) as n, sum(usd_micros) as usd from syn_topups where created_at >= now() - make_interval(days => p_days) group by 1),
 f as (select syn_free_ip.day as day, sum(used) as used from syn_free_ip where syn_free_ip.day >= (now() at time zone 'utc')::date - (p_days - 1) and syn_free_ip.ip !~ '^(dev:|key:|global)' group by 1),
 nu as (select (created_at at time zone 'utc')::date as day, count(*) as n from syn_users where created_at >= now() - make_interval(days => p_days) group by 1)
select jsonb_build_object(
  'users', jsonb_build_object(
     'total', (select count(*) from syn_users),
     'new_24h', (select count(*) from syn_users where created_at >= now() - interval '24 hours'),
     'new_7d', (select count(*) from syn_users where created_at >= now() - interval '7 days'),
     'active_7d', (select count(distinct address) from syn_usage where created_at >= now() - interval '7 days'),
     'with_balance', (select count(*) from syn_users where balance_micros > 0),
     'balances_micros', (select coalesce(sum(balance_micros),0) from syn_users)
  ),
  'topups', jsonb_build_object(
     'all_micros', (select coalesce(sum(usd_micros),0) from syn_topups),
     'all_count', (select count(*) from syn_topups),
     'd1_micros', (select coalesce(sum(usd_micros),0) from syn_topups where created_at >= now() - interval '24 hours'),
     'd7_micros', (select coalesce(sum(usd_micros),0) from syn_topups where created_at >= now() - interval '7 days'),
     'd30_micros', (select coalesce(sum(usd_micros),0) from syn_topups where created_at >= now() - interval '30 days')
  ),
  'usage', jsonb_build_object(
     'all', (select jsonb_build_object('req', count(*), 'cost', coalesce(sum(cost_micros),0), 'charged', coalesce(sum(charged_micros),0)) from syn_usage),
     'd1', (select jsonb_build_object('req', count(*), 'cost', coalesce(sum(cost_micros),0), 'charged', coalesce(sum(charged_micros),0)) from syn_usage where created_at >= now() - interval '24 hours'),
     'd7', (select jsonb_build_object('req', count(*), 'cost', coalesce(sum(cost_micros),0), 'charged', coalesce(sum(charged_micros),0)) from syn_usage where created_at >= now() - interval '7 days'),
     'd30', (select jsonb_build_object('req', count(*), 'cost', coalesce(sum(cost_micros),0), 'charged', coalesce(sum(charged_micros),0)) from syn_usage where created_at >= now() - interval '30 days'),
     'by_source_30d', (select coalesce(jsonb_object_agg(source, req), '{}'::jsonb) from (select source, count(*) as req from syn_usage where created_at >= now() - interval '30 days' group by 1) s)
  ),
  'free', jsonb_build_object(
     'today_msgs', (select coalesce(sum(used),0) from syn_free_ip x where x.day = (now() at time zone 'utc')::date and x.ip !~ '^(dev:|key:|global)'),
     'today_ips', (select count(*) from syn_free_ip x where x.day = (now() at time zone 'utc')::date and x.ip !~ '^(dev:|key:|global)')
  ),
  'daily', (select jsonb_agg(jsonb_build_object(
       'day', d.day,
       'req', coalesce(u.req,0), 'cost', coalesce(u.cost,0), 'charged', coalesce(u.charged,0),
       'topups', coalesce(t.usd,0), 'topup_n', coalesce(t.n,0),
       'free', coalesce(f.used,0), 'new_users', coalesce(nu.n,0)) order by d.day)
     from d left join u on u.day = d.day left join t on t.day = d.day left join f on f.day = d.day left join nu on nu.day = d.day),
  'models_30d', (select coalesce(jsonb_agg(m order by m.charged desc, m.req desc), '[]'::jsonb) from (
       select model, count(*) as req, sum(cost_micros) as cost, sum(charged_micros) as charged, sum(prompt_tokens + completion_tokens) as tokens
       from syn_usage where created_at >= now() - interval '30 days' group by model order by sum(charged_micros) desc, count(*) desc limit 12) m),
  'spenders_30d', (select coalesce(jsonb_agg(s order by s.charged desc), '[]'::jsonb) from (
       select address, count(*) as req, sum(charged_micros) as charged from syn_usage
       where created_at >= now() - interval '30 days' group by address order by sum(charged_micros) desc limit 8) s),
  'recent_topups', (select coalesce(jsonb_agg(r order by r.created_at desc), '[]'::jsonb) from (
       select tx_hash, chain, address, asset, usd_micros, created_at from syn_topups order by created_at desc limit 12) r)
);
$$;

-- functions run as the owner; only the service role may call them
do $$
declare f text;
begin
  for f in select p.oid::regprocedure::text from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname like 'syn\_%' loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
