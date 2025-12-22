# Generate examples using sqlc-dev
generate: plugin-wasm
    cd examples && sqlc-dev -f sqlc.dev.yaml generate

# Compile JavaScript to WASM using javy
# https://github.com/bytecodealliance/javy
plugin-wasm: out-js
    javy build out.js -o examples/plugin.wasm

# Bundle TypeScript to JavaScript using esbuild
out-js: codegen-proto
    bunx tsc --noEmit
    bunx esbuild --bundle src/app.ts --tree-shaking=true --format=esm --target=es2020 --outfile=out.js

# Generate protobuf code using buf
codegen-proto:
    buf generate --template buf.gen.yaml buf.build/sqlc/sqlc --path plugin/

# Clean build artifacts
clean:
    rm -f out.js examples/plugin.wasm

# Build everything from scratch
build: clean generate
