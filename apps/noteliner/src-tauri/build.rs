// Bundles ../src/main/preload.js against @marina/desktop-ui's tauri-shim
// so the Tauri build exposes the same `window.api` as Electron. The output
// is include_str!'d by main.rs as the webview initialization script.

use std::path::PathBuf;
use std::process::Command;

fn main() {
    let manifest = PathBuf::from(std::env::var("CARGO_MANIFEST_DIR").unwrap());
    let root = manifest.join("../../..").canonicalize().unwrap();
    let out = PathBuf::from(std::env::var("OUT_DIR").unwrap()).join("preload.js");
    let output = Command::new("node")
        .arg(root.join("packages/desktop-ui/scripts/bundle-tauri-preload.mjs"))
        .arg(manifest.join("../src/main/preload.js"))
        .arg(&out)
        .current_dir(&root)
        .output()
        .expect("failed to run node (needed to bundle the preload)");
    if !output.status.success() {
        panic!("preload bundling failed:\n{}", String::from_utf8_lossy(&output.stderr));
    }
    for input in String::from_utf8_lossy(&output.stdout).lines() {
        println!("cargo:rerun-if-changed={input}");
    }
    tauri_build::build();
}
