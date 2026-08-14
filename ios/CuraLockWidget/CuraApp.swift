import SwiftUI

/// Minimal host app. A widget extension must belong to an app, but this app
/// does nothing except exist and offer a link into CURA.
@main
struct CuraApp: App {
    var body: some Scene {
        WindowGroup { ContentView() }
    }
}

struct ContentView: View {
    private let cream = Color(red: 0.96, green: 0.94, blue: 0.89)
    private let ink = Color(red: 0.13, green: 0.11, blue: 0.08)
    var body: some View {
        ZStack {
            cream.ignoresSafeArea()
            VStack(spacing: 16) {
                Text("CURA").font(.system(size: 40, weight: .heavy, design: .rounded)).tracking(2).foregroundStyle(ink)
                Text("Add the CURA widget to your Lock Screen,\nthen tap it to come back here.")
                    .multilineTextAlignment(.center)
                    .font(.callout)
                    .foregroundStyle(ink.opacity(0.6))
                if let url = URL(string: CuraConfig.appURL) {
                    Link("Open CURA", destination: url)
                        .font(.headline)
                        .padding(.horizontal, 22).padding(.vertical, 12)
                        .background(Color(red: 0.07, green: 0.71, blue: 0.49), in: Capsule())
                        .foregroundStyle(.white)
                }
            }.padding()
        }
    }
}
