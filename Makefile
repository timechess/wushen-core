.PHONY: fmt lint dev build

fmt:
	cargo fmt
	cargo fmt --manifest-path src-tauri/Cargo.toml
	npm --prefix frontend exec -- prettier --write .

lint:
	cargo clippy --manifest-path Cargo.toml -- -D warnings
	cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
	npm --prefix frontend exec -- prettier --check .

dev:
	(cd src-tauri && cargo tauri dev)

build:
	(cd src-tauri && cargo tauri build)
