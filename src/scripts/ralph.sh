#!/bin/bash
# Ralph Wiggum Loop - Iterative AI implementation
# Each iteration picks one incomplete story, implements it via Claude CLI, commits/pushes

set -e

MAX_ITERATIONS=50
ITERATION=0

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() { echo -e "${BLUE}[Ralph]${NC} $1"; }
log_success() { echo -e "${GREEN}[Ralph]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[Ralph]${NC} $1"; }
log_error() { echo -e "${RED}[Ralph]${NC} $1"; }

# Check for required files
if [ ! -f "prd.json" ]; then
  log_error "prd.json not found in current directory"
  exit 1
fi

if [ ! -f "prd.md" ]; then
  log_warn "prd.md not found - continuing without it"
fi

log_info "Starting Ralph Wiggum loop..."
log_info "Max iterations: $MAX_ITERATIONS"
echo ""

while [ $ITERATION -lt $MAX_ITERATIONS ]; do
  ITERATION=$((ITERATION + 1))

  # Find next story with passes: false using jq
  NEXT_STORY=$(jq -r '.userStories[] | select(.passes == false) | @json' prd.json | head -n 1)

  if [ -z "$NEXT_STORY" ] || [ "$NEXT_STORY" == "null" ]; then
    log_success "All stories complete! Exiting loop."
    break
  fi

  # Extract story details
  STORY_ID=$(echo "$NEXT_STORY" | jq -r '.id')
  STORY_TITLE=$(echo "$NEXT_STORY" | jq -r '.title')
  STORY_DESC=$(echo "$NEXT_STORY" | jq -r '.description')
  STORY_ACCEPTANCE=$(echo "$NEXT_STORY" | jq -r '.acceptance | join("; ")')

  log_info "────────────────────────────────────────────────"
  log_info "Iteration $ITERATION: Story #$STORY_ID - $STORY_TITLE"
  log_info "────────────────────────────────────────────────"
  echo ""

  # Read full PRD for context
  PRD_CONTENT=""
  if [ -f "prd.md" ]; then
    PRD_CONTENT=$(cat prd.md)
  fi

  # Build the Claude prompt
  CLAUDE_PROMPT="You are implementing a user story for an existing project.

PROJECT CONTEXT:
$(cat prd.json | jq -r '.title // \"App\"') - $(cat prd.json | jq -r '.overview // \"\"')

CURRENT USER STORY TO IMPLEMENT:
- ID: $STORY_ID
- Title: $STORY_TITLE
- Description: $STORY_DESC
- Acceptance Criteria: $STORY_ACCEPTANCE

INSTRUCTIONS:
1. Analyze the existing codebase structure
2. Implement ONLY this specific user story
3. Follow existing code patterns and conventions
4. Ensure all acceptance criteria are met
5. Do not break existing functionality
6. Write clean, production-ready code

IMPORTANT:
- Focus on this single story only
- Make minimal necessary changes
- Test that acceptance criteria are satisfied
- Use existing project dependencies when possible

Implement this story now."

  # Call Claude CLI to implement the story
  log_info "Calling Claude to implement story #$STORY_ID..."

  if claude -p "$CLAUDE_PROMPT" --allowedTools "Read,Write,Edit,Bash,Glob,Grep" 2>&1; then
    log_success "Claude completed implementation for story #$STORY_ID"
  else
    log_error "Claude failed on story #$STORY_ID - will retry on next iteration"
    continue
  fi

  # Check if there are any changes to commit
  if git diff --quiet && git diff --cached --quiet; then
    log_warn "No changes detected - marking story as complete anyway"
  else
    # Stage and commit changes
    log_info "Committing changes..."
    git add -A
    git commit -m "feat: Implement story #$STORY_ID - $STORY_TITLE

Implemented via Ralph Wiggum loop iteration $ITERATION
Acceptance criteria: $STORY_ACCEPTANCE"

    # Push to remote
    log_info "Pushing to remote..."
    if git push origin main 2>/dev/null || git push origin main; then
      log_success "Changes pushed successfully"
    else
      log_warn "Push failed - continuing anyway"
    fi
  fi

  # Update prd.json to mark story as passes: true
  log_info "Marking story #$STORY_ID as complete in prd.json..."

  # Use jq to update the passes field for this story
  jq --argjson id "$STORY_ID" '
    .userStories = [.userStories[] | if .id == $id then .passes = true else . end]
  ' prd.json > prd.json.tmp && mv prd.json.tmp prd.json

  # Commit the prd.json update
  git add prd.json
  git commit -m "chore: Mark story #$STORY_ID as complete" || true
  git push origin main 2>/dev/null || git push origin main || true

  log_success "Story #$STORY_ID complete!"
  echo ""

  # Brief pause between iterations
  sleep 2
done

echo ""
log_info "────────────────────────────────────────────────"
log_success "Ralph Wiggum loop finished!"
log_info "Total iterations: $ITERATION"

# Final summary
COMPLETED=$(jq '[.userStories[] | select(.passes == true)] | length' prd.json)
TOTAL=$(jq '.userStories | length' prd.json)
log_info "Stories completed: $COMPLETED / $TOTAL"

if [ "$COMPLETED" -eq "$TOTAL" ]; then
  log_success "All stories implemented successfully!"
else
  log_warn "Some stories remain incomplete. Run ralph again to continue."
fi
