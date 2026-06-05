import SwiftUI

@main
struct WoofWatcherApp: App {
    @State private var store = CareStore()

    var body: some Scene {
        WindowGroup {
            ContentView(store: store)
                .task {
                    store.load()
                }
        }
    }
}
