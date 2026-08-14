import Foundation

/// The only file you need to edit. Fill these in from
/// CURA → Settings → "iPhone Lock Screen widget" → Generate widget token.
enum CuraConfig {
    /// Your deployed CURA base URL, e.g. "https://cura.yourdomain.com"
    static let appURL = "https://YOUR-CURA-DOMAIN"

    /// The summary endpoint (usually appURL + "/api/widget/summary").
    static let summaryURL = "https://YOUR-CURA-DOMAIN/api/widget/summary"

    /// Your personal, read-only widget token (paste the whole string).
    static let widgetToken = "PASTE_YOUR_WIDGET_TOKEN_HERE"
}
