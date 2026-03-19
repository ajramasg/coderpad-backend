/**
 * SQL execution runner using an in-memory SQLite database (sql.js — pure JS,
 * no native binaries) pre-loaded with 5 baseball tables.
 * Every run gets a fresh database — no state leaks between executions.
 *
 * Tables:  teams · players · games · batting_stats · pitching_stats
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
import initSqlJs from 'sql.js';
import type { ExecutionResult } from './executor';

// ── Seeded deterministic PRNG (LCG) so data is identical on every startup ─────

class RNG {
  private s: number;
  constructor(seed = 0xba5eba11) { this.s = seed >>> 0; }
  next(): number {
    this.s = Math.imul(this.s ^ (this.s >>> 16), 0x45d9f3b);
    this.s = Math.imul(this.s ^ (this.s >>> 16), 0x45d9f3b);
    this.s = (this.s ^ (this.s >>> 16)) >>> 0;
    return this.s / 0x100000000;
  }
  int(lo: number, hi: number) { return Math.floor(this.next() * (hi - lo + 1)) + lo; }
  pick<T>(a: T[]): T { return a[Math.floor(this.next() * a.length)]; }
  float(lo: number, hi: number) { return this.next() * (hi - lo) + lo; }
}

// ── Static data ───────────────────────────────────────────────────────────────

const TEAMS = [
  [1,  'Yankees',     'New York',      'NY', 'AL', 'East',    'Yankee Stadium',      47309, 1903, 27],
  [2,  'Red Sox',     'Boston',        'MA', 'AL', 'East',    'Fenway Park',         37755, 1901,  9],
  [3,  'Blue Jays',   'Toronto',       'ON', 'AL', 'East',    'Rogers Centre',       49286, 1977,  2],
  [4,  'Rays',        'Tampa Bay',     'FL', 'AL', 'East',    'Tropicana Field',     25000, 1998,  0],
  [5,  'Orioles',     'Baltimore',     'MD', 'AL', 'East',    'Camden Yards',        44487, 1901,  3],
  [6,  'White Sox',   'Chicago',       'IL', 'AL', 'Central', 'Guaranteed Rate',     40615, 1900,  3],
  [7,  'Guardians',   'Cleveland',     'OH', 'AL', 'Central', 'Progressive Field',   35225, 1901,  2],
  [8,  'Tigers',      'Detroit',       'MI', 'AL', 'Central', 'Comerica Park',       41083, 1901,  4],
  [9,  'Royals',      'Kansas City',   'MO', 'AL', 'Central', 'Kauffman Stadium',    37903, 1969,  2],
  [10, 'Twins',       'Minnesota',     'MN', 'AL', 'Central', 'Target Field',        38649, 1901,  3],
  [11, 'Astros',      'Houston',       'TX', 'AL', 'West',    'Minute Maid Park',    41168, 1962,  2],
  [12, 'Angels',      'Los Angeles',   'CA', 'AL', 'West',    'Angel Stadium',       45517, 1961,  1],
  [13, 'Athletics',   'Oakland',       'CA', 'AL', 'West',    'Oakland Coliseum',    34000, 1901,  9],
  [14, 'Mariners',    'Seattle',       'WA', 'AL', 'West',    'T-Mobile Park',       47929, 1977,  0],
  [15, 'Rangers',     'Texas',         'TX', 'AL', 'West',    'Globe Life Field',    40518, 1961,  1],
  [16, 'Braves',      'Atlanta',       'GA', 'NL', 'East',    'Truist Park',         41149, 1876,  4],
  [17, 'Marlins',     'Miami',         'FL', 'NL', 'East',    'loanDepot Park',      36742, 1993,  2],
  [18, 'Mets',        'New York',      'NY', 'NL', 'East',    'Citi Field',          41922, 1962,  2],
  [19, 'Phillies',    'Philadelphia',  'PA', 'NL', 'East',    'Citizens Bank Park',  42792, 1883,  2],
  [20, 'Nationals',   'Washington',    'DC', 'NL', 'East',    'Nationals Park',      41339, 1969,  1],
  [21, 'Cubs',        'Chicago',       'IL', 'NL', 'Central', 'Wrigley Field',       41649, 1876,  3],
  [22, 'Reds',        'Cincinnati',    'OH', 'NL', 'Central', 'Great American Ball', 42319, 1882,  5],
  [23, 'Brewers',     'Milwaukee',     'WI', 'NL', 'Central', 'American Family',     41900, 1969,  1],
  [24, 'Pirates',     'Pittsburgh',    'PA', 'NL', 'Central', 'PNC Park',            38747, 1882,  5],
  [25, 'Cardinals',   'St. Louis',     'MO', 'NL', 'Central', 'Busch Stadium',       44383, 1882, 11],
  [26, 'Diamondbacks','Phoenix',       'AZ', 'NL', 'West',    'Chase Field',         48519, 1998,  1],
  [27, 'Rockies',     'Denver',        'CO', 'NL', 'West',    'Coors Field',         50144, 1993,  0],
  [28, 'Dodgers',     'Los Angeles',   'CA', 'NL', 'West',    'Dodger Stadium',      56000, 1883,  7],
  [29, 'Padres',      'San Diego',     'CA', 'NL', 'West',    'Petco Park',          40162, 1969,  0],
  [30, 'Giants',      'San Francisco', 'CA', 'NL', 'West',    'Oracle Park',         41915, 1883,  8],
];

const FIRST_NAMES = ['Aaron','Alex','Anthony','Austin','Blake','Brady','Bryce','Carlos',
  'Chris','Cody','Cole','Corey','Daniel','David','Dylan','Eduardo','Eloy','Fernando',
  'Francisco','George','Hunter','Jake','James','Jason','Jeff','Joe','Jose','Josh',
  'Justin','Kyle','Luis','Marcus','Matt','Max','Michael','Miguel','Nathan','Nolan',
  'Oscar','Pete','Rafael','Randy','Ryan','Salvador','Sean','Shohei','Spencer','Stephen',
  'Thomas','Tim','Trevor','Tyler','Victor','Vladimir','Will','Xander','Zach','Ivan',
  'Roberto','Juan','Pedro','Ramon','Julio','Yordan','Bobby','Drew','Trea','Bo'];

const LAST_NAMES = ['Acuna','Adams','Albies','Anderson','Arenado','Betts','Brown',
  'Cabrera','Chapman','Cole','Contreras','Crawford','Cruz','Davis','Devers','Diaz',
  'Freeman','Garcia','Goldschmidt','Gonzalez','Gray','Guerrero','Harper','Harris',
  'Hayes','Hernandez','Hoskins','Jackson','Johnson','Judge','Kim','Kirk','Lux',
  'Machado','Martinez','McClanahan','Miller','Murphy','Ohtani','Perez','Phillips',
  'Ramirez','Realmuto','Riley','Rodriguez','Rutschman','Ryan','Schmidt','Seager',
  'Semien','Smith','Stanton','Strider','Suarez','Tatis','Thomas','Thompson','Torres',
  'Trout','Tucker','Turner','Valdez','Verlander','Walker','Ward','Webb','Wheeler',
  'Williams','Wilson','Witt','Yelich','Soto','Bichette','Springer','Olson','Nimmo',
  'McNeil','Lindor','Marte','Santander','Carroll','Varsho','Gallo','Pham','Bellinger'];

const POSITIONS = ['P','P','P','P','P','C','1B','2B','3B','SS','LF','CF','RF','DH'];
const STATES    = ['CA','TX','FL','NY','GA','OH','PA','IL','NC','MI','VA','AZ','TN','WA','CO'];
const WEATHER   = ['Clear','Sunny','Partly Cloudy','Cloudy','Overcast','Light Rain','Dome'];

// ── Schema DDL ────────────────────────────────────────────────────────────────

const DDL = `
CREATE TABLE teams (
  team_id            INTEGER PRIMARY KEY,
  name               TEXT    NOT NULL,
  city               TEXT    NOT NULL,
  state              TEXT    NOT NULL,
  league             TEXT    NOT NULL,
  division           TEXT    NOT NULL,
  stadium            TEXT    NOT NULL,
  capacity           INTEGER NOT NULL,
  founded            INTEGER NOT NULL,
  world_series_wins  INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE players (
  player_id      INTEGER PRIMARY KEY,
  first_name     TEXT    NOT NULL,
  last_name      TEXT    NOT NULL,
  position       TEXT    NOT NULL,
  team_id        INTEGER NOT NULL REFERENCES teams(team_id),
  jersey_number  INTEGER NOT NULL,
  bats           TEXT    NOT NULL,
  throws         TEXT    NOT NULL,
  height_inches  INTEGER NOT NULL,
  weight_lbs     INTEGER NOT NULL,
  birth_year     INTEGER NOT NULL,
  birth_state    TEXT    NOT NULL,
  debut_year     INTEGER NOT NULL,
  salary         INTEGER NOT NULL
);
CREATE TABLE games (
  game_id           INTEGER PRIMARY KEY,
  season            INTEGER NOT NULL,
  game_date         TEXT    NOT NULL,
  home_team_id      INTEGER NOT NULL REFERENCES teams(team_id),
  away_team_id      INTEGER NOT NULL REFERENCES teams(team_id),
  home_score        INTEGER NOT NULL,
  away_score        INTEGER NOT NULL,
  innings           INTEGER NOT NULL DEFAULT 9,
  attendance        INTEGER NOT NULL,
  weather           TEXT    NOT NULL,
  game_duration_min INTEGER NOT NULL
);
CREATE TABLE batting_stats (
  stat_id         INTEGER PRIMARY KEY,
  player_id       INTEGER NOT NULL REFERENCES players(player_id),
  team_id         INTEGER NOT NULL REFERENCES teams(team_id),
  season          INTEGER NOT NULL,
  games_played    INTEGER NOT NULL,
  at_bats         INTEGER NOT NULL,
  runs            INTEGER NOT NULL,
  hits            INTEGER NOT NULL,
  doubles         INTEGER NOT NULL,
  triples         INTEGER NOT NULL,
  home_runs       INTEGER NOT NULL,
  rbi             INTEGER NOT NULL,
  stolen_bases    INTEGER NOT NULL,
  caught_stealing INTEGER NOT NULL,
  walks           INTEGER NOT NULL,
  strikeouts      INTEGER NOT NULL,
  batting_avg     REAL    NOT NULL,
  on_base_pct     REAL    NOT NULL,
  slugging_pct    REAL    NOT NULL,
  ops             REAL    NOT NULL
);
CREATE TABLE pitching_stats (
  stat_id           INTEGER PRIMARY KEY,
  player_id         INTEGER NOT NULL REFERENCES players(player_id),
  team_id           INTEGER NOT NULL REFERENCES teams(team_id),
  season            INTEGER NOT NULL,
  wins              INTEGER NOT NULL,
  losses            INTEGER NOT NULL,
  games             INTEGER NOT NULL,
  games_started     INTEGER NOT NULL,
  complete_games    INTEGER NOT NULL,
  shutouts          INTEGER NOT NULL,
  saves             INTEGER NOT NULL,
  innings_pitched   REAL    NOT NULL,
  hits_allowed      INTEGER NOT NULL,
  earned_runs       INTEGER NOT NULL,
  home_runs_allowed INTEGER NOT NULL,
  walks             INTEGER NOT NULL,
  strikeouts        INTEGER NOT NULL,
  era               REAL    NOT NULL,
  whip              REAL    NOT NULL
);`;

// ── Data population ───────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildDatabase(db: any): void {
  const rng = new RNG();
  db.run(DDL);

  // teams
  db.run('BEGIN');
  for (const t of TEAMS) {
    db.run(`INSERT INTO teams VALUES (${t.map(() => '?').join(',')})`, t);
  }
  db.run('COMMIT');

  // players (~500)
  const players: { id: number; teamId: number; pos: string }[] = [];
  db.run('BEGIN');
  let pid = 1;
  for (let t = 1; t <= 30; t++) {
    const count = rng.int(16, 17);
    const usedNums = new Set<number>();
    for (let p = 0; p < count; p++) {
      const pos = POSITIONS[p < POSITIONS.length ? p : rng.int(0, POSITIONS.length - 1)];
      let jersey: number;
      do { jersey = rng.int(1, 99); } while (usedNums.has(jersey));
      usedNums.add(jersey);
      const birthYear = rng.int(1985, 2002);
      const salary = rng.int(720_000, pos === 'P' ? 45_000_000 : 50_000_000);
      db.run(
        'INSERT INTO players VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        [pid, rng.pick(FIRST_NAMES), rng.pick(LAST_NAMES), pos, t, jersey,
         rng.pick(['L','R','R','R','S']), rng.pick(['L','R','R','R']),
         rng.int(68, 78), rng.int(175, 255),
         birthYear, rng.pick(STATES),
         Math.min(birthYear + rng.int(18, 24), 2024), salary]
      );
      players.push({ id: pid, teamId: t, pos });
      pid++;
    }
  }
  db.run('COMMIT');

  // games (2430 × 2 seasons)
  const pairs: [number, number][] = [];
  for (let i = 1; i <= 30; i++)
    for (let j = i + 1; j <= 30; j++)
      pairs.push([i, j]);

  for (const season of [2023, 2024]) {
    db.run('BEGIN');
    let gid = season === 2023 ? 1 : 2431;
    let pairIdx = 0;
    for (let g = 0; g < 2430; g++) {
      const [a, b] = pairs[pairIdx % pairs.length];
      pairIdx++;
      const [home, away] = g % 2 === 0 ? [a, b] : [b, a];
      const dayOffset = Math.floor(g * 181 / 2430);
      const d = new Date(season, 3, 1);
      d.setDate(d.getDate() + dayOffset);
      const dateStr = d.toISOString().split('T')[0];
      const homeScore = rng.int(0, 12);
      const awayScore = rng.int(0, 11);
      const extra = rng.next() < 0.06 ? rng.int(1, 5) : 0;
      const cap = TEAMS[home - 1][7] as number;
      db.run('INSERT INTO games VALUES (?,?,?,?,?,?,?,?,?,?,?)',
        [gid++, season, dateStr, home, away, homeScore, awayScore,
         9 + extra, rng.int(Math.floor(cap * 0.5), cap),
         rng.pick(WEATHER), rng.int(155, 215)]);
    }
    db.run('COMMIT');
  }

  // batting_stats
  for (const season of [2023, 2024]) {
    db.run('BEGIN');
    let sid = season === 2023 ? 1 : 5000;
    for (const { id: pid2, teamId, pos } of players) {
      if (pos === 'P' && rng.next() > 0.15) continue;
      const gp = rng.int(pos === 'P' ? 20 : 90, pos === 'P' ? 80 : 162);
      const ab = Math.round(gp * (pos === 'P' ? rng.float(0.4, 1.2) : rng.float(2.5, 4.1)));
      if (ab < 10) continue;
      const ba   = pos === 'P' ? rng.float(0.100, 0.220) : rng.float(0.200, 0.340);
      const hits = Math.round(ab * ba);
      const hr   = pos === 'P' ? rng.int(0, 2) : rng.int(0, Math.round(ab * rng.float(0.01, 0.12)));
      const dbls = Math.round(hits * rng.float(0.12, 0.28));
      const trpl = Math.round(hits * rng.float(0.00, 0.04));
      const rbi  = Math.round(hr * rng.float(1.5, 3.5) + hits * rng.float(0.2, 0.5));
      const sb   = rng.int(0, 70);
      const cs   = Math.round(sb * rng.float(0.15, 0.40));
      const walks = Math.round(ab * rng.float(0.04, 0.18));
      const k    = Math.round(ab * rng.float(0.10, 0.33));
      const runs = Math.round(hits * rng.float(0.35, 0.75));
      const obp  = (hits + walks) / (ab + walks);
      const tb   = hits + dbls + 2 * trpl + 3 * hr;
      const slg  = tb / ab;
      db.run('INSERT INTO batting_stats VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        [sid++, pid2, teamId, season, gp, ab, runs, hits, dbls, trpl, hr, rbi, sb, cs, walks, k,
         Math.round(ba  * 1000) / 1000,
         Math.round(obp * 1000) / 1000,
         Math.round(slg * 1000) / 1000,
         Math.round((obp + slg) * 1000) / 1000]);
    }
    db.run('COMMIT');
  }

  // pitching_stats
  for (const season of [2023, 2024]) {
    db.run('BEGIN');
    let sid = season === 2023 ? 1 : 3000;
    for (const { id: pid3, teamId, pos } of players) {
      if (pos !== 'P') continue;
      const isStarter = rng.next() > 0.45;
      const gs     = isStarter ? rng.int(18, 34) : 0;
      const games  = isStarter ? gs + rng.int(0, 4) : rng.int(20, 72);
      const saves  = isStarter ? 0 : rng.int(0, 45);
      const ip     = isStarter
        ? Math.round(gs * rng.float(4.5, 7.2) * 3) / 3
        : Math.round(games * rng.float(0.8, 1.4) * 3) / 3;
      const ipFloor = Math.floor(ip) || 1;
      const wins   = Math.round(ip / rng.float(6, 14));
      const losses = Math.round(ip / rng.float(7, 18));
      const cg     = isStarter ? rng.int(0, 4) : 0;
      const era    = rng.float(1.80, 6.50);
      const er     = Math.round((era * ip) / 9);
      const k      = Math.round(rng.float(5.0, 14.5) * ip / 9);
      const bb     = Math.round(rng.float(1.5, 5.5) * ip / 9);
      const ha     = Math.round(ip * rng.float(0.65, 1.10));
      const hra    = Math.round(ip * rng.float(0.04, 0.18));
      db.run('INSERT INTO pitching_stats VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        [sid++, pid3, teamId, season, wins, losses, games, gs, cg,
         Math.min(cg, rng.int(0, 2)), saves, ip, ha, er, hra, bb, k,
         Math.round(era * 100) / 100,
         Math.round(((bb + ha) / ipFloor) * 100) / 100]);
    }
    db.run('COMMIT');
  }
}

// ── Output formatting ─────────────────────────────────────────────────────────

const MAX_DISPLAY_ROWS = 200;

function formatResult(columns: string[], values: unknown[][]): string {
  if (values.length === 0) return '(0 rows)';
  const display   = values.length > MAX_DISPLAY_ROWS ? values.slice(0, MAX_DISPLAY_ROWS) : values;
  const truncated = values.length > MAX_DISPLAY_ROWS;

  const widths = columns.map((c, ci) =>
    Math.min(40, Math.max(c.length, ...display.map(r => String(r[ci] ?? '').length)))
  );

  const sep  = '+' + widths.map(w => '-'.repeat(w + 2)).join('+') + '+';
  const head = '|' + columns.map((c, i) => ' ' + c.padEnd(widths[i]) + ' ').join('|') + '|';
  const body = display.map(row =>
    '|' + columns.map((c, i) => {
      const val = String(row[i] ?? '').slice(0, 40);
      return ' ' + val.padEnd(widths[i]) + ' ';
    }).join('|') + '|'
  );

  const lines = [sep, head, sep, ...body, sep];
  if (truncated)
    lines.push(`(showing first ${MAX_DISPLAY_ROWS} of ${values.length} rows — add LIMIT to narrow results)`);
  else
    lines.push(`(${values.length} row${values.length !== 1 ? 's' : ''})`);
  return lines.join('\n');
}

// ── Public entry point ────────────────────────────────────────────────────────

export async function runSQL(userSQL: string): Promise<ExecutionResult> {
  const start = Date.now();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let db: any = null;
  try {
    const SQL = await initSqlJs();
    db = new SQL.Database();
    buildDatabase(db);

    const stmts = userSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    if (stmts.length === 0) {
      return { stdout: '', stderr: 'No SQL statement found.', exitCode: 1, executionTime: Date.now() - start };
    }

    let stdout = '';
    for (const stmt of stmts) {
      const upper = stmt.trimStart().toUpperCase();
      if (!/^(SELECT|WITH|EXPLAIN|PRAGMA|VALUES)\b/.test(upper)) {
        return {
          stdout: '',
          stderr: `Only SELECT / WITH / EXPLAIN queries are allowed.\nReceived: ${stmt.slice(0, 60)}`,
          exitCode: 1,
          executionTime: Date.now() - start,
        };
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const results: { columns: string[]; values: unknown[][] }[] = db.exec(stmt);
      if (results.length === 0) {
        stdout += '(0 rows)\n';
      } else {
        for (const r of results) {
          stdout += formatResult(r.columns, r.values) + '\n';
        }
      }
    }

    return { stdout: stdout.trimEnd(), stderr: '', exitCode: 0, executionTime: Date.now() - start };

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { stdout: '', stderr: msg, exitCode: 1, executionTime: Date.now() - start };
  } finally {
    try { db?.close(); } catch { /* ignore */ }
  }
}
