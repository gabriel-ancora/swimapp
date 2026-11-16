/// <reference types="vite/client" />
/// <reference types="node" />
import { convexTest } from 'convex-test';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { api } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob('./**/*.*s');

const now = new Date().toISOString();

function team(id: string) {
  return {
    id,
    name: `Equipe ${id}`,
    club: 'Clube',
    accentColor: '#0057ff',
    categories: ['Juvenil'],
    weeklySessionsGoal: 5,
    createdAt: now,
    updatedAt: now,
  };
}

function athlete(id: string, teamId: string) {
  return {
    id,
    teamId,
    name: `Atleta ${id}`,
    category: 'Juvenil',
    mainEvent: '100m Livre',
    bestTime: '58.20',
    status: 'Ativo' as const,
    notes: '',
    createdAt: now,
    updatedAt: now,
  };
}

function workout(id: string, teamId: string) {
  return {
    id,
    teamId,
    title: `Treino ${id}`,
    date: '2026-11-16',
    poolLength: 25 as const,
    objective: 'Base',
    coach: 'Coach',
    generalNotes: '',
    items: [],
    createdAt: now,
    updatedAt: now,
  };
}

function plan(id: string, teamId: string) {
  return {
    id,
    teamId,
    title: `Plano ${id}`,
    planType: 'objetivo_geral' as const,
    targetScope: 'equipe' as const,
    startDate: '2026-11-01',
    endDate: '2026-12-31',
    objective: 'Base',
    notes: '',
    phases: [],
    createdAt: now,
    updatedAt: now,
  };
}

async function setup() {
  const t = convexTest(schema, modules);
  const a = await t.action(api.passwords.register, {
    name: 'Coach A',
    email: 'a@example.com',
    password: 'senha-forte-a',
    cref: '',
    specialty: '',
  });
  const b = await t.action(api.passwords.register, {
    name: 'Coach B',
    email: 'b@example.com',
    password: 'senha-forte-b',
    cref: '',
    specialty: '',
  });

  const A = a.sessionToken;
  await t.mutation(api.teams.upsert, { sessionToken: A, team: team('team-a') });
  await t.mutation(api.athletes.upsert, { sessionToken: A, athlete: athlete('ath-a', 'team-a') });
  await t.mutation(api.workouts.upsert, { sessionToken: A, workout: workout('wk-a', 'team-a') });
  await t.mutation(api.plans.upsert, { sessionToken: A, plan: plan('plan-a', 'team-a') });

  return { t, A, B: b.sessionToken, coachA: a.profile };
}

describe('authentication', () => {
  it('registers, logs in and resolves the session on the server', async () => {
    const { t, A, coachA } = await setup();
    expect(await t.query(api.auth.me, { sessionToken: A })).toMatchObject({
      id: coachA.id,
      email: 'a@example.com',
    });

    const login = await t.action(api.passwords.login, {
      email: ' A@Example.com ',
      password: 'senha-forte-a',
    });
    expect(login.profile.id).toBe(coachA.id);
    expect(login.sessionToken).not.toBe(A);
  });

  it('never stores the password or the raw session token', async () => {
    const { t, A } = await setup();
    const { coach, sessions } = await t.run(async (ctx) => ({
      coach: await ctx.db.query('coaches').first(),
      sessions: await ctx.db.query('sessions').collect(),
    }));
    expect(coach?.passwordAlgo).toBe('scrypt-v1');
    expect(coach?.passwordSalt).toMatch(/^[0-9a-f]{32}$/);
    expect(coach?.passwordHash).not.toContain('senha');
    expect(sessions.some((s) => s.tokenHash === A)).toBe(false);
  });

  it('rejects duplicate e-mails and short passwords', async () => {
    const { t } = await setup();
    await expect(
      t.action(api.passwords.register, {
        name: 'X',
        email: 'a@example.com',
        password: 'outra-senha-1',
        cref: '',
        specialty: '',
      })
    ).rejects.toThrow(/Já existe/);
    await expect(
      t.action(api.passwords.register, {
        name: 'X',
        email: 'x@example.com',
        password: '123',
        cref: '',
        specialty: '',
      })
    ).rejects.toThrow(/8 caracteres/);
  });

  it('locks the account after 5 wrong passwords', async () => {
    const { t } = await setup();
    for (let i = 0; i < 5; i++) {
      await expect(
        t.action(api.passwords.login, { email: 'a@example.com', password: 'errada' })
      ).rejects.toThrow(/inválidos/);
    }
    // Even the right password is refused while locked.
    await expect(
      t.action(api.passwords.login, { email: 'a@example.com', password: 'senha-forte-a' })
    ).rejects.toThrow(/Muitas tentativas/);
  });

  it('upgrades legacy SHA-256 hashes on login', async () => {
    const t = convexTest(schema, modules);
    const legacy = createHash('sha256').update('raia_pro_salt_v1:antiga1').digest('hex');
    await t.run(async (ctx) => {
      await ctx.db.insert('coaches', {
        clientId: 'ch-legacy',
        name: 'Legado',
        email: 'legado@example.com',
        passwordHash: legacy,
        cref: '',
        specialty: '',
        createdAt: now,
      });
    });

    const res = await t.action(api.passwords.login, {
      email: 'legado@example.com',
      password: 'antiga1',
    });
    expect(res.profile.id).toBe('ch-legacy');

    const coach = await t.run((ctx) => ctx.db.query('coaches').first());
    expect(coach?.passwordAlgo).toBe('scrypt-v1');
    expect(coach?.passwordHash).not.toBe(legacy);

    // The new hash still accepts the same password.
    await t.action(api.passwords.login, { email: 'legado@example.com', password: 'antiga1' });
  });

  it('logout revokes the session', async () => {
    const { t, A } = await setup();
    await t.mutation(api.auth.logout, { sessionToken: A });
    expect(await t.query(api.auth.me, { sessionToken: A })).toBeNull();
    expect(await t.query(api.teams.list, { sessionToken: A })).toEqual([]);
  });
});

describe('authorization between coaches', () => {
  it('coach B sees none of coach A data', async () => {
    const { t, A, B } = await setup();
    expect(await t.query(api.teams.list, { sessionToken: A })).toHaveLength(1);
    expect(await t.query(api.workouts.list, { sessionToken: A })).toHaveLength(1);

    expect(await t.query(api.teams.list, { sessionToken: B })).toEqual([]);
    expect(await t.query(api.workouts.list, { sessionToken: B })).toEqual([]);
    expect(await t.query(api.plans.list, { sessionToken: B })).toEqual([]);
    expect(
      await t.query(api.athletes.listByTeam, { sessionToken: B, teamId: 'team-a' })
    ).toEqual([]);
  });

  it('coach B cannot change or delete coach A data', async () => {
    const { t, B } = await setup();
    await expect(
      t.mutation(api.teams.upsert, { sessionToken: B, team: team('team-a') })
    ).rejects.toThrow(/permissão/);
    await expect(
      t.mutation(api.athletes.upsert, { sessionToken: B, athlete: athlete('ath-x', 'team-a') })
    ).rejects.toThrow(/permissão/);
    await expect(
      t.mutation(api.athletes.remove, { sessionToken: B, id: 'ath-a' })
    ).rejects.toThrow(/permissão/);
    await expect(
      t.mutation(api.workouts.upsert, { sessionToken: B, workout: workout('wk-a', 'team-a') })
    ).rejects.toThrow(/permissão/);
    await expect(t.mutation(api.workouts.remove, { sessionToken: B, id: 'wk-a' })).rejects.toThrow(
      /permissão/
    );
    await expect(t.mutation(api.plans.remove, { sessionToken: B, id: 'plan-a' })).rejects.toThrow(
      /permissão/
    );
    await expect(t.mutation(api.teams.remove, { sessionToken: B, id: 'team-a' })).rejects.toThrow(
      /permissão/
    );
  });

  it('ignores a forged coachId in the payload', async () => {
    const { t, B, coachA } = await setup();
    await t.mutation(api.workouts.upsert, {
      sessionToken: B,
      workout: { ...workout('wk-b', ''), teamId: undefined, coachId: coachA.id },
    });
    const stored = await t.run((ctx) =>
      ctx.db
        .query('workouts')
        .withIndex('by_clientId', (q) => q.eq('clientId', 'wk-b'))
        .unique()
    );
    expect(stored?.coachId).not.toBe(coachA.id);
  });

  it('rejects mutations without a valid session', async () => {
    const { t } = await setup();
    await expect(
      t.mutation(api.teams.upsert, { sessionToken: 'forjado', team: team('team-x') })
    ).rejects.toThrow(/Sessão/);
    expect(await t.query(api.workouts.list, { sessionToken: 'forjado' })).toEqual([]);
  });

  it('keeps each coach catalog separate', async () => {
    const { t, A, B } = await setup();
    await t.mutation(api.catalog.save, {
      sessionToken: A,
      seriesTypes: [{ id: 'x', name: 'Só do A', category: 'Estilo' }],
      distances: [25],
      intervals: [],
      equipment: [],
      objectives: [],
    });
    expect((await t.query(api.catalog.get, { sessionToken: A }))?.seriesTypes[0].name).toBe(
      'Só do A'
    );
    expect(await t.query(api.catalog.get, { sessionToken: B })).toBeNull();
  });
});

describe('team removal', () => {
  it('cascades to athletes, plans, workouts and phase-1 performance tables', async () => {
    const { t, A } = await setup();
    await t.mutation(api.results.upsert, {
      sessionToken: A,
      result: {
        id: 'res-a',
        teamId: 'team-a',
        athleteId: 'ath-a',
        event: '100m Livre',
        poolLength: 25,
        timeCs: 5240,
        date: '2026-11-16',
        competition: 'Estadual',
        isOfficial: true,
        createdAt: now,
        updatedAt: now,
      },
    });
    await t.mutation(api.cssTests.upsert, {
      sessionToken: A,
      test: {
        id: 'css-a',
        teamId: 'team-a',
        athleteId: 'ath-a',
        date: '2026-11-16',
        poolLength: 25,
        t400Cs: 28000,
        t200Cs: 13000,
        createdAt: now,
        updatedAt: now,
      },
    });
    await t.mutation(api.rpeLogs.upsert, {
      sessionToken: A,
      rpeLog: {
        id: 'rpe-a',
        teamId: 'team-a',
        athleteId: 'ath-a',
        date: '2026-11-16',
        rpe: 7,
        durationMinutes: 60,
        createdAt: now,
        updatedAt: now,
      },
    });
    await t.mutation(api.wellness.upsert, {
      sessionToken: A,
      entry: {
        id: 'well-a',
        teamId: 'team-a',
        athleteId: 'ath-a',
        date: '2026-11-16',
        sleep: 4,
        soreness: 4,
        stress: 4,
        mood: 4,
        createdAt: now,
        updatedAt: now,
      },
    });

    await t.mutation(api.teams.remove, { sessionToken: A, id: 'team-a' });
    const counts = await t.run(async (ctx) => ({
      teams: (await ctx.db.query('teams').collect()).length,
      athletes: (await ctx.db.query('athletes').collect()).length,
      plans: (await ctx.db.query('plans').collect()).length,
      workouts: (await ctx.db.query('workouts').collect()).length,
      results: (await ctx.db.query('results').collect()).length,
      cssTests: (await ctx.db.query('cssTests').collect()).length,
      rpeLogs: (await ctx.db.query('rpeLogs').collect()).length,
      wellness: (await ctx.db.query('wellness').collect()).length,
    }));
    expect(counts).toEqual({
      teams: 0,
      athletes: 0,
      plans: 0,
      workouts: 0,
      results: 0,
      cssTests: 0,
      rpeLogs: 0,
      wellness: 0,
    });
  });
});

describe('phase 1 performance tables security', () => {
  it('isolates results, standards, CSS, RPE and wellness between coaches', async () => {
    const { t, A, B } = await setup();

    await t.mutation(api.qualifyingStandards.upsert, {
      sessionToken: A,
      standard: {
        id: 'std-a',
        name: 'Troféu Brasil',
        organization: 'Troféu Brasil',
        event: '100m Livre',
        category: 'Juvenil',
        poolLength: 50,
        timeCs: 5200,
        createdAt: now,
        updatedAt: now,
      },
    });

    expect(await t.query(api.qualifyingStandards.list, { sessionToken: A })).toHaveLength(1);
    expect(await t.query(api.qualifyingStandards.list, { sessionToken: B })).toEqual([]);
    await expect(
      t.mutation(api.qualifyingStandards.remove, { sessionToken: B, id: 'std-a' })
    ).rejects.toThrow(/permissão/);

    await expect(
      t.mutation(api.results.upsert, {
        sessionToken: B,
        result: {
          id: 'res-forged',
          teamId: 'team-a',
          athleteId: 'ath-a',
          event: '100m Livre',
          poolLength: 25,
          timeCs: 5200,
          date: '2026-11-16',
          competition: 'X',
          isOfficial: true,
          createdAt: now,
          updatedAt: now,
        },
      })
    ).rejects.toThrow(/permissão/);

    await expect(
      t.mutation(api.cssTests.upsert, {
        sessionToken: A,
        test: {
          id: 'css-bad',
          teamId: 'team-a',
          athleteId: 'ath-a',
          date: '2026-11-16',
          poolLength: 25,
          t400Cs: 12000,
          t200Cs: 13000,
          createdAt: now,
          updatedAt: now,
        },
      })
    ).rejects.toThrow(/400m/);
  });
});
