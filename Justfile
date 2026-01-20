# Generate examples using sqlc-dev
generate: plugin-wasm
    cd examples && sqlc-dev -f sqlc.dev.yaml generate

# Compile JavaScript to WASM using javy
# https://github.com/bytecodealliance/javy

# Set JAVY_PATH to the directory containing javy if not in system PATH
plugin-wasm: out-js
    #!/usr/bin/env bash
    JAVY=javy
    if [ -n "$JAVY_PATH" ]; then
        JAVY="$JAVY_PATH/javy"
    fi
    $JAVY build out.js -o examples/plugin.wasm

# Bundle TypeScript to JavaScript using rolldown
out-js: codegen-proto
    bun run rolldown -c rolldown.config.ts

# Generate protobuf code using buf
codegen-proto: lint
    buf generate --template buf.gen.yaml buf.build/sqlc/sqlc --path plugin/

# Clean build artifacts
clean:
    rm -f out.js examples/plugin.wasm

# Format TypeScript
fmt:
    bun run oxfmt

# Lint TypeScript
lint:
    bun run oxlint --type-aware --type-check

# Run unit tests
test:
    bun test

# Build everything from scratch
build: clean generate
