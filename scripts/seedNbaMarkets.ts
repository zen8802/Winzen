/**
 * Fetch the NBA schedule for the next 30 days from ESPN's public API
 * and create a YES/NO prediction market for each game.
 *
 * Usage:
 *   npx tsx scripts/seedNbaMarkets.ts
 *
 * Options:
 *   --dry-run   Print games without writing to DB
 *   --days N    Look ahead N days (default 30)
 *   --creator   Email of the user to own the markets (default: first admin)
 *   --no-images Skip the last-meeting image fetch (faster)
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ─── CLI args ─────────────────────────────────────────────────────────────────

const args          = process.argv.slice(2);
const DRY           = args.includes("--dry-run");
const NO_IMAGES     = args.includes("--no-images");
const DAYS          = parseInt(args[find(args, "--days") + 1] ?? "30") || 30;
const CREATOR_EMAIL = args[find(args, "--creator") + 1] ?? null;

function find(arr: string[], flag: string): number {
  const i = arr.indexOf(flag);
  return i === -1 ? 9999 : i;
}

// ─── NBA season helper ────────────────────────────────────────────────────────

/** Returns the ESPN season year for the current NBA season.
 *  NBA seasons start in October; ESPN labels them by the ending calendar year.
 *  e.g. 2025-26 season → 2026 */
function currentNbaSeason(): number {
  const now = new Date();
  return now.getMonth() >= 9 ? now.getFullYear() + 1 : now.getFullYear();
}

// ─── ESPN types ───────────────────────────────────────────────────────────────

interface EspnGame {
  id:          string;
  date:        string; // ISO
  name:        string; // "Team A at Team B"
  shortName:   string; // "TA @ TB"
  home:        string;
  away:        string;
  homeAbbr:    string;
  awayAbbr:    string;
  homeId:      string; // ESPN team ID
  awayId:      string;
  homeLogoUrl: string | null; // fallback image
  venue:       string;
  imageUrl:    string | null; // resolved after last-meeting fetch
}

type EspnCompetitor = {
  homeAway: string;
  team: {
    id:           string;
    displayName:  string;
    abbreviation: string;
    logos?: Array<{ href: string }>;
  };
};

// ─── Scoreboard fetch ─────────────────────────────────────────────────────────

async function fetchGamesForDate(yyyymmdd: string): Promise<EspnGame[]> {
  const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${yyyymmdd}`;
  const res = await fetch(url);
  if (!res.ok) return [];

  const json = await res.json() as {
    events?: Array<{
      id:        string;
      date:      string;
      name:      string;
      shortName: string;
      competitions: Array<{
        competitors: EspnCompetitor[];
        venue?: { fullName: string };
      }>;
    }>;
  };

  return (json.events ?? []).map((e) => {
    const comp = e.competitions[0];
    const home = comp.competitors.find((c) => c.homeAway === "home")!;
    const away = comp.competitors.find((c) => c.homeAway === "away")!;
    return {
      id:          e.id,
      date:        e.date,
      name:        e.name,
      shortName:   e.shortName,
      home:        home.team.displayName,
      away:        away.team.displayName,
      homeAbbr:    home.team.abbreviation,
      awayAbbr:    away.team.abbreviation,
      homeId:      home.team.id,
      awayId:      away.team.id,
      homeLogoUrl: home.team.logos?.[0]?.href ?? null,
      venue:       comp.venue?.fullName ?? "",
      imageUrl:    null,
    };
  });
}

// ─── Last-meeting image helpers ───────────────────────────────────────────────

type ScheduleEvent = { id: string; date: string; completed: boolean; opponentIds: string[] };

/** Cache: ESPN teamId → their season schedule */
const scheduleCache = new Map<string, ScheduleEvent[]>();

async function getTeamSchedule(teamId: string, season: number): Promise<ScheduleEvent[]> {
  if (scheduleCache.has(teamId)) return scheduleCache.get(teamId)!;

  try {
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${teamId}/schedule?season=${season}`,
    );
    if (!res.ok) { scheduleCache.set(teamId, []); return []; }

    const json = await res.json() as {
      events?: Array<{
        id: string;
        date: string;
        competitions: Array<{
          status: { type: { completed: boolean } };
          competitors: Array<{ team: { id: string } }>;
        }>;
      }>;
    };

    const events: ScheduleEvent[] = (json.events ?? []).map((ev) => ({
      id:          ev.id,
      date:        ev.date,
      completed:   ev.competitions?.[0]?.status?.type?.completed ?? false,
      opponentIds: ev.competitions?.[0]?.competitors?.map((c) => c.team.id) ?? [],
    }));

    scheduleCache.set(teamId, events);
    return events;
  } catch {
    scheduleCache.set(teamId, []);
    return [];
  }
}

/** Try to pull an action photo from the ESPN game recap/preview article. */
async function fetchGamePhoto(eventId: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${eventId}`,
    );
    if (!res.ok) return null;

    // `article` is the game-specific recap/preview — its images are actual game photos.
    // `news.articles` are generic team news attached to the page (NOT game photos — avoid these).
    const json = await res.json() as {
      article?: { images?: Array<{ url: string }> };
    };

    const img = json.article?.images?.[0]?.url;
    return img ?? null;
  } catch {
    return null;
  }
}

/**
 * Find the most recent completed game between homeTeamId and awayTeamId,
 * then return a photo URL from its ESPN summary.
 * Returns null if no meeting found or no photo available.
 */
async function fetchLastMeetingImage(
  homeTeamId: string,
  awayTeamId: string,
  season: number,
): Promise<string | null> {
  const schedule = await getTeamSchedule(homeTeamId, season);

  const pastMeetings = schedule
    .filter((ev) => ev.completed && ev.opponentIds.includes(awayTeamId))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (pastMeetings.length === 0) return null;

  // Polite pause before summary call
  await new Promise((r) => setTimeout(r, 100));
  return fetchGamePhoto(pastMeetings[0].id);
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function yyyymmdd(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

function formatGameDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit", timeZoneName: "short",
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // Find creator user
  let creator;
  if (CREATOR_EMAIL) {
    creator = await prisma.user.findUnique({ where: { email: CREATOR_EMAIL } });
    if (!creator) throw new Error(`No user with email: ${CREATOR_EMAIL}`);
  } else {
    creator = await prisma.user.findFirst({ where: { role: "admin" } });
    if (!creator) throw new Error("No admin user found. Pass --creator <email> or create an admin first.");
  }

  console.log(`Creator: ${creator.name ?? creator.email} (${creator.id})`);
  console.log(`Fetching NBA schedule for next ${DAYS} days…\n`);

  // ── Collect games ──────────────────────────────────────────────────────────
  const allGames: EspnGame[] = [];
  const today = new Date();

  for (let d = 0; d < DAYS; d++) {
    const date = new Date(today);
    date.setDate(today.getDate() + d);
    const dateStr = yyyymmdd(date);
    const games   = await fetchGamesForDate(dateStr);
    if (games.length) {
      console.log(`  ${dateStr}: ${games.length} game(s)`);
      allGames.push(...games);
    }
    await new Promise((r) => setTimeout(r, 150));
  }

  console.log(`\nTotal games found: ${allGames.length}`);

  if (DRY || allGames.length === 0) {
    if (allGames.length > 0) {
      console.log("\nDry run — games that would be created:");
      for (const g of allGames) {
        console.log(`  [${formatGameDate(g.date)}] ${g.away} @ ${g.home}`);
      }
    }
    return;
  }

  // ── Resolve images ─────────────────────────────────────────────────────────
  if (!NO_IMAGES) {
    const season = currentNbaSeason();
    console.log(`\nFetching last-meeting photos (season ${season})…`);

    for (let i = 0; i < allGames.length; i++) {
      const game = allGames[i];
      process.stdout.write(`  [${i + 1}/${allGames.length}] ${game.homeAbbr} vs ${game.awayAbbr} … `);

      const photo = await fetchLastMeetingImage(game.homeId, game.awayId, season);
      if (photo) {
        game.imageUrl = photo;
        process.stdout.write("photo ✓\n");
      } else if (game.homeLogoUrl) {
        game.imageUrl = game.homeLogoUrl;
        process.stdout.write("logo fallback\n");
      } else {
        process.stdout.write("no image\n");
      }

      // Polite rate-limit between games (schedule cache keeps this manageable)
      await new Promise((r) => setTimeout(r, 150));
    }
  } else {
    // --no-images: use team logos only
    for (const game of allGames) {
      game.imageUrl = game.homeLogoUrl;
    }
  }

  // ── Deduplicate against existing markets ───────────────────────────────────
  const existingTitles = new Set(
    (await prisma.market.findMany({ select: { title: true }, where: { category: "sports" } }))
      .map((m) => m.title),
  );

  let created = 0;
  let skipped = 0;

  for (const game of allGames) {
    const gameStart = new Date(game.date);
    const closesAt  = new Date(gameStart.getTime() - 5 * 60 * 1000);

    if (closesAt <= new Date()) { skipped++; continue; }

    const title = `Will the ${game.home} beat the ${game.away}? (NBA ${gameStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })})`;

    if (existingTitles.has(title)) {
      console.log(`  SKIP (exists): ${title}`);
      skipped++;
      continue;
    }

    const description =
      `${game.away} (${game.awayAbbr}) at ${game.home} (${game.homeAbbr})` +
      (game.venue ? ` — ${game.venue}` : "") +
      `. Tip-off: ${formatGameDate(game.date)}. Market closes 5 minutes before the game starts. YES = ${game.home} wins, NO = ${game.away} wins.`;

    await prisma.market.create({
      data: {
        title,
        description,
        type:               "yes_no",
        category:           "sports",
        closesAt,
        createdById:        creator.id,
        currentProbability: 50,
        liquidity:          5000,
        creatorDeposit:     0,
        imageUrl:           game.imageUrl ?? undefined,
        outcomes: {
          create: [
            { label: "Yes", order: 0 },
            { label: "No",  order: 1 },
          ],
        },
      },
    });

    console.log(`  CREATED: ${title}`);
    existingTitles.add(title);
    created++;
  }

  console.log(`\n✅ Done — ${created} created, ${skipped} skipped`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
