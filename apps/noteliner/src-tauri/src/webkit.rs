//! WebKitGTK specifics: Chromium-session equivalents the Electron build
//! got for free — spell checking and silent print-to-PDF.

use std::cell::RefCell;
use std::path::Path;
use std::rc::Rc;

use anyhow::{anyhow, Result};
use tauri::{AppHandle, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

/// `en_US.UTF-8` → `en_US` (WebKit wants enchant/hunspell language tags).
fn system_language() -> String {
    for var in ["LC_ALL", "LC_MESSAGES", "LANG"] {
        if let Ok(v) = std::env::var(var) {
            let tag = v.split(['.', '@']).next().unwrap_or("").to_string();
            if !tag.is_empty() && tag != "C" && tag != "POSIX" {
                return tag;
            }
        }
    }
    "en_US".into()
}

pub fn set_spellcheck(window: &WebviewWindow, enabled: bool) {
    let _ = window.with_webview(move |wv| {
        use webkit2gtk::{WebContextExt, WebViewExt};
        if let Some(ctx) = wv.inner().context() {
            ctx.set_spell_checking_languages(&[&system_language()]);
            ctx.set_spell_checking_enabled(enabled);
        }
    });
}

/// Render `html` in a hidden webview and print it to `out` as a Letter-size
/// PDF with half-inch margins (Electron's `printToPDF` settings).
pub async fn print_to_pdf(app: &AppHandle, html: String, out: &Path) -> Result<()> {
    static SEQ: std::sync::atomic::AtomicU32 = std::sync::atomic::AtomicU32::new(0);
    let label = format!("pdf-export-{}", SEQ.fetch_add(1, std::sync::atomic::Ordering::SeqCst));
    let window = WebviewWindowBuilder::new(app, &label, WebviewUrl::External("about:blank".parse().unwrap()))
        .visible(false)
        .build()?;

    let uri = format!("file://{}", out.display());
    let (tx, rx) = tokio::sync::oneshot::channel::<Result<(), String>>();
    window.with_webview(move |wv| {
        use webkit2gtk::{LoadEvent, PrintOperationExt, WebViewExt};
        let view = wv.inner();
        let tx = Rc::new(RefCell::new(Some(tx)));
        let printed = Rc::new(RefCell::new(None::<webkit2gtk::PrintOperation>));
        view.connect_load_changed(move |view, event| {
            if event != LoadEvent::Finished || printed.borrow().is_some() {
                return;
            }
            let settings = gtk::PrintSettings::new();
            // The file backend's printer is registered under GTK's
            // translated name.
            settings.set_printer(&glib::dgettext(Some("gtk30"), "Print to File"));
            settings.set(gtk::PRINT_SETTINGS_OUTPUT_FILE_FORMAT, Some("pdf"));
            settings.set(gtk::PRINT_SETTINGS_OUTPUT_URI, Some(&uri));
            let setup = gtk::PageSetup::new();
            setup.set_paper_size(&gtk::PaperSize::new(Some(gtk::PAPER_NAME_LETTER)));
            for set in [gtk::PageSetup::set_top_margin, gtk::PageSetup::set_bottom_margin, gtk::PageSetup::set_left_margin, gtk::PageSetup::set_right_margin] {
                set(&setup, 0.5, gtk::Unit::Inch);
            }
            let op = webkit2gtk::PrintOperation::new(view);
            op.set_print_settings(&settings);
            op.set_page_setup(&setup);
            let done = tx.clone();
            op.connect_finished(move |_| {
                if let Some(tx) = done.borrow_mut().take() {
                    let _ = tx.send(Ok(()));
                }
            });
            let failed = tx.clone();
            op.connect_failed(move |_, err| {
                if let Some(tx) = failed.borrow_mut().take() {
                    let _ = tx.send(Err(err.to_string()));
                }
            });
            op.print();
            *printed.borrow_mut() = Some(op);
        });
        // A file: base lets the page load the file:// attachment images.
        view.load_html(&html, Some("file:///"));
    })?;

    let result = tokio::time::timeout(std::time::Duration::from_secs(60), rx).await;
    let _ = window.destroy();
    match result {
        Ok(Ok(Ok(()))) => Ok(()),
        Ok(Ok(Err(e))) => Err(anyhow!("PDF export failed: {e}")),
        Ok(Err(_)) => Err(anyhow!("PDF export was cancelled")),
        Err(_) => Err(anyhow!("PDF export timed out")),
    }
}
