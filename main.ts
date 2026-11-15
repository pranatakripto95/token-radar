// Ember Radar's entry for token-radar-01 (Node 22, standard library only).
//
// What it does, end to end:
//   1. reads the sealed snapshot (/input/snapshot.json, or --input <file|dir>),
//   2. scores every rankable pre-token protocol with the model in lib/model.ts,
//   3. writes the ranked board to /output/board.json and the dashboard's data to /output/data.js,
//   4. copies this repository's dashboard/ and screenshots/ into /output,
//   5. writes /output/dossier.json, the summary the judge reads, with the vendored make.fun library.
//
// The dashboard is a static page with no framework and no network: dashboard/index.html,
// dashboard/app.css and dashboard/app.js read /output/data.js, which step 3 writes from the same
// board the gate checks. The board ranks every rankable pre-token protocol below the floor, states
// its model in the page, and gives every protocol a farm plan.
//
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boardIssue, buildRadar, dataScript, parseSnapshot } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

const here = fileURLToPath(new URL('.', import.meta.url));

/** The scorer's own caps: the text cap shapes the dossier's bytes, the rest refuse outright. */
const TEXT_MAX_BYTES = 65_536;
const SCREENSHOT_CAPS = { max: 4, max_bytes: 524_288 };
const IMAGE_NAME = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;

/** The command line's options: --input (default /input) and --output (default $MAKEFUN_OUTPUT_DIR, else /output). */
function parseArgs(argv: string[]): { input: string; output: string } {
  const pick = (name: string, fallback: string): string => {
    const at = argv.indexOf(`--${name}`);
    if (at >= 0 && at + 1 < argv.length) return argv[at + 1]!;
    const eq = argv.find((a) => a.startsWith(`--${name}=`));
    return eq === undefined ? fallback : eq.slice(name.length + 3);
  };
  return {
    input: pick('input', '/input'),
    output: pick('output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output'),
  };
}

/** The snapshot file out of --input, which names either the file itself or its directory. */
function snapshotPath(inputArg: string): string {
  return inputArg.endsWith('.json') ? inputArg : join(inputArg, 'snapshot.json');
}

/** The snapshot's text, read and parsed, or an exit with the reason on stderr. */
function readSnapshot(path: string) {
  if (!existsSync(path)) {
    process.stderr.write(`token radar: no snapshot at ${path}: pass --input <snapshot.json|directory> or mount the sealed /input\n`);
    process.exit(2);
  }
  return parseSnapshot(readFileSync(path, 'utf8'));
}

/** board.json and data.js, the two files the gate and the dashboard both read. */
function writeBoard(outDir: string, board: ReturnType<typeof buildRadar>['board'], radar: ReturnType<typeof buildRadar>['radar']): void {
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'board.json'), `${JSON.stringify({ rows: board })}\n`);
  writeFileSync(join(outDir, 'data.js'), dataScript(radar));
}

/** One directory's regular files into `to`, skipping names that start with a dot. Returns the names copied. */
function copyDir(from: string, to: string): string[] {
  if (!existsSync(from)) return [];
  mkdirSync(to, { recursive: true });
  const copied: string[] = [];
  for (const name of readdirSync(from)) {
    if (name.startsWith('.')) continue;
    const path = join(from, name);
    if (!statSync(path).isFile()) continue;
    copyFileSync(path, join(to, name));
    copied.push(name);
  }
  return copied;
}

/** A screenshot name the dossier accepts, or an exit naming the bad one. */
function checkShotNames(names: string[]): void {
  for (const name of names) {
    if (!IMAGE_NAME.test(name)) {
      process.stderr.write(`token radar: screenshots/${name}: a name is letters, digits and . _ -, 1 to 128 characters\n`);
      process.exit(1);
    }
  }
}

function main(): void {
  const { input, output } = parseArgs(process.argv);
  const snapshot = readSnapshot(snapshotPath(input));
  const { board, radar } = buildRadar(snapshot);

  // The board is refused by the gate unless it covers the watchlist, ranks 1..N in implied-value
  // order and gives every row a farm plan: check that here, before writing anything.
  const issue = boardIssue(board, snapshot);
  if (issue !== null) {
    process.stderr.write(`token radar: the model wrote a board the gate refuses: ${issue}\n`);
    process.exit(1);
  }

  writeBoard(output, board, radar);
  const dashFiles = copyDir(join(here, 'dashboard'), join(output, 'dashboard'));
  const shots = copyDir(join(here, 'screenshots'), join(output, 'screenshots'));
  if (shots.length < 3) {
    process.stderr.write(`token radar: screenshots/ holds ${shots.length} image${shots.length === 1 ? '' : 's'}: hand in 3, the board, a detail view and a filtered view\n`);
    process.exit(1);
  }
  checkShotNames(shots);

  // The dossier is written last: the scorer rebuilds it from this /output and compares bytes.
  writeFileSync(
    join(output, 'dossier.json'),
    buildDossier(output, { text_max_bytes: TEXT_MAX_BYTES, screenshots: SCREENSHOT_CAPS, dashboard: { max_files: 400, max_bytes: 4_194_304 } }),
  );

  process.stdout.write(
    `token radar: ${snapshot.protocols.length} protocols, ${snapshot.watchlist.length} on the watchlist, ${board.length} rows scored (${radar.early_size} early, ${radar.live_size} live set aside)\n` +
      `token radar: wrote ${join(output, 'board.json')}, ${join(output, 'data.js')}, ${join(output, 'dashboard')} (${dashFiles.length} files), ${join(output, 'screenshots')} (${shots.length} images) and ${join(output, 'dossier.json')}\n`,
  );
}

main();
