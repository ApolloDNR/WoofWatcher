import SwiftUI

enum AppTab: String, CaseIterable, Identifiable {
    case today
    case schedule
    case goals
    case calendar
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
        case .goals: return "Goals"
        case .calendar: return "Calendar"
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
        case .goals: return "target"
        case .calendar: return "calendar.badge.exclamationmark"
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
        case .goals:
            GoalsView(store: store)
        case .calendar:
            CalendarView(store: store)
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

struct CalendarView: View {
    @Bindable var store: CareStore
    @State private var selectedDateKey = ""

    var body: some View {
        let calendar = store.careCalendar
        let selectedDay = selectedDay(in: calendar)

        List {
            Section("Month Signals") {
                Text(calendar.monthLabel)
                    .font(.title2.bold())
                HStack {
                    metric("Logged days", "\(calendar.activeDays)")
                    metric("Total logs", "\(calendar.totalLogs)")
                    metric("Vomit days", "\(calendar.vomitDays)")
                }
                Text("\(calendar.reviewDays) day\(calendar.reviewDays == 1 ? "" : "s") need caregiver review.")
                    .foregroundStyle(calendar.reviewDays > 0 ? .orange : .secondary)
            }

            Section("Care Calendar") {
                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 6), count: 7), spacing: 6) {
                    ForEach(calendar.weekdays, id: \.self) { weekday in
                        Text(weekday)
                            .font(.caption2.bold())
                            .foregroundStyle(.secondary)
                    }

                    ForEach(0..<calendar.firstWeekday, id: \.self) { _ in
                        Color.clear.frame(height: 56)
                    }

                    ForEach(calendar.days) { day in
                        Button {
                            selectedDateKey = day.dateKey
                        } label: {
                            CalendarDayTile(day: day, selected: selectedDay?.dateKey == day.dateKey)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.vertical, 4)
            }

            Section("Selected Day") {
                if let selectedDay {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(dateLabel(for: selectedDay.dateKey))
                            .font(.headline)
                        Text(selectedDay.summary)
                            .font(.subheadline)
                            .foregroundStyle(statusColor(selectedDay.status))
                        HStack {
                            metric("Meals", "\(selectedDay.counts.meals)")
                            metric("Walks", "\(selectedDay.counts.walks)")
                            metric("Follow-ups", "\(selectedDay.counts.followUps)")
                        }
                    }

                    TimelineList(entries: selectedDay.entries.sorted { $0.occurredAt > $1.occurredAt })
                } else {
                    Text("Choose a day to review Phoenix's care evidence.")
                        .foregroundStyle(.secondary)
                }
            }
        }
        .onAppear {
            if selectedDateKey.isEmpty {
                selectedDateKey = calendar.days.first(where: { $0.isToday })?.dateKey ?? calendar.days.first?.dateKey ?? ""
            }
        }
    }

    private func selectedDay(in calendar: CareCalendar) -> CalendarDaySummary? {
        if let selected = calendar.days.first(where: { $0.dateKey == selectedDateKey }) {
            return selected
        }
        return calendar.days.first(where: { $0.isToday })
            ?? calendar.days.first(where: { $0.status == "review" })
            ?? calendar.days.first(where: { $0.status == "active" })
            ?? calendar.days.first
    }

    private func metric(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(value)
                .font(.headline)
                .monospacedDigit()
            Text(label)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func statusColor(_ status: String) -> Color {
        switch status {
        case "review": return .orange
        case "active": return .green
        default: return .secondary
        }
    }

    private func dateLabel(for dateKey: String) -> String {
        let parts = dateKey.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return dateKey }
        var components = DateComponents()
        components.year = parts[0]
        components.month = parts[1]
        components.day = parts[2]
        guard let date = Calendar.current.date(from: components) else { return dateKey }
        return date.formatted(.dateTime.weekday(.wide).month(.wide).day())
    }
}

struct CalendarDayTile: View {
    var day: CalendarDaySummary
    var selected: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text("\(day.day)")
                    .font(.caption.bold())
                Spacer()
                if day.isToday {
                    Circle()
                        .fill(Color.copper)
                        .frame(width: 6, height: 6)
                }
            }

            Text(day.entries.isEmpty ? "" : "\(day.entries.count)")
                .font(.headline)
                .monospacedDigit()
                .frame(maxWidth: .infinity, alignment: .leading)

            CalendarMarkerStrip(counts: day.counts)
        }
        .frame(minHeight: 56, alignment: .topLeading)
        .padding(6)
        .background(backgroundColor, in: RoundedRectangle(cornerRadius: 8))
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(selected ? Color.copper : borderColor, lineWidth: selected ? 2 : 1)
        )
        .accessibilityLabel("\(day.dateKey), \(day.summary)")
    }

    private var backgroundColor: Color {
        switch day.status {
        case "review": return Color.orange.opacity(0.16)
        case "active": return Color.green.opacity(0.12)
        default: return Color.secondary.opacity(0.08)
        }
    }

    private var borderColor: Color {
        switch day.status {
        case "review": return Color.orange.opacity(0.7)
        case "active": return Color.green.opacity(0.5)
        default: return Color.secondary.opacity(0.18)
        }
    }
}

struct CalendarMarkerStrip: View {
    var counts: CalendarDayCounts

    var body: some View {
        HStack(spacing: 2) {
            if counts.meals > 0 { marker("M", .copper) }
            if counts.walks > 0 { marker("W", .green) }
            if counts.training > 0 { marker("T", .blue) }
            if counts.parkVisits + counts.social > 0 { marker("S", .mint) }
            if counts.vomit > 0 { marker("V", .red) }
            if counts.health + counts.vet + counts.medication + counts.weight > 0 { marker("H", .orange) }
            if counts.meals + counts.walks + counts.training + counts.parkVisits + counts.social + counts.vomit + counts.health + counts.vet + counts.medication + counts.weight == 0 {
                Spacer(minLength: 12)
            }
        }
    }

    private func marker(_ label: String, _ color: Color) -> some View {
        Text(label)
            .font(.system(size: 8, weight: .bold))
            .foregroundStyle(.white)
            .frame(width: 14, height: 14)
            .background(color, in: Circle())
    }
}

struct GoalsView: View {
    @Bindable var store: CareStore
    @State private var draft = GoalDraft()

    var body: some View {
        let review = store.goalReview

        Form {
            Section("Progress Review") {
                HStack {
                    VStack(alignment: .leading) {
                        Text("\(review.activeGoals)/\(review.totalGoals) active")
                            .font(.title2.bold())
                        Text("\(review.completedGoals) completed")
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    Image(systemName: "target")
                        .font(.title2)
                        .foregroundStyle(.copper)
                }

                ForEach(review.highlights, id: \.self) { highlight in
                    Text(highlight)
                }
            }

            Section("Phoenix Goals") {
                ForEach($store.state.goals) { $goal in
                    VStack(alignment: .leading, spacing: 10) {
                        HStack {
                            Picker("Category", selection: $goal.category) {
                                ForEach(CareGoalCategory.allCases) { category in
                                    Text(category.title).tag(category)
                                }
                            }
                            Picker("Status", selection: $goal.status) {
                                ForEach(CareGoalStatus.allCases) { status in
                                    Text(status.title).tag(status)
                                }
                            }
                        }

                        TextField("Goal", text: $goal.title)
                        TextField("Target", text: $goal.target, axis: .vertical)
                            .lineLimit(2...4)
                        TextField("Due", text: $goal.due)
                        TextField("Notes", text: $goal.note, axis: .vertical)
                            .lineLimit(2...5)

                        HStack {
                            Button("Save Goal") {
                                store.upsertGoal(GoalDraft(goal: goal))
                            }
                            .buttonStyle(.borderedProminent)

                            Button(role: .destructive) {
                                store.removeGoal(id: goal.id)
                            } label: {
                                Label("Remove", systemImage: "trash")
                            }
                            .buttonStyle(.bordered)
                        }
                    }
                    .padding(.vertical, 4)
                }
            }

            Section("Add Goal") {
                Picker("Category", selection: $draft.category) {
                    ForEach(CareGoalCategory.allCases) { category in
                        Text(category.title).tag(category)
                    }
                }
                Picker("Status", selection: $draft.status) {
                    ForEach(CareGoalStatus.allCases) { status in
                        Text(status.title).tag(status)
                    }
                }
                TextField("Goal", text: $draft.title)
                TextField("Target", text: $draft.target, axis: .vertical)
                    .lineLimit(2...4)
                TextField("Due", text: $draft.due)
                TextField("Notes", text: $draft.note, axis: .vertical)
                    .lineLimit(2...5)
                Button("Add Goal") {
                    store.upsertGoal(draft)
                    draft = GoalDraft()
                }
                .buttonStyle(.borderedProminent)
            }
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
