#!/usr/bin/env node

import inquirer from 'inquirer';
import { Octokit } from '@octokit/core';
import dotenv from 'dotenv';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { execa } from 'execa';

dotenv.config();

const GITHUB_PAT = process.env.GITHUB_PAT;
const GITHUB_USERNAME = process.env.GITHUB_USERNAME || 'chad2302-alt';

if (!GITHUB_PAT) {
  console.error('Error: GITHUB_PAT not set in .env');
  process.exit(1);
}

const octokit = new Octokit({ auth: GITHUB_PAT });

// ────────────────────────────────────────────────
// CLI Arguments Parsing
// ────────────────────────────────────────────────
interface CliArgs {
  addFeature: string | null;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const result: CliArgs = { addFeature: null };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--add-feature' && args[i + 1]) {
      result.addFeature = args[i + 1];
      i++;
    }
  }

  return result;
}

// ────────────────────────────────────────────────
// Helper Functions
// ────────────────────────────────────────────────

// Helper: run command
function run(cmd: string, options: { cwd?: string; silent?: boolean } = {}) {
  try {
    execSync(cmd, { stdio: options.silent ? 'pipe' : 'inherit', ...options });
  } catch (err: any) {
    console.error(`Failed: ${cmd}`);
    console.error(err.message || err);
    process.exit(1);
  }
}

// Helper: run command and return output
function runCapture(cmd: string, options: { cwd?: string } = {}): string {
  try {
    return execSync(cmd, { encoding: 'utf8', ...options }).trim();
  } catch (err: any) {
    return '';
  }
}

// Check if project exists
function projectExists(projectName: string): boolean {
  const projectDir = path.join(process.cwd(), 'apps', projectName);
  return fs.existsSync(projectDir) && fs.existsSync(path.join(projectDir, '.git'));
}

// ────────────────────────────────────────────────
// Prompt Functions
// ────────────────────────────────────────────────

// Prompt user for new project
async function promptUser() {
  console.log('🚀 Ralph App Builder CLI\n');

  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'framework',
      message: 'Framework:',
      choices: ['Angular', 'Angular/Ionic'],
    },
    {
      type: 'input',
      name: 'projectName',
      message: 'Project name (kebab-case):',
      validate: (input) => /^[a-z0-9-]+$/.test(input) || 'lowercase, numbers, hyphens only',
    },
    {
      type: 'input',
      name: 'description',
      message: 'App description:',
    },
  ]);

  // Check if project exists and prompt for feature-add mode
  if (projectExists(answers.projectName)) {
    const { addFeatures } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'addFeatures',
        message: `Project "${answers.projectName}" already exists. Add new features to it?`,
        default: true,
      },
    ]);

    if (addFeatures) {
      return { ...answers, mode: 'add-feature' as const };
    } else {
      console.log('Aborting - project already exists.');
      process.exit(0);
    }
  }

  console.log(`\n→ ${answers.framework} • ${answers.projectName}`);
  console.log(`  ${answers.description}\n`);

  return { ...answers, mode: 'new' as const };
}

// Prompt for new feature description
async function promptForNewFeatures(): Promise<string> {
  const { featureDescription } = await inquirer.prompt([
    {
      type: 'input',
      name: 'featureDescription',
      message: 'Describe the new features to add:',
      validate: (input) => input.length > 10 || 'Please provide a detailed description',
    },
  ]);
  return featureDescription;
}

// Prompt to run Ralph loop
async function promptRunRalph(): Promise<boolean> {
  const { runRalph } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'runRalph',
      message: 'Run Ralph Wiggum loop to implement stories now?',
      default: true,
    },
  ]);
  return runRalph;
}

// ────────────────────────────────────────────────
// GitHub Operations
// ────────────────────────────────────────────────

// Create GitHub repo
async function createGitHubRepo(projectName: string, description: string): Promise<string> {
  const res = await octokit.request('POST /user/repos', {
    name: projectName,
    description: `AI-generated: ${description}`,
    private: false,
    auto_init: false,
  });
  const url = res.data.clone_url;
  console.log(`Repo created: ${url}`);
  return url;
}

// Get repo URL for existing project
function getRepoUrl(projectName: string): string {
  return `https://github.com/${GITHUB_USERNAME}/${projectName}.git`;
}

// ────────────────────────────────────────────────
// Project Scaffolding
// ────────────────────────────────────────────────

// Scaffold inside apps/
function scaffoldProject(framework: string, projectName: string) {
  const appsDir = path.join(process.cwd(), 'apps');
  if (!fs.existsSync(appsDir)) {
    fs.mkdirSync(appsDir);
  }

  const projectDir = path.join(appsDir, projectName);

  if (fs.existsSync(projectDir)) {
    console.error(`Folder already exists: apps/${projectName}`);
    process.exit(1);
  }

  const cmd =
    framework === 'Angular/Ionic'
      ? `npx ionic start ${projectName} blank --type=angular --capacitor --no-interactive --no-git`
      : `npx ng new ${projectName} --style=scss --routing --skip-git --defaults --no-interactive`;

  run(cmd, { cwd: appsDir });
  process.chdir(projectDir);
}

// ────────────────────────────────────────────────
// Git Operations
// ────────────────────────────────────────────────

// Git init/commit/push — skip if already git repo
function gitInitCommitAndPush(repoUrl: string, projectName: string, message: string) {
  const isGitRepo = fs.existsSync('.git');

  if (isGitRepo) {
    console.log('Already a git repo — pulling latest before commit...');
    run('git pull origin main --rebase || true');
  } else {
    run('git init');
    run(`git remote add origin ${repoUrl}`);
  }

  const pushUrl = `https://${GITHUB_USERNAME}:${GITHUB_PAT}@github.com/${GITHUB_USERNAME}/${projectName}.git`;
  run(`git remote set-url origin ${pushUrl}`);

  run('git add .');
  run(`git commit -m "${message}" || echo "No changes to commit"`);
  run('git branch -M main || true');
  run('git push -u origin main || git push origin main');

  run(`git remote set-url origin ${repoUrl}`);
}

// Simple git commit and push (for existing repos)
function gitCommitAndPush(message: string) {
  run('git add .');
  run(`git commit -m "${message}" || echo "No changes to commit"`);
  run('git push origin main || true');
}

// ────────────────────────────────────────────────
// Firebase Setup
// ────────────────────────────────────────────────

// Create Firebase project + placeholders
function createAndLinkFirebase(projectName: string): string {
  let projectId: string | undefined;
  const maxAttempts = 5;
  let attempt = 0;

  while (attempt < maxAttempts && !projectId) {
    attempt++;
    const suffix = Math.random().toString(36).substring(2, 8);
    const candidate = `${projectName}-${suffix}`.replace(/[^a-z0-9-]/g, '-').substring(0, 30);

    try {
      const list = execSync('npx firebase projects:list --non-interactive', { encoding: 'utf8' });
      if (list.includes(candidate)) continue;

      run(`npx firebase projects:create ${candidate} --non-interactive`);
      projectId = candidate;
    } catch (err: any) {
      if (err.message.includes('already exists') || err.message.includes('409')) continue;
      throw err;
    }
  }

  if (!projectId) throw new Error('Failed to create unique Firebase ID');

  // Placeholder files
  fs.writeFileSync('.firebaserc', JSON.stringify({ projects: { default: projectId } }, null, 2));

  fs.writeFileSync(
    'firebase.json',
    JSON.stringify(
      {
        hosting: {
          public: `dist/${projectName}`,
          ignore: ['firebase.json', '**/.*', '**/node_modules/**'],
          rewrites: [{ source: '**', destination: '/index.html' }],
        },
        firestore: {
          rules: 'firestore.rules',
          indexes: 'firestore.indexes.json',
        },
      },
      null,
      2
    )
  );

  fs.writeFileSync(
    'firestore.rules',
    '// Placeholder - Ralph will update\nservice cloud.firestore {\n  match /databases/{database}/documents {\n    match /{document=**} {\n      allow read, write: if false;\n    }\n  }\n}'
  );
  fs.writeFileSync('firestore.indexes.json', '{ "indexes": [] }');

  console.log(`Firebase project: ${projectId}`);
  console.log('Placeholder config files created');

  return projectId;
}

// ────────────────────────────────────────────────
// PRD Generation
// ────────────────────────────────────────────────

interface UserStory {
  id: number;
  title: string;
  description: string;
  acceptance: string[];
  passes: boolean;
}

interface PRD {
  title: string;
  overview: string;
  techStack: {
    framework: string;
    ui: string;
    styling: string;
    backend: string;
  };
  firebaseProjectId: string;
  userStories: UserStory[];
}

// Generate PRD with improved JSON structure
async function generatePRD(description: string, firebaseProjectId: string, framework: string): Promise<PRD | null> {
  console.log('\nGenerating PRD...');

  const techStack = framework === 'Angular/Ionic'
    ? 'Angular with Ionic, Capacitor for mobile, TailwindCSS, Firebase'
    : 'Angular, PrimeNG components, TailwindCSS, Firebase';

  const prdPrompt = `Generate concise PRD in Markdown.

Description: ${description}

Context:
- Framework: ${framework}
- Tech Stack: ${techStack}
- Firebase project ID: ${firebaseProjectId}
- Placeholder .firebaserc and firebase.json already exist
- Include Firebase setup notes (Auth, Firestore, Hosting)

Structure:
# Title
## Overview
## User Stories (6-10 small, actionable stories)
- As a [role], I want [feature] so that [benefit]
  - Acceptance: [list specific testable criteria]
## Tech Stack
## Firebase Notes

Output ONLY Markdown.`;

  try {
    const { stdout: md } = await execa('claude', ['-p', prdPrompt], { timeout: 120000 });
    fs.writeFileSync('prd.md', md.trim());
    console.log('→ prd.md created');

    const jsonPrompt = `Convert this PRD to Ralph JSON format.

${md}

Tech Stack Details:
- Framework: ${framework}
- Firebase Project ID: ${firebaseProjectId}

Output ONLY valid JSON in this exact format:
{
  "title": "App Name",
  "overview": "Brief description",
  "techStack": {
    "framework": "${framework}",
    "ui": "${framework === 'Angular/Ionic' ? 'Ionic' : 'PrimeNG'}",
    "styling": "TailwindCSS",
    "backend": "Firebase"
  },
  "firebaseProjectId": "${firebaseProjectId}",
  "userStories": [
    {
      "id": 1,
      "title": "Story Title",
      "description": "As a user, I want X so that Y",
      "acceptance": ["Criterion 1", "Criterion 2"],
      "passes": false
    }
  ]
}

All stories must have "passes": false. IDs should be sequential starting from 1.`;

    const { stdout: json } = await execa('claude', ['-p', jsonPrompt], { timeout: 90000 });

    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = json.trim();
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    const prd: PRD = JSON.parse(jsonStr);
    fs.writeFileSync('prd.json', JSON.stringify(prd, null, 2));
    console.log('→ prd.json created');

    return prd;
  } catch (err: any) {
    console.error('Claude failed:', err.message);
    return null;
  }
}

// Generate new stories to append to existing PRD
async function generateNewStories(featureDescription: string, existingPrd: PRD): Promise<UserStory[]> {
  console.log('\nGenerating new user stories...');

  const maxExistingId = Math.max(...existingPrd.userStories.map((s) => s.id), 0);

  const prompt = `Given an existing app, generate NEW user stories for additional features.

EXISTING APP:
- Title: ${existingPrd.title}
- Overview: ${existingPrd.overview}
- Tech Stack: ${JSON.stringify(existingPrd.techStack)}
- Existing Stories: ${existingPrd.userStories.map((s) => s.title).join(', ')}

NEW FEATURES TO ADD:
${featureDescription}

Generate 3-6 new user stories for these features.
IDs must start from ${maxExistingId + 1}.

Output ONLY valid JSON array:
[
  {
    "id": ${maxExistingId + 1},
    "title": "Story Title",
    "description": "As a user, I want X so that Y",
    "acceptance": ["Criterion 1", "Criterion 2"],
    "passes": false
  }
]`;

  try {
    const { stdout: json } = await execa('claude', ['-p', prompt], { timeout: 90000 });

    // Extract JSON from response
    let jsonStr = json.trim();
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    const newStories: UserStory[] = JSON.parse(jsonStr);
    console.log(`→ Generated ${newStories.length} new stories`);
    return newStories;
  } catch (err: any) {
    console.error('Failed to generate new stories:', err.message);
    return [];
  }
}

// ────────────────────────────────────────────────
// Ralph Wiggum Loop
// ────────────────────────────────────────────────

async function runRalphLoop(projectName: string) {
  console.log('\n🤖 Starting Ralph Wiggum loop...');
  console.log('This will iterate through stories and implement them via Claude CLI.\n');

  const scriptPath = path.join(__dirname, '../scripts/ralph.sh');

  // Verify script exists
  if (!fs.existsSync(scriptPath)) {
    console.error(`Ralph script not found at: ${scriptPath}`);
    console.log('You can run it manually: bash src/scripts/ralph.sh');
    return;
  }

  try {
    await execa('bash', [scriptPath], {
      stdio: 'inherit',
      cwd: process.cwd(),
      env: { ...process.env },
    });
    console.log('\n✅ Ralph Wiggum loop completed!');
  } catch (err: any) {
    console.error('\nRalph loop encountered an error:', err.message);
    console.log('You can resume manually: bash src/scripts/ralph.sh');
  }
}

// ────────────────────────────────────────────────
// Feature-Add Mode
// ────────────────────────────────────────────────

async function addFeatureMode(projectName: string, newDescription?: string) {
  console.log(`\n📦 Feature-add mode for: ${projectName}`);

  const projectDir = path.join(process.cwd(), 'apps', projectName);

  if (!fs.existsSync(projectDir)) {
    console.error(`Project not found: apps/${projectName}`);
    process.exit(1);
  }

  // Change to project directory
  process.chdir(projectDir);
  console.log(`Working in: ${projectDir}`);

  // Pull latest
  console.log('\nPulling latest changes...');
  try {
    run('git pull origin main --rebase', { silent: true });
  } catch {
    console.log('Could not pull - continuing with local state');
  }

  // Check for existing prd.json
  if (!fs.existsSync('prd.json')) {
    console.error('No prd.json found in project. Cannot add features.');
    process.exit(1);
  }

  // Read existing PRD
  const existingPrd: PRD = JSON.parse(fs.readFileSync('prd.json', 'utf8'));
  console.log(`\nExisting PRD: ${existingPrd.title}`);
  console.log(`Current stories: ${existingPrd.userStories.length}`);

  // Get feature description if not provided
  const featureDescription = newDescription || (await promptForNewFeatures());

  // Generate new stories
  const newStories = await generateNewStories(featureDescription, existingPrd);

  if (newStories.length === 0) {
    console.log('No new stories generated. Exiting.');
    return;
  }

  // Append new stories to PRD
  existingPrd.userStories.push(...newStories);
  fs.writeFileSync('prd.json', JSON.stringify(existingPrd, null, 2));
  console.log(`\nUpdated prd.json with ${newStories.length} new stories`);

  // Commit updated PRD
  gitCommitAndPush(`feat: Added ${newStories.length} new feature stories to PRD`);

  // Ask to run Ralph
  const shouldRunRalph = await promptRunRalph();

  if (shouldRunRalph) {
    await runRalphLoop(projectName);
  } else {
    console.log('\nTo implement stories later, run:');
    console.log(`  cd apps/${projectName} && bash ../../src/scripts/ralph.sh`);
  }
}

// ────────────────────────────────────────────────
// Main Entry Point
// ────────────────────────────────────────────────

async function main() {
  const cliArgs = parseArgs();

  // Handle --add-feature flag
  if (cliArgs.addFeature) {
    await addFeatureMode(cliArgs.addFeature);
    return;
  }

  // Interactive mode
  const { framework, projectName, description, mode } = await promptUser();

  // Handle feature-add mode (detected existing project)
  if (mode === 'add-feature') {
    await addFeatureMode(projectName, description);
    return;
  }

  // New project mode
  const repoUrl = await createGitHubRepo(projectName, description);
  scaffoldProject(framework, projectName);

  gitInitCommitAndPush(repoUrl, projectName, 'Initial scaffold');

  const firebaseProjectId = createAndLinkFirebase(projectName);

  const prd = await generatePRD(description, firebaseProjectId, framework);

  gitInitCommitAndPush(repoUrl, projectName, 'Added PRD + Firebase placeholders');

  console.log('\n✅ Project setup complete!');
  console.log(`Repo: ${repoUrl}`);
  console.log(`Path: apps/${projectName}`);
  console.log(`Firebase: ${firebaseProjectId}`);

  if (prd) {
    console.log(`\nPRD: ${prd.title}`);
    console.log(`Stories: ${prd.userStories.length}`);
  }

  // Ask to run Ralph loop
  const shouldRunRalph = await promptRunRalph();

  if (shouldRunRalph) {
    await runRalphLoop(projectName);
  } else {
    console.log('\nTo implement stories later, run:');
    console.log(`  cd apps/${projectName} && bash ../../src/scripts/ralph.sh`);
  }

  console.log('\nDone!');
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
