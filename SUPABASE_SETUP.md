# Setting up cloud sync (Supabase)

This lets you use the same Timecard on your phone, laptop, and anywhere
else, all sharing the same data automatically. **Free, no credit card.**

You do this ONCE. After it's set up, every device just signs in once
and syncs forever.

---

## Step 1 — Create a Supabase account

1. Go to **https://supabase.com**
2. **Start your project** → sign up with GitHub or email.
3. Verify your email if asked.

## Step 2 — Create a new project

1. On the dashboard, click **New project**.
2. **Organization**: leave the default.
3. **Project name**: `timecard`
4. **Database password**: click *Generate*, then **save it somewhere safe** (you probably won't need it again but keep it just in case).
5. **Region**: pick whichever is closest to you (e.g. `West US (North California)`).
6. **Pricing plan**: Free.
7. Click **Create new project**.
8. Wait ~2 minutes for it to provision.

## Step 3 — Run the database setup

While it's provisioning (or after), in the left sidebar click **SQL Editor**.

1. Click **New query**.
2. Paste this entire block:

```sql
-- Single-row-per-user table to hold the whole Timecard state.
create table if not exists public.tc_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- RLS: each user can only see/write their own row.
alter table public.tc_state enable row level security;

drop policy if exists "Users read own state" on public.tc_state;
create policy "Users read own state"
  on public.tc_state for select
  using (auth.uid() = user_id);

drop policy if exists "Users write own state" on public.tc_state;
create policy "Users write own state"
  on public.tc_state for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users update own state" on public.tc_state;
create policy "Users update own state"
  on public.tc_state for update
  using (auth.uid() = user_id);

-- Enable real-time on the table so other devices get changes live.
alter publication supabase_realtime add table public.tc_state;

-- Official approvals Katrina writes when she signs. Erika's app picks these
-- up automatically (no email link required).
create table if not exists public.tc_approvals (
  id uuid primary key default gen_random_uuid(),
  employee_email text not null,
  period_start date not null,
  period_end date not null,
  receipt jsonb not null,
  signed_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (employee_email, period_start)
);

alter table public.tc_approvals enable row level security;

-- Katrina's approval page is anonymous — allow inserts of signed receipts.
drop policy if exists "Anyone can insert approvals" on public.tc_approvals;
create policy "Anyone can insert approvals"
  on public.tc_approvals for insert
  with check (true);

-- Erika (signed in) can read approvals addressed to her email.
drop policy if exists "Users read own email approvals" on public.tc_approvals;
create policy "Users read own email approvals"
  on public.tc_approvals for select
  using (lower(auth.jwt() ->> 'email') = lower(employee_email));

-- Allow updates so re-signing the same period upserts cleanly via anon.
drop policy if exists "Anyone can update approvals" on public.tc_approvals;
create policy "Anyone can update approvals"
  on public.tc_approvals for update
  using (true)
  with check (true);

alter publication supabase_realtime add table public.tc_approvals;
```

3. Click **Run** (or Cmd+Enter). You should see "Success. No rows returned."

If you already set up Timecard earlier, run this **extra** block too (adds automatic Katrina → Erika approvals):

```sql
create table if not exists public.tc_approvals (
  id uuid primary key default gen_random_uuid(),
  employee_email text not null,
  period_start date not null,
  period_end date not null,
  receipt jsonb not null,
  signed_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (employee_email, period_start)
);

alter table public.tc_approvals enable row level security;

drop policy if exists "Anyone can insert approvals" on public.tc_approvals;
create policy "Anyone can insert approvals"
  on public.tc_approvals for insert
  with check (true);

drop policy if exists "Users read own email approvals" on public.tc_approvals;
create policy "Users read own email approvals"
  on public.tc_approvals for select
  using (lower(auth.jwt() ->> 'email') = lower(employee_email));

drop policy if exists "Anyone can update approvals" on public.tc_approvals;
create policy "Anyone can update approvals"
  on public.tc_approvals for update
  using (true)
  with check (true);

alter publication supabase_realtime add table public.tc_approvals;
```

(If it says the table is already in the publication, that's fine — ignore that error.)

## Step 4 — Lock down sign-ups so only you can sign in

By default Supabase lets anyone with the URL sign up. You don't want
that — only you should be able to sign in to your own timecard.

1. Left sidebar → **Authentication** → **Providers**.
2. Click **Email**.
3. Make sure **"Enable Email provider"** is ON.
4. Keep **"Confirm email"** ON (default).
5. **Save**.

After you sign up yourself in Step 6 below, come back here and:

6. Left sidebar → **Authentication** → **Sign In / Up**.
7. Toggle **"Allow new users to sign up"** to **OFF**.
8. **Save**.

This locks the door behind you so no one else can create an account.

## Step 4b — Set the redirect URL (required for sign-in links)

Magic-link emails only work if Supabase knows where to send you back.

1. Left sidebar → **Authentication** → **URL Configuration**.
2. Set **Site URL** to:
   `https://the-representation-project.github.io/trp-timecard/Timecard.html`
3. Under **Redirect URLs**, click **Add URL** and paste the **same exact URL**:
   `https://the-representation-project.github.io/trp-timecard/Timecard.html`
4. **Save**.

The app also shows this URL inside **⚙ Cloud Sync** — it must match character-for-character.

## Step 5 — Copy the two values I need

1. Left sidebar (very bottom) → **Project Settings** → **API**.
2. You'll see two boxes:
   - **Project URL** — looks like `https://abcdefghij.supabase.co`
   - **Project API keys** → **anon / public** — long string starting with `eyJ...`

Copy both. (The "anon" key is safe to put in client-side code — that's
what it's designed for. The RLS policies are what actually protect
your data.)

## Step 6 — Plug them into the app

1. Open your Timecard app (`https://the-representation-project.github.io/trp-timecard/Timecard.html`).
2. Top right of the app, click the **⚙ Cloud Sync** button.
3. Paste your **Project URL** into the URL field.
4. Paste your **anon key** into the API Key field.
5. Click **Save & Connect**.
6. The form changes to a sign-in screen. Enter your email
   (`erika@therepproject.org`) and click **Send sign-in link**.
7. Check your inbox for a Supabase email — click the link in it.
8. You'll land back in the app, signed in. The app asks if you want
   to upload your existing local data to the cloud — say **yes**.
9. Go back to Supabase → Authentication → Sign In / Up → turn OFF
   "Allow new users to sign up" (see Step 4 #6–8).

Done. Now on your phone: open the app → ⚙ Cloud Sync → enter the same
URL + key → sign in with the same email → click the link in your
inbox on the phone. Both devices now share the same data, live.

## What if something goes wrong?

- **Still says "Local only"** — you haven't pasted URL + key yet, or you cleared config.
- **Says "Sync — sign in"** — configured but not signed in; send yourself a magic link.
- **Magic link opens wrong page / doesn't sign you in** — fix Step 4b redirect URL (most common issue).
- **"Sync error" after sign-in** — open ⚙ → **Test cloud connection**. If it mentions `tc_state`, re-run the SQL from Step 3.
- **"Email rate limit exceeded"** — Supabase's free tier limits magic-link emails to a few per hour. Wait 10 minutes and try again.
- **Link in email goes to wrong place** — In Supabase: Authentication → URL Configuration → set **Site URL** and **Redirect URLs** to `https://the-representation-project.github.io/trp-timecard/Timecard.html` (must match exactly — the app shows this URL in ⚙ Cloud Sync).
- **Want to start over?** — In the app, ⚙ Cloud Sync → Sign Out → Clear Cloud Config. Then re-paste your URL + key.

## What does cloud sync cost?

$0. The free tier gives you:
- 500 MB database (you'd need millions of entries to hit this)
- 50K monthly active users (you have 1)
- Unlimited API requests
- 1 GB file storage (we don't use any)

The project pauses if you don't use it for 7 days, but auto-resumes
when you open the app. No data loss.
