import WidgetKit
import SwiftUI

// MARK: - Model

/// Matches the JSON from GET /api/widget/summary. Scores are computed by CURA's
/// own engine on the server — the widget only displays them.
struct CuraSummary: Codable {
    var recovery: Int?
    var energy: Int?
    var sleep: Int?
    var sleepHours: Double?
    var recoveryStatus: String?
    var energyStatus: String?
    var updatedAt: Double?
}

// MARK: - Networking + offline cache

enum CuraAPI {
    private static let cacheKey = "cura_last_summary"
    private static let lastOkKey = "cura_last_ok_at"
    // Only surface the "offline" indicator after we've been unable to reach CURA
    // for this long. A single slow request (e.g. a serverless cold start) should
    // NOT flip the widget to offline while we still have recent good data.
    private static let offlineAfter: TimeInterval = 12 * 60 * 60

    static func fetch() async -> (CuraSummary?, stale: Bool) {
        guard var comps = URLComponents(string: CuraConfig.summaryURL) else { return staleResult() }
        // Send this device's UTC offset (minutes east of UTC) so the server picks
        // the same "today" the web app does when applying the live energy decay —
        // otherwise the widget can decide the day in UTC and drift near midnight.
        let tzMinutes = TimeZone.current.secondsFromGMT() / 60
        var items = comps.queryItems ?? []
        items.append(URLQueryItem(name: "tz", value: String(tzMinutes)))
        comps.queryItems = items
        guard let url = comps.url else { return staleResult() }
        var req = URLRequest(url: url)
        req.setValue("Bearer \(CuraConfig.widgetToken)", forHTTPHeaderField: "Authorization")
        req.timeoutInterval = 25 // serverless cold starts can take a while
        req.cachePolicy = .reloadIgnoringLocalCacheData

        // Try twice — a transient failure or a cold backend shouldn't drop us to
        // "offline" when a quick retry usually succeeds.
        for attempt in 0..<2 {
            do {
                let (data, resp) = try await URLSession.shared.data(for: req)
                guard (resp as? HTTPURLResponse)?.statusCode == 200 else { throw URLError(.badServerResponse) }
                let summary = try JSONDecoder().decode(CuraSummary.self, from: data)
                UserDefaults.standard.set(data, forKey: cacheKey)          // cache latest
                UserDefaults.standard.set(Date().timeIntervalSince1970, forKey: lastOkKey)
                return (summary, false)
            } catch {
                if attempt == 0 { try? await Task.sleep(nanoseconds: 800_000_000) } // 0.8s backoff
            }
        }
        // Both attempts failed: keep showing the last known values, and only mark
        // the widget "offline" if it's been genuinely unreachable for a long time.
        return staleResult()
    }

    /// Cached values, flagged offline only if we haven't succeeded in a long time.
    private static func staleResult() -> (CuraSummary?, stale: Bool) {
        let last = UserDefaults.standard.object(forKey: lastOkKey) as? Double
        let lostForAWhile = last == nil || (Date().timeIntervalSince1970 - last!) > offlineAfter
        return (cached(), lostForAWhile)
    }

    private static func cached() -> CuraSummary? {
        guard let data = UserDefaults.standard.data(forKey: cacheKey) else { return nil }
        return try? JSONDecoder().decode(CuraSummary.self, from: data)
    }
}

// MARK: - Timeline

struct CuraEntry: TimelineEntry {
    let date: Date
    let summary: CuraSummary?
    let stale: Bool
}

struct CuraProvider: TimelineProvider {
    func placeholder(in context: Context) -> CuraEntry {
        CuraEntry(date: Date(), summary: CuraSummary(recovery: 72, energy: 65, sleep: 80, sleepHours: 7.4, recoveryStatus: "Primed", energyStatus: "Charged", updatedAt: nil), stale: false)
    }

    func getSnapshot(in context: Context, completion: @escaping (CuraEntry) -> Void) {
        Task {
            let (summary, stale) = await CuraAPI.fetch()
            completion(CuraEntry(date: Date(), summary: summary, stale: stale))
        }
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<CuraEntry>) -> Void) {
        Task {
            let (summary, stale) = await CuraAPI.fetch()
            let entry = CuraEntry(date: Date(), summary: summary, stale: stale)
            // Normally every ~30 min (scores only change on sync, and iOS budgets
            // widget refreshes). If we're showing offline, try again sooner to
            // recover quickly once connectivity/the backend is back.
            let minutes = stale ? 15 : 30
            let next = Calendar.current.date(byAdding: .minute, value: minutes, to: Date()) ?? Date().addingTimeInterval(TimeInterval(minutes * 60))
            completion(Timeline(entries: [entry], policy: .after(next)))
        }
    }
}

// MARK: - Views

private struct Metric: View {
    let label: String
    let value: Int?
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(label).font(.system(size: 9, weight: .semibold)).opacity(0.7)
            Text(value.map(String.init) ?? "–").font(.system(size: 19, weight: .bold, design: .rounded))
        }
    }
}

/// Lock Screen rectangular (monochrome/vibrant) — the primary target.
struct CuraRectangularView: View {
    let entry: CuraEntry
    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(spacing: 4) {
                Text("CURA").font(.system(size: 10, weight: .heavy)).tracking(1)
                if entry.stale { Image(systemName: "wifi.slash").font(.system(size: 8)).opacity(0.6) }
                Spacer()
            }
            HStack(alignment: .top) {
                Metric(label: "REC", value: entry.summary?.recovery)
                Spacer()
                Metric(label: "ENERGY", value: entry.summary?.energy)
                Spacer()
                Metric(label: "SLEEP", value: entry.summary?.sleep)
            }
        }
    }
}

/// Home Screen small (full colour, CURA cream/greens) — a bonus option.
struct CuraSmallView: View {
    let entry: CuraEntry
    private let cream = Color(red: 0.96, green: 0.94, blue: 0.89)
    private let ink = Color(red: 0.13, green: 0.11, blue: 0.08)
    private func row(_ label: String, _ value: Int?, _ color: Color) -> some View {
        HStack {
            Text(label).font(.system(size: 12, weight: .medium)).foregroundStyle(ink.opacity(0.6))
            Spacer()
            Text(value.map(String.init) ?? "–").font(.system(size: 20, weight: .bold, design: .rounded)).foregroundStyle(color)
        }
    }
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("CURA").font(.system(size: 12, weight: .heavy)).tracking(1.5).foregroundStyle(ink)
            row("Recovery", entry.summary?.recovery, Color(red: 0.07, green: 0.71, blue: 0.49))
            row("Energy", entry.summary?.energy, Color(red: 0.92, green: 0.62, blue: 0.10))
            row("Sleep", entry.summary?.sleep, Color(red: 0.48, green: 0.41, blue: 0.93))
        }
        .padding(14)
    }
}

struct CuraWidgetEntryView: View {
    @Environment(\.widgetFamily) var family
    let entry: CuraEntry

    var body: some View {
        let content = Group {
            switch family {
            case .accessoryRectangular: CuraRectangularView(entry: entry)
            case .accessoryInline:
                Text("R \(entry.summary?.recovery.map(String.init) ?? "–") · E \(entry.summary?.energy.map(String.init) ?? "–") · S \(entry.summary?.sleep.map(String.init) ?? "–")")
            default: CuraSmallView(entry: entry)
            }
        }
        if #available(iOS 17.0, *) {
            content
                .containerBackground(for: .widget) {
                    family == .systemSmall ? Color(red: 0.96, green: 0.94, blue: 0.89) : Color.clear
                }
                .widgetURL(URL(string: CuraConfig.appURL))
        } else {
            content.widgetURL(URL(string: CuraConfig.appURL))
        }
    }
}

// MARK: - Widget

struct CuraLockWidget: Widget {
    let kind = "CuraLockWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: CuraProvider()) { entry in
            CuraWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("CURA")
        .description("Your Recovery, Energy and Sleep at a glance.")
        .supportedFamilies([.accessoryRectangular, .accessoryInline, .systemSmall])
    }
}

@main
struct CuraWidgetBundle: WidgetBundle {
    var body: some Widget { CuraLockWidget() }
}
