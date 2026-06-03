import SwiftUI

enum AppTab: String, CaseIterable, Identifiable {
    case today
    case schedule
    case log
    case health
    case records
    case report
    case helper

    var id: String { rawValue }

    var title: String {
        switch self {
        case .today: return "Today"
        case .schedule: return "Schedule"
        case .log: return "Log"
        case .health: return "Health"
        case .records: return "Records"
        case .report: return "Report"
        case .helper: return "Helper"
        }
    }

    var symbol: String {
        switch self {
        case .today: return "calendar"
        case .schedule: return "clock.badge.checkmark"
        case .log: return "plus.circle"
        case .health: return "heart.text.square"
        case .records: return "folder"
        case .report: return "doc.text"
        case .helper: return "sparkles"
        }
    }
}

struct ContentView: View {
    @Bindable var store: CareStore

    var body: some View {
        TabView {
            ForEach(AppTab.allCases) { tab in
                NavigationStack {
                    screen(for: tab)
                        .navigationTitle(tab.title)
                        .toolbar {
                            Button("Reset") {
                                store.resetSeed()
                            }
                        }
                }
                .tabItem {
                    Label(tab.title, systemImage: tab.symbol)
                }
            }
        }
        .tint(.copper)
    }

    @ViewBuilder
    private func screen(for tab: AppTab) -> some View {
        switch tab {
        case .today:
            TodayView(store: store)
        case .schedule:
            ScheduleView(store: store)
        case .log:
            LogView(store: store)
        case .health:
            HealthView(store: store)
        case .records:
            RecordsView(store: store)
        case .report:
            ReportView(store: store)
        case .helper:
            HelperView(store: store)
        }
    }
}

struct ScheduleView: View {
    @Bindable var store: CareStore
    @State private var draft = RoutineDraft()

    var body: some View {
        Form {
            Section("Editable Daily Routine") {
                ForEach(store.state.routines) { routine in
                    VStack(alignment: .leading, spacing: 6) {
                        HStack {
                            VStack(alignment: .leading, spacing: 3) {
                                Text(routine.label).font(.headline)
                                Text("\(routine.time) | \(routine.owner)").font(.subheadline).foregroundStyle(.secondary)
                                Text(routine.note).font(.footnote)
                            }
                            Spacer()
                            Button(role: .destructive) {
                                store.removeRoutine(id: routine.id)
                            } label: {
                                Image(systemName: "trash")
                            }
                        }
                    }
                }
            }

            Section("Add Routine") {
                Picker("Type", selection: $draft.type) {
                    ForEach(CareEntryType.allCases) { type in
                        Text(type.title).tag(type)
                    }
                }
                TextField("Routine", text: $draft.label)
                TextField("Time", text: $draft.time)
                TextField("Owner", text: $draft.owner)
                TextField("Care note", text: $draft.note, axis: .vertical)
                    .lineLimit(2...5)
                Button("Add Routine") {
                    store.upsertRoutine(draft)
                    draft = RoutineDraft()
                }
                .buttonStyle(.borderedProminent)
            }
        }
    }
}

struct TodayView: View {
    @Bindable var store: CareStore

    var body: some View {
        let handoff = store.caregiverHandoff

        List {
            Section {
                VStack(alignment: .leading, spacing: 10) {
                    Text(store.state.profile.name)
                        .font(.largeTitle.bold())
                    Text(store.state.profile.breed)
                        .foregroundStyle(.secondary)
                    Text(store.state.profile.background)
                    Text("Current \(store.state.profile.currentWeight, specifier: "%.1f") lb")
                        .font(.headline)
                    Text("Goal: \(store.state.profile.weightGoal)")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                .padding(.vertical, 6)
            }

            Section("Today's Routine") {
                ForEach(store.state.routines) { routine in
                    HStack(alignment: .top) {
                        Image(systemName: store.todaysCompletedRoutineLabels.contains(routine.label) ? "checkmark.circle.fill" : "circle")
                            .foregroundStyle(store.todaysCompletedRoutineLabels.contains(routine.label) ? .green : .secondary)
                        VStack(alignment: .leading) {
                            Text(routine.label).font(.headline)
                            Text("\(routine.time) | \(routine.owner)").font(.subheadline).foregroundStyle(.secondary)
                            Text(routine.note).font(.footnote)
                        }
                        Spacer()
                        Button {
                            store.addQuickEntry(type: routine.type, title: routine.label)
                        } label: {
                            Image(systemName: "plus")
                        }
                        .buttonStyle(.bordered)
                    }
                }
            }

            Section("Caregiver Handoff") {
                if let nextRoutine = handoff.nextRoutine {
                    Label("\(nextRoutine.label) at \(nextRoutine.time)", systemImage: "arrow.forward.circle")
                        .font(.headline)
                    Text(nextRoutine.owner)
                        .foregroundStyle(.secondary)
                } else {
                    Label("Routine covered", systemImage: "checkmark.circle")
                        .font(.headline)
                }

                Text(handoff.message)
                    .font(.callout)
                    .textSelection(.enabled)

                ForEach(handoff.caregiverLoad) { caregiver in
                    HStack {
                        VStack(alignment: .leading) {
                            Text(caregiver.name).font(.headline)
                            Text(caregiver.latestAction).font(.footnote).foregroundStyle(.secondary)
                        }
                        Spacer()
                        Text("\(caregiver.todayLogs)")
                            .font(.title3.bold())
                            .monospacedDigit()
                    }
                }

                ShareLink("Share Handoff", item: handoff.message)
            }

            Section("Recent Logs") {
                TimelineList(entries: Array(store.latestEntries.prefix(6)))
            }
        }
    }
}

struct LogView: View {
    @Bindable var store: CareStore
    @State private var draft = CareEntryDraft()

    var body: some View {
        Form {
            Section("New Care Event") {
                Picker("Type", selection: $draft.type) {
                    ForEach(CareEntryType.allCases) { type in
                        Text(type.title).tag(type)
                    }
                }
                TextField("Title", text: $draft.title)
                TextField("Caregiver", text: $draft.caregiver)
                DatePicker("When", selection: $draft.occurredAt)
                TextField("Amount", text: $draft.amount)
                Stepper("Minutes: \(draft.durationMinutes)", value: $draft.durationMinutes, in: 0...240)
                Stepper("Dog interactions: \(draft.dogInteractions)", value: $draft.dogInteractions, in: 0...20)
                TextField("Mood/appetite", text: $draft.mood)
                Picker("Severity", selection: $draft.severity) {
                    ForEach(CareSeverity.allCases) { severity in
                        Text(severity.rawValue.capitalized).tag(severity)
                    }
                }
                TextField("Notes", text: $draft.note, axis: .vertical)
                    .lineLimit(3...6)
                Button("Save Care Log") {
                    store.addEntry(draft)
                    draft = CareEntryDraft()
                }
                .buttonStyle(.borderedProminent)
            }

            Section("Recent Entries") {
                TimelineList(entries: Array(store.latestEntries.prefix(12)))
            }
        }
    }
}

struct HealthView: View {
    @Bindable var store: CareStore

    var body: some View {
        List {
            Section("Pattern Status") {
                Label(store.healthWatch.status, systemImage: "heart.text.square")
                    .font(.title2.bold())
                ForEach(store.healthWatch.signals, id: \.self) { signal in
                    Text(signal)
                }
            }

            Section("Vet Boundary") {
                Text("Urgent red flags include repeated vomiting in one day, blood, black or tarry stool, lethargy, bloating, belly pain, dehydration, toxin exposure, foreign-object concern, or not eating.")
            }

            Section("Health Timeline") {
                TimelineList(entries: store.latestEntries.filter { [.vomit, .health, .vet, .weight, .medication].contains($0.type) })
            }
        }
    }
}

struct RecordsView: View {
    @Bindable var store: CareStore

    var body: some View {
        List {
            Section("Care Vault") {
                ForEach(store.state.records) { record in
                    VStack(alignment: .leading, spacing: 4) {
                        Text(record.title).font(.headline)
                        Text("\(record.type) | \(record.due)").font(.subheadline).foregroundStyle(.secondary)
                        Text(record.note).font(.footnote)
                    }
                }
            }
        }
    }
}

struct ReportView: View {
    @Bindable var store: CareStore

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text("Monthly Report")
                    .font(.title.bold())
                Text(store.reportText())
                    .font(.system(.body, design: .monospaced))
                    .textSelection(.enabled)
                    .padding()
                    .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 8))
            }
            .padding()
        }
    }
}

struct HelperView: View {
    @Bindable var store: CareStore
    @State private var question = "Phoenix threw up yellow again. What should we track?"
    @State private var answer = ""

    var body: some View {
        Form {
            Section("Ask With Phoenix Context") {
                TextField("Question", text: $question, axis: .vertical)
                    .lineLimit(3...6)
                Button("Review Phoenix Context") {
                    answer = store.localHelperAnswer(question: question)
                }
                .buttonStyle(.borderedProminent)
            }

            Section("Care Helper") {
                Text(answer.isEmpty ? store.localHelperAnswer(question: question) : answer)
            }

            Section("Boundary") {
                Text(store.state.profile.vetBoundary)
            }
        }
    }
}

struct TimelineList: View {
    var entries: [CareEntry]

    var body: some View {
        if entries.isEmpty {
            Text("No matching logs yet.")
                .foregroundStyle(.secondary)
        } else {
            ForEach(entries) { entry in
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text(entry.type.title)
                            .font(.caption.bold())
                            .foregroundStyle(.secondary)
                        if entry.requiresFollowUp {
                            Text("Review")
                                .font(.caption.bold())
                                .foregroundStyle(.red)
                        }
                    }
                    Text(entry.title)
                        .font(.headline)
                    Text("\(entry.caregiver) | \(entry.occurredAt.formatted(date: .abbreviated, time: .shortened))")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    if !entry.note.isEmpty {
                        Text(entry.note)
                            .font(.footnote)
                    }
                }
                .padding(.vertical, 4)
            }
        }
    }
}

extension Color {
    static let copper = Color(red: 200 / 255, green: 122 / 255, blue: 58 / 255)
}

#Preview {
    ContentView(store: CareStore())
}
