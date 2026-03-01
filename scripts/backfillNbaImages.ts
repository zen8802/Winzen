/**
 * Backfill imageUrl for existing NBA sports markets that have no image.
 *
 * Usage:
 *   npx tsx scripts/backfillNbaImages.ts
 *
 * Options:
 *   --logos-only   Use team logo fallback only (skips last-meeting photo fetch, much faster)
 *   --force        Re-fetch even markets that already have an imageUrl
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const args       = process.argv.slice(2);
const LOGOS_ONLY = args.includes("--logos-only");
const FORCE      = args.includes("--force");

// ─── NBA season helper ────────────────────────────────────────────────────────

function currentNbaSeason(): number {
  const now = new Date();
  return now.getMonth() >= 9 ? now.getFullYear() + 1 : now.getFullYear();
}

// ─── Build abbreviation → { id, logoUrl } map ─────────────────────────────────

type TeamInfo = { id: string; logoUrl: string };

async function buildTeamMap(): Promise<Map<string, TeamInfo>> {
  const res = await fetch(
    "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams?limit=40",
  );
  if (!res.ok) throw new Error(`ESPN teams API failed: ${res.status}`);

  const json = await res.json() as {
    sports: Array<{
      leagues: Array<{
        teams: Array<{
          team: {
            id: string;
            abbreviation: string;
            logos?: Array<{ href: string }>;
          };
        }>;
      }>;
    }>;
  };

  const map = new Map<string, TeamInfo>();
  const teams = json.sports?.[0]?.leagues?.[0]?.teams ?? [];
  for (const entry of teams) {
    const abbr = entry.team.abbreviation.toUpperCase();
    map.set(abbr, {
      id:      entry.team.id,
      // Use the URL from ESPN's own API response — guaranteed to be correct
      logoUrl: entry.team.logos?.[0]?.href
        ?? `https://a.espncdn.com/i/teamlogos/nba/500/${abbr.toLowerCase()}.png`,
    });
  }
  return map;
}

// ─── Last-meeting photo ───────────────────────────────────────────────────────

type ScheduleEvent = { id: string; date: string; completed: boolean; opponentIds: string[] };
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
        id: string; date: string;
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

/**
 * Fetch an action photo from the ESPN game summary.
 * Uses `article.images` — the game-specific recap/preview article.
 * Deliberately ignores `news.articles` which are generic team news (not game photos).
 */
async function fetchGamePhoto(eventId: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${eventId}`,
    );
    if (!res.ok) return null;

    const json = await res.json() as {
      article?: { images?: Array<{ url: string }> };
    };

    return json.article?.images?.[0]?.url ?? null;
  } catch {
    return null;
  }
}

async function fetchLastMeetingImage(
  homeTeamId: string,
  awayTeamId: string,
  season: number,
): Promise<string | null> {
  const schedule = await getTeamSchedule(homeTeamId, season);
  const past = schedule
    .filter((ev) => ev.completed && ev.opponentIds.includes(awayTeamId))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  if (past.length === 0) return null;
  await new Promise((r) => setTimeout(r, 100));
  return fetchGamePhoto(past[0].id);
}

// ─── Parse team abbreviations from market description ─────────────────────────

/**
 * Description format: "{Away} ({AWAY_ABBR}) at {Home} ({HOME_ABBR}) — ..."
 * Returns [awayAbbr, homeAbbr] or null if not parseable.
 */
function parseAbbreviations(description: string): [string, string] | null {
  const matches = Array.from(description.matchAll(/\(([A-Z]{2,5})\)/g));
  if (matches.length < 2) return null;
  return [matches[0][1], matches[1][1]]; // [awayAbbr, homeAbbr]
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Fetching ESPN team map…");
  const teamMap = await buildTeamMap();
  console.log(`  Found ${teamMap.size} NBA teams.\n`);

  const markets = await prisma.market.findMany({
    where: {
      category: "sports",
      ...(FORCE ? {} : { imageUrl: null }),
    },
    select: { id: true, title: true, description: true },
    orderBy: { createdAt: "desc" },
  });

  console.log(`Markets to process: ${markets.length}${FORCE ? " (--force)" : " (no imageUrl)"}\n`);
  if (markets.length === 0) { console.log("Nothing to do."); return; }

  const season = currentNbaSeason();
  let updated = 0;
  let photoCount = 0;
  let logoCount = 0;
  let skipped = 0;

  for (let i = 0; i < markets.length; i++) {
    const market = markets[i];
    const abbrs = market.description ? parseAbbreviations(market.description) : null;

    if (!abbrs) {
      process.stdout.write(`  [${i + 1}/${markets.length}] SKIP (no abbr): ${market.title.slice(0, 50)}\n`);
      skipped++;
      continue;
    }

    const [awayAbbr, homeAbbr] = abbrs;
    const homeInfo = teamMap.get(homeAbbr);
    const awayInfo = teamMap.get(awayAbbr);

    process.stdout.write(`  [${i + 1}/${markets.length}] ${homeAbbr} vs ${awayAbbr} … `);

    let imageUrl: string | null = null;

    if (!LOGOS_ONLY && homeInfo && awayInfo) {
      imageUrl = await fetchLastMeetingImage(homeInfo.id, awayInfo.id, season);
      if (imageUrl) {
        process.stdout.write("photo ✓\n");
        photoCount++;
      }
    }

    if (!imageUrl) {
      // Use logo URL from ESPN's own API (verified, correct per team)
      imageUrl = homeInfo?.logoUrl
        ?? `https://a.espncdn.com/i/teamlogos/nba/500/${homeAbbr.toLowerCase()}.png`;
      process.stdout.write("logo fallback\n");
      logoCount++;
    }

    await prisma.market.update({ where: { id: market.id }, data: { imageUrl } });
    updated++;

    await new Promise((r) => setTimeout(r, 150));
  }

  console.log(`\n✅ Done — ${updated} updated (${photoCount} game photos, ${logoCount} logos, ${skipped} skipped)`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
