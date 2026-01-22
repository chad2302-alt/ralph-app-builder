# Ralph App Builder

CLI tool that automates creation of Angular/Ionic + Firebase apps using the **Ralph Wiggum technique** - an iterative AI-driven development approach where Claude Code implements user stories one at a time with fresh context per iteration.

## Features

- **Automated Project Scaffolding** - Creates Angular or Angular/Ionic projects with proper structure
- **GitHub Integration** - Automatically creates and pushes to a new GitHub repository
- **Firebase Setup** - Creates Firebase project with placeholder configs for Auth, Firestore, and Hosting
- **PRD Generation** - Uses Claude to generate Product Requirements Document with user stories
- **Ralph Wiggum Loop** - Iteratively implements each user story via Claude CLI calls
- **Feature-Add Mode** - Add new features to existing projects by appending stories to PRD

## Prerequisites

- Node.js 18+
- [Claude Code CLI](https://github.com/anthropics/claude-code) installed and authenticated
- GitHub Personal Access Token
- Firebase CLI authenticated (`firebase login`)
- `jq` command-line tool (for ralph.sh)

## Installation

```bash
git clone https://github.com/chad2302-alt/ralph-app-builder.git
cd ralph-app-builder
npm install
```

## Configuration

Create a `.env` file in the project root:

```env
GITHUB_PAT=your_github_personal_access_token
GITHUB_USERNAME=your_github_username
```

## Usage

### Create a New Project

```bash
npm run start
# or
npm run create
```

You'll be prompted for:
1. **Framework** - Angular or Angular/Ionic
2. **Project name** - Must be kebab-case (e.g., `my-awesome-app`)
3. **App description** - Describe what the app should do

The CLI will then:
1. Create a GitHub repository
2. Scaffold the project in `apps/{project-name}/`
3. Initialize git and push initial commit
4. Create a Firebase project with placeholder configs
5. Generate `prd.md` and `prd.json` via Claude
6. Ask if you want to run the Ralph Wiggum loop

### Add Features to Existing Project

**Interactive:**
```bash
npm run start
# Enter an existing project name - you'll be prompted to add features
```

**Direct:**
```bash
npm run add-feature my-existing-app
```

This will:
1. Pull latest changes from the repository
2. Read existing `prd.json`
3. Generate new user stories via Claude
4. Append stories to `prd.json`
5. Commit and push the updated PRD
6. Optionally run Ralph loop on new stories

### Run Ralph Loop Manually

From a project directory with `prd.json`:

```bash
cd apps/my-app
bash ../../src/scripts/ralph.sh
```

Or from the ralph-app-builder root:

```bash
npm run ralph  # (must cd to project dir first)
```

## The Ralph Wiggum Technique

The core innovation is the **iterative, fresh-context approach**:

1. **Read** `prd.json` to find the next story with `passes: false`
2. **Call** `claude -p` with context about that specific story
3. **Implement** the story (Claude has fresh context, avoiding overflow)
4. **Commit** changes with a descriptive message
5. **Push** to remote repository
6. **Update** `prd.json` to mark story as `passes: true`
7. **Repeat** until all stories are complete (max 50 iterations)

### Why "Ralph Wiggum"?

Like Ralph from The Simpsons who takes things one step at a time with simple, direct focus - this technique breaks complex app development into small, manageable stories that AI can implement with fresh context each iteration.

## Project Structure

```
ralph-app-builder/
├── src/
│   ├── bin/
│   │   └── create-app.ts    # Main CLI entry point
│   └── scripts/
│       └── ralph.sh         # Ralph Wiggum loop bash script
├── apps/                    # Generated projects go here
│   └── {project-name}/
│       ├── prd.md           # Human-readable PRD
│       ├── prd.json         # Machine-readable PRD with stories
│       ├── .firebaserc      # Firebase project config
│       ├── firebase.json    # Firebase services config
│       └── ...              # Angular/Ionic project files
├── package.json
├── tsconfig.json
└── .env                     # Your credentials (not committed)
```

## PRD JSON Format

The `prd.json` file tracks implementation progress:

```json
{
  "title": "My App",
  "overview": "A brief description of the app",
  "techStack": {
    "framework": "Angular",
    "ui": "PrimeNG",
    "styling": "TailwindCSS",
    "backend": "Firebase"
  },
  "firebaseProjectId": "my-app-abc123",
  "userStories": [
    {
      "id": 1,
      "title": "User Authentication",
      "description": "As a user, I want to sign in so that I can access my data",
      "acceptance": [
        "Can sign in with email/password",
        "Session persists across browser refresh",
        "Can sign out"
      ],
      "passes": false
    }
  ]
}
```

- Stories with `passes: false` are pending implementation
- Stories with `passes: true` have been implemented
- The Ralph loop processes stories in order by ID

## NPM Scripts

| Script | Description |
|--------|-------------|
| `npm run start` | Run the CLI (interactive mode) |
| `npm run create` | Alias for start |
| `npm run add-feature <name>` | Add features to existing project |
| `npm run ralph` | Run Ralph loop (from project directory) |

## Tech Stack (Generated Projects)

**Angular projects include:**
- Angular with routing and SCSS
- PrimeNG component library
- TailwindCSS for styling
- Firebase (Auth, Firestore, Hosting)

**Angular/Ionic projects include:**
- Angular with Ionic Framework
- Capacitor for native mobile
- TailwindCSS for styling
- Firebase (Auth, Firestore, Hosting)

## Troubleshooting

### Claude CLI not found
Ensure Claude Code is installed and in your PATH:
```bash
which claude
claude --version
```

### GitHub authentication fails
Verify your PAT has `repo` scope and is correctly set in `.env`

### Firebase project creation fails
Ensure you're logged in: `firebase login`

### Ralph loop stops unexpectedly
- Check for errors in the Claude output
- Verify `jq` is installed: `which jq`
- Resume by running `ralph.sh` again - it picks up where it left off

## License

ISC
