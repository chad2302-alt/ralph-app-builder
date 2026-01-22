#!/usr/bin/env node

import inquirer from 'inquirer';
import { Octokit } from '@octokit/core';
import dotenv from 'dotenv';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

dotenv.config();

const GITHUB_PAT = process.env.GITHUB_PAT;

if (!GITHUB_PAT) {
  console.error('Error: GITHUB_PAT not set in .env');
  process.exit(1);
}

const octokit = new Octokit({ auth: GITHUB_PAT });

async function main() {
  console.log('🚀 Ralph App Builder CLI - Starting new project generation...');

  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'framework',
      message: 'Choose framework:',
      choices: ['Angular', 'Angular/Ionic'],
    },
    {
      type: 'input',
      name: 'projectName',
      message: 'Project name (kebab-case recommended):',
      validate: (input) => /^[a-z0-9-]+$/.test(input) || 'Use lowercase letters, numbers, hyphens only',
    },
    {
      type: 'input',
      name: 'description',
      message: 'Describe the app in detail (this will feed the PRD):',
    },
  ]);

  const { framework, projectName, description } = answers;

  console.log(`\nCreating ${framework} project: ${projectName}`);
  console.log(`Description: ${description}`);

  // Step: Create GitHub repo
  let repoUrl: string;
  try {
    const response = await octokit.request('POST /user/repos', {
      name: projectName,
      description: `AI-generated ${framework} app: ${description}`,
      private: false, // change to true if desired
      auto_init: true, // creates initial commit
    });
    repoUrl = response.data.clone_url;
    console.log(`✅ GitHub repo created: ${repoUrl}`);
  } catch (err: any) {
    console.error('GitHub repo creation failed:', err.message);
    if (err.status === 422) console.error('Repo name might already exist—choose another.');
    process.exit(1);
  }

  // Step: Scaffold the Angular project locally
  const scaffoldCmd = framework === 'Angular/Ionic'
    ? `npx ionic start ${projectName} blank --type=angular --capacitor --no-interactive --no-git`
    : `npx ng new ${projectName} --style=scss --routing --skip-git --defaults --no-interactive`;

  console.log(`Scaffolding ${framework} project...`);
  execSync(scaffoldCmd, { stdio: 'inherit' });

  // Move into the project dir
  process.chdir(projectName);

  // Init git, add remote, commit scaffold, push
  execSync('git init', { stdio: 'inherit' });
  execSync(`git remote add origin ${repoUrl}`, { stdio: 'inherit' });
  execSync('git add .', { stdio: 'inherit' });
  execSync('git commit -m "Initial scaffold: Angular/Ionic project setup"', { stdio: 'inherit' });
  execSync('git branch -M main', { stdio: 'inherit' });
  execSync('git push -u origin main', { stdio: 'inherit' });

  console.log(`\nProject scaffolded and pushed to GitHub!`);
  console.log('Next: We\'ll add PRD generation, Firebase setup, and Ralph loop.');

  // Placeholder for next steps
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});