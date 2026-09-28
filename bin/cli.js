#!/usr/bin/env node
// unofficial-figma-mcp CLI.
//
//   unofficial-figma-mcp                   start the MCP server (stdio + ws bridge)
//   unofficial-figma-mcp install-plugin    register the plugin in Figma desktop
//   unofficial-figma-mcp uninstall-plugin  remove it again
//   unofficial-figma-mcp plugin-path       print where the plugin files live

import { execFileSync, spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PLUGIN_ID = 'unofficial-figma-mcp-local';
// Earlier releases shipped as open-figma-mcp; clean those up so Figma does not
// list the plugin twice.
const LEGACY_PLUGIN_IDS = ['open-figma-mcp-local'];
const LEGACY_HOME_DIR = join(homedir(), '.open-figma-mcp');
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC_PLUGIN_DIR = join(ROOT, 'plugin');
const HOME_DIR = join(homedir(), '.unofficial-figma-mcp');
const PLUGIN_DIR = process.env.UNOFFICIAL_FIGMA_MCP_PLUGIN_DIR || join(HOME_DIR, 'plugin');
const PLUGIN_FILES = ['manifest.json', 'code.js', 'ui.html'];

const out = (...a) => console.log(...a);
const fail = (msg) => {
  console.error('error: ' + msg);
  process.exit(1);
};

// ------------------------------------------------------------ figma desktop

function settingsPath() {
  if (process.env.FIGMA_SETTINGS_PATH) return process.env.FIGMA_SETTINGS_PATH;
  switch (platform()) {
    case 'darwin':
      return join(homedir(), 'Library', 'Application Support', 'Figma', 'settings.json');
    case 'win32':
      return join(process.env.APPDATA || join(homedir(), 'AppData', 'Roaming'), 'Figma', 'settings.json');
    default:
      return null;
  }
}

function figmaRunning() {
  try {
    if (platform() === 'darwin') {
      execFileSync('pgrep', ['-x', 'Figma'], { stdio: 'ignore' });
      return true;
    }
    if (platform() === 'win32') {
      const list = execFileSync('tasklist', ['/FI', 'IMAGENAME eq Figma.exe', '/NH'], { encoding: 'utf8' });
      return /Figma\.exe/i.test(list);
    }
  } catch {
    return false;
  }
  return false;
}

async function quitFigma() {
  if (!figmaRunning()) return false;
  out('Figma is running — quitting it so the settings file can be updated…');
  if (platform() === 'darwin') {
    execFileSync('osascript', ['-e', 'tell application "Figma" to quit'], { stdio: 'ignore' });
  } else if (platform() === 'win32') {
    execFileSync('taskkill', ['/IM', 'Figma.exe'], { stdio: 'ignore' });
  }
  for (let i = 0; i < 40 && figmaRunning(); i++) {
    await new Promise((r) => setTimeout(r, 250));
  }
  if (figmaRunning()) fail('Figma did not quit. Close it manually and rerun.');
  return true;
}

function launchFigma() {
  out('Relaunching Figma…');
  const child =
    platform() === 'darwin'
      ? spawn('open', ['-a', 'Figma'], { stdio: 'ignore', detached: true })
      : spawn('cmd', ['/c', 'start', '', 'figma://'], { stdio: 'ignore', detached: true });
  child.unref();
}

function readSettings(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    fail(`could not read ${path}: ${e.message}`);
  }
}

function writeSettings(path, data) {
  const backup = path + '.bak-unofficial-figma-mcp';
  cpSync(path, backup);
  writeFileSync(path, JSON.stringify(data));
  out(`Backup written to ${backup}`);
}

// Drop every entry belonging to our plugin (current or legacy id): the
// manifest row plus any code/ui rows that point back at it.
function stripPlugin(entries) {
  const ids = new Set([PLUGIN_ID, ...LEGACY_PLUGIN_IDS]);
  const manifestIds = new Set(
    entries.filter((e) => ids.has(e.lastKnownPluginId)).map((e) => e.id),
  );
  return entries.filter(
    (e) => !manifestIds.has(e.id) && !manifestIds.has(e.fileMetadata?.manifestFileId),
  );
}

function manualInstructions() {
  out('');
  out('Register it manually instead:');
  out('  Figma desktop → Plugins → Development → Import plugin from manifest…');
  out(`  → choose ${join(PLUGIN_DIR, 'manifest.json')}`);
}

// ------------------------------------------------------------ commands

function copyPlugin() {
  mkdirSync(PLUGIN_DIR, { recursive: true });
  for (const f of PLUGIN_FILES) cpSync(join(SRC_PLUGIN_DIR, f), join(PLUGIN_DIR, f));
  out(`Plugin files copied to ${PLUGIN_DIR}`);
}

async function installPlugin(flags) {
  copyPlugin();

  const path = settingsPath();
  if (!path || !existsSync(path)) {
    out(path ? `Figma settings not found at ${path}.` : 'Figma desktop is not available on this platform.');
    out('Open Figma desktop at least once, then rerun — or register manually.');
    manualInstructions();
    return;
  }

  const wasRunning = flags.noQuit ? false : await quitFigma();
  if (figmaRunning()) {
    out('Figma is still running; it would overwrite the change on exit.');
    manualInstructions();
    return;
  }

  const settings = readSettings(path);
  const entries = stripPlugin(Array.isArray(settings.localFileExtensions) ? settings.localFileExtensions : []);
  const nextId = entries.reduce((m, e) => Math.max(m, Number(e.id) || 0), 0) + 1;
  const manifest = JSON.parse(readFileSync(join(PLUGIN_DIR, 'manifest.json'), 'utf8'));
  const [manifestId, codeId, uiId] = [nextId, nextId + 1, nextId + 2];

  entries.push(
    {
      id: manifestId,
      manifestPath: join(PLUGIN_DIR, 'manifest.json'),
      lastKnownName: manifest.name,
      lastKnownPluginId: manifest.id,
      fileMetadata: { type: 'manifest', codeFileId: codeId, uiFileIds: [uiId] },
      cachedContainsWidget: false,
    },
    { id: codeId, manifestPath: join(PLUGIN_DIR, manifest.main), fileMetadata: { type: 'code', manifestFileId: manifestId } },
    { id: uiId, manifestPath: join(PLUGIN_DIR, manifest.ui), fileMetadata: { type: 'ui', manifestFileId: manifestId } },
  );
  settings.localFileExtensions = entries;
  writeSettings(path, settings);

  out(`Registered "${manifest.name}" in Figma → Plugins → Development.`);
  if (existsSync(LEGACY_HOME_DIR) && !process.env.UNOFFICIAL_FIGMA_MCP_PLUGIN_DIR) {
    rmSync(LEGACY_HOME_DIR, { recursive: true, force: true });
    out(`Removed the old Open Figma MCP plugin at ${LEGACY_HOME_DIR}`);
  }
  if (wasRunning && !flags.noRelaunch) launchFigma();
  out('');
  out('Next: add the MCP server to your client, e.g.');
  out('  claude mcp add unofficial-figma-mcp --scope user -- unofficial-figma-mcp');
  out('  cmd mcp add --scope user unofficial-figma-mcp -- unofficial-figma-mcp');
}

async function uninstallPlugin(flags) {
  const path = settingsPath();
  if (path && existsSync(path)) {
    const wasRunning = flags.noQuit ? false : await quitFigma();
    if (figmaRunning()) fail('Figma is still running; close it and rerun.');
    const settings = readSettings(path);
    const before = settings.localFileExtensions?.length ?? 0;
    settings.localFileExtensions = stripPlugin(settings.localFileExtensions || []);
    if (settings.localFileExtensions.length !== before) {
      writeSettings(path, settings);
      out('Removed plugin from Figma → Plugins → Development.');
    } else {
      out('Plugin was not registered in Figma.');
    }
    if (wasRunning && !flags.noRelaunch) launchFigma();
  }
  if (existsSync(PLUGIN_DIR)) {
    rmSync(PLUGIN_DIR, { recursive: true, force: true });
    out(`Deleted ${PLUGIN_DIR}`);
  }
}

function usage() {
  out(`unofficial-figma-mcp

  unofficial-figma-mcp                   start the MCP server (used by your MCP client)
  unofficial-figma-mcp install-plugin    copy the plugin to ~/.unofficial-figma-mcp and register it in Figma desktop
  unofficial-figma-mcp uninstall-plugin  unregister and delete it
  unofficial-figma-mcp plugin-path       print the plugin directory

Flags for install/uninstall:
  --no-quit       do not quit Figma automatically (you must close it first)
  --no-relaunch   do not reopen Figma afterwards`);
}

// ------------------------------------------------------------ main

const [cmd, ...rest] = process.argv.slice(2);
const flags = {
  noQuit: rest.includes('--no-quit'),
  noRelaunch: rest.includes('--no-relaunch'),
};

switch (cmd) {
  case undefined:
  case 'serve':
    await import('../mcp/server.js');
    break;
  case 'install-plugin':
    await installPlugin(flags);
    break;
  case 'uninstall-plugin':
    await uninstallPlugin(flags);
    break;
  case 'plugin-path':
    out(PLUGIN_DIR);
    break;
  case '-h':
  case '--help':
  case 'help':
    usage();
    break;
  default:
    usage();
    process.exit(1);
}
