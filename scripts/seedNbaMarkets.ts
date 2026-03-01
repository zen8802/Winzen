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
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ─── CLI args ─────────────────────────────────────────────────────────────────

const args   = process.argv.slice(2);
const DRY    = args.includes("--dry-run");
const DAYS   = parseInt(args[find(args, "--days") + 1] ?? "30") || 30;
const CREATOR_EMAIL = args[find(args, "--creator") + 1] ?? null;

function find(arr: string[], flag: string): number {
  const i = arr.indexOf(flag);
  return i === -1 ? 9999 : i;
}

// ─── ESPN helpers ─────────────────────────────────────────────────────────────

interface EspnGame {
  id:        string;
  date:      string; // ISO
  name:      string; // "Team A at Team B"
  shortName: string; // "TA @ TB"
  home:      string;
  away:      string;
  homeAbbr:  string;
  awayAbbr:  string;
  venue:     string;
}

async function fetchGamesForDate(yyyymmdd: string): Promise<EspnGame[]> {
  const url  = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${yyyymmdd}`;
  const res  = await fetch(url);
  if (!res.ok) return [];

  const json = await res.json() as {
    events?: Array<{
      id:   string;
      date: string;
      name: string;
      shortName: string;
      competitions: Array<{
        competitors: Array<{ homeAway: string; team: { displayName: string; abbreviation: string } }>;
        venue?: { fullName: string };
      }>;
    }>;
  };

  return (json.events ?? []).map((e) => {
    const comp = e.competitions[0];
    const home = comp.competitors.find((c) => c.homeAway === "home")!;
    const away = comp.competitors.find((c) => c.homeAway === "away")!;
    return {
      id:        e.id,
      date:      e.date,
      name:      e.name,
      shortName: e.shortName,
      home:      home.team.displayName,
      away:      away.team.displayName,
      homeAbbr:  home.team.abbreviation,
      awayAbbr:  away.team.abbreviation,
      venue:     comp.venue?.fullName ?? "",
    };
  });
}

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

  // Collect all games across the date range
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
    // Small delay to be polite to ESPN's servers
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

  // Check for already-created markets to avoid duplicates (match on title prefix)
  const existingTitles = new Set(
    (await prisma.market.findMany({ select: { title: true }, where: { category: "sports" } }))
      .map((m) => m.title)
  );

  let created = 0;
  let skipped = 0;

  for (const game of allGames) {
    const gameStart = new Date(game.date);
    // Market closes 5 minutes before tip-off
    const closesAt  = new Date(gameStart.getTime() - 5 * 60 * 1000);

    // Skip games that have already started or are too close
    if (closesAt <= new Date()) {
      skipped++;
      continue;
    }

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

    if (DRY) {
      console.log(`  [DRY] ${title}`);
      continue;
    }

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
