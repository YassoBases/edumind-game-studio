import type { FastifyInstance, FastifyRequest } from 'fastify';
import { prisma } from '../db.ts';

function getStudentId(req: FastifyRequest): string {
  const id = req.headers['x-student-id'];
  if (typeof id !== 'string' || !id) {
    throw Object.assign(new Error('Missing x-student-id header'), { statusCode: 401 });
  }
  return id;
}

// Streak math: a "play day" is any UTC date with ≥1 completed game (reportComplete fired).
// We rely on streakLastPlayedAt being set to UTC-midnight of the play day.
function ymdUTC(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function daysBetween(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

/** Returns the student's current league tier based on lifetime XP. */
function tierFor(xp: number): 'bronze' | 'silver' | 'gold' {
  if (xp >= 2000) return 'gold';
  if (xp >= 500) return 'silver';
  return 'bronze';
}

export async function studentsRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/students/me/stats — fast read for the dashboard top strip.
  app.get('/me/stats', async (req, reply) => {
    const studentId = getStudentId(req);
    const student = await prisma.student.findUnique({ where: { externalId: studentId } });
    if (!student) {
      return reply.send({
        xp: 0, streakCount: 0, dailyGoal: 3, dailyProgress: 0,
        leagueTier: 'bronze', streakLastPlayedAt: null,
      });
    }
    // Count today's completions for daily progress.
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const dailyProgress = await prisma.summary.count({
      where: { studentId: student.id, createdAt: { gte: todayStart } },
    });
    return reply.send({
      xp: student.xp,
      streakCount: student.streakCount,
      streakLastPlayedAt: student.streakLastPlayedAt,
      dailyGoal: student.dailyGoal,
      dailyProgress,
      leagueTier: student.leagueTier,
    });
  });

  // POST /api/students/me/streak-check — called by the dashboard on load. Decides whether
  // today extends, breaks, or maintains the streak. Idempotent within a day.
  app.post('/me/streak-check', async (req, reply) => {
    const studentId = getStudentId(req);
    const student = await prisma.student.upsert({
      where: { externalId: studentId },
      update: {},
      create: { externalId: studentId, language: 'en' },
    });
    const now = new Date();
    const todayMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const last = student.streakLastPlayedAt;
    if (!last) {
      // No prior play — leave streakCount alone (0); the actual extension happens when a
      // game completes today, not on dashboard load.
      return reply.send({ xp: student.xp, streakCount: student.streakCount, action: 'noop' });
    }
    const lastMid = new Date(Date.UTC(last.getUTCFullYear(), last.getUTCMonth(), last.getUTCDate()));
    const gap = daysBetween(lastMid, todayMidnight);
    if (gap >= 2) {
      // Missed at least one day → streak resets.
      const updated = await prisma.student.update({
        where: { id: student.id },
        data: { streakCount: 0 },
      });
      await prisma.streakEvent.create({
        data: { studentId: student.id, action: 'lost', countAfter: 0 },
      });
      return reply.send({ xp: updated.xp, streakCount: 0, action: 'lost' });
    }
    return reply.send({ xp: student.xp, streakCount: student.streakCount, action: 'noop' });
  });

  // GET /api/students/me/xp-events — recent XP events for the activity feed.
  app.get('/me/xp-events', async (req, reply) => {
    const studentId = getStudentId(req);
    const student = await prisma.student.findUnique({ where: { externalId: studentId } });
    if (!student) return reply.send({ events: [] });
    const q = req.query as { limit?: string };
    const limit = Math.min(200, Math.max(1, Number(q.limit) || 50));
    const events = await prisma.xpEvent.findMany({
      where: { studentId: student.id },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return reply.send({ events });
  });
}

/**
 * Award XP + handle streak update when a game completes. Called from the games route's
 * /:id/complete handler. Returns the XP delta (for the bridge to display in the player).
 */
export async function awardCompletionXp(
  studentId: string,
  gameId: string,
  payload: { totalScore: number; overallAccuracy: number; masteryAchieved: boolean; conceptMastery: { mastered: boolean }[] },
): Promise<{ xpDelta: number; newStreak: number; newXp: number; streakAction: 'extended' | 'maintained' | 'new' }> {
  const student = await prisma.student.findUnique({ where: { externalId: studentId } });
  if (!student) return { xpDelta: 0, newStreak: 0, newXp: 0, streakAction: 'maintained' };

  // Compute XP. Rules from the spec:
  //   - 10 XP per correct answer (approx via overallAccuracy × levelsPlayed × items/level)
  //   - 50 XP per level completed (we don't know exact levelsPlayed here; use score → levels)
  //   - 200 XP if masteryAchieved
  //   - 25 XP × streakCount on streak extension (cap 250)
  const correctish = Math.round((payload.overallAccuracy || 0) * 25); // ~25 items in a game
  const levelsPlayed = Math.max(1, Math.round((payload.totalScore || 0) / 60));
  let xpDelta = correctish * 10 + levelsPlayed * 50;
  if (payload.masteryAchieved) xpDelta += 200;

  // Streak handling.
  const now = new Date();
  const todayMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const last = student.streakLastPlayedAt;
  const lastMid = last ? new Date(Date.UTC(last.getUTCFullYear(), last.getUTCMonth(), last.getUTCDate())) : null;
  let newStreak = student.streakCount;
  let streakAction: 'extended' | 'maintained' | 'new' = 'maintained';
  if (!lastMid) {
    newStreak = 1; streakAction = 'new';
  } else if (ymdUTC(lastMid) === ymdUTC(todayMidnight)) {
    // Already played today → maintain
    streakAction = 'maintained';
  } else if (daysBetween(lastMid, todayMidnight) === 1) {
    newStreak += 1; streakAction = 'extended';
    xpDelta += Math.min(250, 25 * newStreak);
  } else {
    newStreak = 1; streakAction = 'new';
  }

  const newTier = tierFor(student.xp + xpDelta);
  await prisma.student.update({
    where: { id: student.id },
    data: {
      xp: { increment: xpDelta },
      streakCount: newStreak,
      streakLastPlayedAt: now,
      leagueTier: newTier,
    },
  });
  await prisma.xpEvent.create({
    data: {
      studentId: student.id,
      amount: xpDelta,
      reason: payload.masteryAchieved ? 'mastery' : 'level_complete',
      gameId,
    },
  });
  if (streakAction === 'extended' || streakAction === 'new') {
    await prisma.streakEvent.create({
      data: { studentId: student.id, action: streakAction === 'extended' ? 'extended' : 'extended', countAfter: newStreak },
    });
  }
  return { xpDelta, newStreak, newXp: student.xp + xpDelta, streakAction };
}
