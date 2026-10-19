# TowerTorch task runner. The recipes mirror the CI gates in build.yml and
# lint.yml and the packaging in pkg_build.sh. Run `just --list` to see them all.
set shell := ["sh", "-cu"]

# Show the recipe list
default:
    @just --list

# Build the engine
build:
    go build ./...

# Run the unit tests
test:
    go test ./...

# Run the unit tests with the race detector, for monitor and orchestrator work
test-race:
    go test -race ./...

# Format all Go sources in place
fmt:
    gofmt -w .

# Fail if any Go source is not gofmt-clean, as CI does
fmt-check:
    @out="$(gofmt -l .)"; if [ -n "$out" ]; then echo "gofmt needed on:"; echo "$out"; exit 1; fi

# go vet
vet:
    go vet ./...

# golangci-lint v2 (install once with `just lint-install` if missing)
lint:
    golangci-lint run ./...

# Build golangci-lint v2 from source with the local Go, the way CI does
lint-install:
    go install github.com/golangci/golangci-lint/v2/cmd/golangci-lint@latest

# node --check every injected script, as CI does
js-check:
    find plugin/src -name '*.js' -print0 | xargs -0 -r -n1 node --check

# Run the Node DOM-shim tests that replay Unraid's real markup
js-test:
    for t in plugin/test/*.test.js; do echo "== $t"; node "$t" || exit 1; done

# The full local gate before pushing
check: fmt-check vet lint test js-check js-test

# Build the plugin .txz and its .sha256 into plugin/out (needs Linux, bash and go).
# VERSION defaults to today's date; pass X.Y.Z for a real package.
pkg version="":
    bash plugin/pkg_build.sh {{version}}

# Build the daemon, start it and curl its socket, as build.yml does (needs Linux and curl)
smoke:
    bash plugin/pkg_build.sh 0.0.0-dev
    BIN=plugin/src/towertorch/usr/local/emhttp/plugins/towertorch/bin/towertorch; \
    "$BIN" version; \
    CC_SOCK=/tmp/cc-dev.sock CC_DATA_DIR=/tmp/ccdata-dev CC_DOCKER_SOCK=/tmp/nope.sock "$BIN" serve & \
    PID=$!; \
    for _ in $(seq 1 20); do [ -S /tmp/cc-dev.sock ] && break; sleep 0.5; done; \
    curl -fsS --unix-socket /tmp/cc-dev.sock http://localhost/api/health | grep -q ok && echo "health ok"; \
    kill "$PID" 2>/dev/null || true

# Regenerate the README banners from the SVG masters (needs opentype.js and @resvg/resvg-js)
banner:
    node .github/assets/gen-banner.mjs

# Scan the working tree for committed secrets
secrets:
    gitleaks detect --no-banner --redact

# Remove build outputs
clean:
    rm -rf plugin/out
