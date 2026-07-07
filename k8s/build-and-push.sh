#!/usr/bin/env bash
set -euo pipefail

# Build and push the AI Route Optimization Engine images, then roll the
# deployments in the `alpha` namespace.
#
# Two images are built (both from the repo root as context):
#   - app: Next.js standalone (serves both the UI and the /api routes)
#   - mcp: MCP HTTP server (loads the app's src/lib engine at runtime)
#
# Defaults to linux/amd64 so images run on typical cloud Kubernetes nodes.
#
# Usage:
#   ./k8s/build-and-push.sh registry.kube.nikhilbhatia.com/route-optimizer v1
#   ./k8s/build-and-push.sh ghcr.io/<owner>/route-optimizer latest
#
# The MCP image is pushed to "<image-repo>-mcp:<tag>".
#
# Env (optional):
#   PROJECT_ROOT   Repo root (auto-detected)
#   APP_DOCKERFILE Defaults to PROJECT_ROOT/Dockerfile
#   MCP_DOCKERFILE Defaults to PROJECT_ROOT/k8s/mcp-server/Dockerfile
#   PLATFORM       Defaults to linux/amd64
#   BUILDER        Optional buildx builder name
#   NAMESPACE      Kubernetes namespace (default: alpha)
#   PUSH           true/false (default: true)
#   ROLLOUT        true/false — restart deployments after build (default: true)
#   BUILD_APP      true/false (default: true)
#   BUILD_MCP      true/false (default: true)

IMAGE_REPO="${1:-}"
IMAGE_TAG="${2:-latest}"
PLATFORM="${PLATFORM:-linux/amd64}"
BUILDER="${BUILDER:-}"
NAMESPACE="${NAMESPACE:-alpha}"
PUSH="${PUSH:-true}"
ROLLOUT="${ROLLOUT:-true}"
BUILD_APP="${BUILD_APP:-true}"
BUILD_MCP="${BUILD_MCP:-true}"

if [[ -z "$IMAGE_REPO" ]]; then
  echo "Usage: $0 <image-repo> [tag]"
  echo "Example: $0 registry.kube.nikhilbhatia.com/route-optimizer v1"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${PROJECT_ROOT:-$SCRIPT_DIR/..}"
APP_DOCKERFILE="${APP_DOCKERFILE:-$PROJECT_ROOT/Dockerfile}"
MCP_DOCKERFILE="${MCP_DOCKERFILE:-$SCRIPT_DIR/mcp-server/Dockerfile}"
echo "Project root: $PROJECT_ROOT"

if ! command -v docker >/dev/null 2>&1; then
  echo "Error: docker is not installed or not in PATH"
  exit 1
fi

if ! docker buildx version >/dev/null 2>&1; then
  echo "Error: docker buildx is required. Please install/enable Docker Buildx."
  exit 1
fi

if [[ -n "$BUILDER" ]]; then
  docker buildx use "$BUILDER" >/dev/null 2>&1 || docker buildx create --name "$BUILDER" --use >/dev/null
fi

APP_IMAGE="${IMAGE_REPO}:${IMAGE_TAG}"
MCP_IMAGE="${IMAGE_REPO}-mcp:${IMAGE_TAG}"

# build_image <dockerfile> <image-tag>
build_image() {
  local dockerfile="$1" image="$2"
  shift 2
  local extra_args=("$@")   # additional --build-arg flags, etc.
  if [[ ! -f "$dockerfile" ]]; then
    echo "Error: Dockerfile not found at: $dockerfile"
    exit 1
  fi
  if [[ "$PUSH" == "true" ]]; then
    echo "Building+Pushing image: $image"
  else
    echo "Building image (no push): $image"
  fi
  echo "  Dockerfile: $dockerfile"
  echo "  Platform:   $PLATFORM"

  local args=(
    --platform "$PLATFORM"
    -f "$dockerfile"
    -t "$image"
  )
  if [[ "$PUSH" == "true" ]]; then
    args+=(--push)
  else
    args+=(--load)
  fi

  docker buildx build "${args[@]}" ${extra_args[@]+"${extra_args[@]}"} "$PROJECT_ROOT"
  echo
}

if [[ "$BUILD_APP" == "true" ]]; then
  # NEXT_PUBLIC_MAPBOX_TOKEN is baked into the client bundle at build time.
  build_image "$APP_DOCKERFILE" "$APP_IMAGE" \
    --build-arg "NEXT_PUBLIC_MAPBOX_TOKEN=${NEXT_PUBLIC_MAPBOX_TOKEN:-}"
fi

if [[ "$BUILD_MCP" == "true" ]]; then
  build_image "$MCP_DOCKERFILE" "$MCP_IMAGE"
fi

# roll <deployment>
roll() {
  local deploy="$1"
  kubectl rollout restart "deployment/$deploy" -n "$NAMESPACE"
  kubectl rollout status "deployment/$deploy" -n "$NAMESPACE" --timeout=180s
}

if [[ "$ROLLOUT" == "true" ]]; then
  echo "Rolling deployments in namespace: $NAMESPACE"
  [[ "$BUILD_APP" == "true" ]] && roll route-optimizer
  [[ "$BUILD_MCP" == "true" ]] && roll route-optimizer-mcp
fi

echo
echo "Done."
[[ "$BUILD_APP" == "true" ]] && echo "App image (UI + API): $APP_IMAGE"
[[ "$BUILD_MCP" == "true" ]] && echo "MCP image:            $MCP_IMAGE"
echo "Referenced in k8s/{app,mcp-server}/10-deployment.yaml"
