import Foundation
import Observation

@MainActor
@Observable
final class CareStore {
    var state: CareState = .seed
    var lastSaveError: String?

    private let fileName = "woofwatcher-state.json"

    var latestEntries: [CareEntry] {
        state.entries.sorted { $0.occurredAt > $1.occurredAt }
    }

    var todaysCompletedRoutineLabels: Set<String> {
        let calendar = Calendar.current
        let todayEntries = state.entries.filter { calendar.isDateInToday($0.occurredAt) }
        let labels = state.routines.compactMap { routine -> String? in
            todayEntries.contains { entry in
                entry.title.localizedCaseInsensitiveContains(routine.label) || entry.type == routine.type && entry.title == routine.label
            } ? routine.label : nil
        }
        return Set(labels)
    }

    var nextRoutine: CareRoutine? {
        state.routines.first { !todaysCompletedRoutineLabels.contains($0.label) }
    }

    var caregiverHandoff: CaregiverHandoff {
        let calendar = Calendar.current
        let todayEntries = state.entries
            .filter { calendar.isDateInToday($0.occurredAt) }
            .sorted { $0.occurredAt > $1.occurredAt }
        let lastMeal = todayEntries.first { $0.type == .meal }
        let lastWalk = todayEntries.first { $0.type == .walk }
        let followUps = todayEntries.filter { $0.requiresFollowUp || $0.severity == .urgent }
        let loads = state.caregivers.map { caregiver in
            let logs = todayEntries.filter { entryMatchesCaregiver($0, caregiver.name) }
            let latest = logs.first.map { "\($0.title) at \($0.occurredAt.formatted(date: .abbreviated, time: .shortened))" } ?? "No logs today"
            return CaregiverLoad(name: caregiver.name, role: caregiver.role, todayLogs: logs.count, latestAction: latest)
        }

        return CaregiverHandoff(
            nextRoutine: nextRoutine,
            lastMeal: lastMeal,
            lastWalk: lastWalk,
            followUps: followUps,
            caregiverLoad: loads,
            message: handoffMessage(nextRoutine: nextRoutine, lastMeal: lastMeal, lastWalk: lastWalk, followUps: followUps)
        )
    }

    var healthWatch: HealthWatch {
        let recent = state.entries.filter { entry in
            entry.occurredAt >= Date().addingTimeInterval(-14 * 24 * 3600)
        }
        let vomitCount = recent.filter { $0.type == .vomit }.count
        let refusedMeals = recent.filter {
            $0.type == .meal && ($0.mood + " " + $0.note).localizedCaseInsensitiveContains("refus")
        }.count
        let urgentCount = recent.filter { $0.severity == .urgent }.count

        if vomitCount >= 2 || refusedMeals > 0 || urgentCount > 0 {
            return HealthWatch(
                status: "Review",
                signals: [
                    "\(vomitCount) vomit incidents logged in the last 14 days.",
                    refusedMeals > 0 ? "\(refusedMeals) refused or skipped meal pattern logged." : nil,
                    urgentCount > 0 ? "\(urgentCount) urgent entries need review." : nil
                ].compactMap { $0 }
            )
        }

        if vomitCount == 1 {
            return HealthWatch(status: "Watch", signals: ["1 vomit incident logged in the last 14 days."])
        }

        return HealthWatch(status: "Steady", signals: ["No recent vomit, appetite refusal, or urgent health flags logged."])
    }

    var monthlySummary: MonthlySummary {
        let calendar = Calendar.current
        let now = Date()
        let entries = state.entries.filter {
            calendar.component(.month, from: $0.occurredAt) == calendar.component(.month, from: now)
                && calendar.component(.year, from: $0.occurredAt) == calendar.component(.year, from: now)
        }

        return MonthlySummary(
            meals: entries.filter { $0.type == .meal }.count,
            walks: entries.filter { $0.type == .walk }.count,
            training: entries.filter { $0.type == .training }.count,
            vomit: entries.filter { $0.type == .vomit }.count,
            followUps: entries.filter { $0.requiresFollowUp }.count
        )
    }

    var careCalendar: CareCalendar {
        let calendar = Calendar.current
        let now = Date()
        let start = calendar.date(from: calendar.dateComponents([.year, .month], from: now)) ?? now
        let targetYear = calendar.component(.year, from: start)
        let targetMonth = calendar.component(.month, from: start)
        let monthRange = calendar.range(of: .day, in: .month, for: start) ?? 1..<2
        let monthEntries = state.entries
            .filter {
                calendar.component(.year, from: $0.occurredAt) == targetYear
                    && calendar.component(.month, from: $0.occurredAt) == targetMonth
            }
            .sorted { $0.occurredAt < $1.occurredAt }

        let days = monthRange.compactMap { day -> CalendarDaySummary? in
            var components = DateComponents()
            components.year = targetYear
            components.month = targetMonth
            components.day = day
            guard let date = calendar.date(from: components) else { return nil }

            let key = dateKey(for: date)
            let dayEntries = monthEntries.filter { dateKey(for: $0.occurredAt) == key }
            let counts = countsForCalendarDay(dayEntries)
            let needsReview = dayEntries.contains { $0.requiresFollowUp || $0.severity == .urgent }
            let status = needsReview ? "review" : (dayEntries.isEmpty ? "empty" : "active")

            return CalendarDaySummary(
                day: day,
                dateKey: key,
                isToday: calendar.isDateInToday(date),
                status: status,
                summary: calendarDaySummary(counts),
                counts: counts,
                entries: dayEntries
            )
        }

        return CareCalendar(
            monthLabel: monthLabel(for: start),
            weekdays: calendar.shortWeekdaySymbols,
            firstWeekday: max(0, calendar.component(.weekday, from: start) - 1),
            activeDays: days.filter { !$0.entries.isEmpty }.count,
            reviewDays: days.filter { $0.status == "review" }.count,
            vomitDays: days.filter { $0.counts.vomit > 0 }.count,
            totalLogs: monthEntries.count,
            days: days
        )
    }

    var goalReview: GoalReview {
        let calendar = Calendar.current
        let now = Date()
        let monthEntries = state.entries.filter {
            calendar.component(.month, from: $0.occurredAt) == calendar.component(.month, from: now)
                && calendar.component(.year, from: $0.occurredAt) == calendar.component(.year, from: now)
        }
        let latestWeight = latestEntries.first { $0.type == .weight }
        let trainingEntries = monthEntries.filter { $0.type == .training }
        let socialEntries = monthEntries.filter { $0.type == .social || $0.type == .park }
        let trainingMinutes = trainingEntries.reduce(0) { $0 + $1.durationMinutes }
        let dogInteractions = socialEntries.reduce(0) { $0 + $1.dogInteractions }
        var highlights: [String] = []

        if let latestWeight {
            let value = latestWeight.amount.isEmpty ? latestWeight.title : latestWeight.amount
            highlights.append("Latest weight trend: \(value).")
        }
        highlights.append("Training this month: \(trainingEntries.count) sessions, \(trainingMinutes) minutes.")
        highlights.append("Social exposure this month: \(socialEntries.count) sessions, \(dogInteractions) dog interactions.")
        if state.goals.filter({ $0.status == .active }).isEmpty {
            highlights.append("No active goals are set.")
        }

        return GoalReview(
            totalGoals: state.goals.count,
            activeGoals: state.goals.filter { $0.status == .active }.count,
            completedGoals: state.goals.filter { $0.status == .done }.count,
            highlights: highlights
        )
    }

    func load() {
        do {
            let url = try storageURL()
            guard FileManager.default.fileExists(atPath: url.path) else { return }
            let data = try Data(contentsOf: url)
            state = try JSONDecoder.woofWatcher.decode(CareState.self, from: data)
        } catch {
            lastSaveError = error.localizedDescription
        }
    }

    func save() {
        do {
            let url = try storageURL()
            let data = try JSONEncoder.woofWatcher.encode(state)
            try data.write(to: url, options: [.atomic])
            lastSaveError = nil
        } catch {
            lastSaveError = error.localizedDescription
        }
    }

    func addEntry(_ draft: CareEntryDraft) {
        state.entries.insert(draft.entry(), at: 0)
        save()
    }

    func addQuickEntry(type: CareEntryType, title: String) {
        state.entries.insert(CareEntry(type: type, title: title, caregiver: "Unassigned"), at: 0)
        save()
    }

    func upsertRoutine(_ draft: RoutineDraft) {
        let routine = draft.routine()
        if let index = state.routines.firstIndex(where: { $0.id == routine.id }) {
            state.routines[index] = routine
        } else {
            state.routines.append(routine)
        }
        sortRoutines()
        save()
    }

    func removeRoutine(id: String) {
        state.routines.removeAll { $0.id == id }
        sortRoutines()
        save()
    }

    func upsertGoal(_ draft: GoalDraft) {
        let goal = draft.goal()
        if let index = state.goals.firstIndex(where: { $0.id == goal.id }) {
            state.goals[index] = goal
        } else {
            state.goals.append(goal)
        }
        sortGoals()
        save()
    }

    func removeGoal(id: String) {
        state.goals.removeAll { $0.id == id }
        sortGoals()
        save()
    }

    func resetSeed() {
        state = .seed
        save()
    }

    func reportText() -> String {
        let summary = monthlySummary
        let latest = latestEntries.prefix(8).map { entry in
            "- \(entry.occurredAt.formatted(date: .abbreviated, time: .shortened)) | \(entry.type.title) | \(entry.title) | \(entry.caregiver)"
        }.joined(separator: "\n")

        return """
        WoofWatcher Monthly Report
        \(state.profile.name)

        Summary
        Meals logged: \(summary.meals)
        Walks: \(summary.walks)
        Training sessions: \(summary.training)
        Vomit incidents: \(summary.vomit)
        Follow-ups flagged: \(summary.followUps)

        Health Watch
        Status: \(healthWatch.status)
        \(healthWatch.signals.map { "- \($0)" }.joined(separator: "\n"))

        Goal Review
        Active goals: \(goalReview.activeGoals)/\(goalReview.totalGoals)
        \(goalReview.highlights.map { "- \($0)" }.joined(separator: "\n"))

        Recent Care Timeline
        \(latest)

        Boundary
        This report is pattern tracking for caregiver and veterinarian review. It is not a veterinary diagnosis.
        """
    }

    func localHelperAnswer(question: String) -> String {
        let asksVomit = question.range(of: "vomit|throw|bile|yellow|nausea", options: [.regularExpression, .caseInsensitive]) != nil
        let lead = asksVomit
            ? "Phoenix has a vomit pattern worth tracking closely. Yellow bile can happen around empty-stomach windows, but this app should treat it as a pattern for veterinarian review, not a diagnosis."
            : "Phoenix's care picture is built from today's routine, logged meals, walks, training, social exposure, and health notes."

        return "\(lead) This month: \(monthlySummary.meals) meals, \(monthlySummary.walks) walks, \(monthlySummary.training) training sessions, \(monthlySummary.vomit) vomit incidents. Health watch is \(healthWatch.status.lowercased()). Next routine: \(nextRoutine?.label ?? "covered"). For urgent symptoms, repeated vomiting, blood, lethargy, bloating, dehydration, toxin exposure, or not eating, contact a veterinarian or urgent care."
    }

    private func entryMatchesCaregiver(_ entry: CareEntry, _ caregiverName: String) -> Bool {
        entry.caregiver.localizedCaseInsensitiveCompare(caregiverName) == .orderedSame
            || entry.caregiver.localizedCaseInsensitiveCompare("Both") == .orderedSame
    }

    private func handoffMessage(nextRoutine: CareRoutine?, lastMeal: CareEntry?, lastWalk: CareEntry?, followUps: [CareEntry]) -> String {
        var lines: [String] = []
        if let nextRoutine {
            lines.append("Next Phoenix care: \(nextRoutine.label) at \(nextRoutine.time) (\(nextRoutine.owner)).")
        } else {
            lines.append("Next Phoenix care: today's routine is covered.")
        }

        if let lastMeal {
            lines.append("Last meal: \(lastMeal.title) by \(lastMeal.caregiver) at \(lastMeal.occurredAt.formatted(date: .abbreviated, time: .shortened)).")
        } else {
            lines.append("No meals logged today.")
        }

        if let lastWalk {
            lines.append("Last walk: \(lastWalk.title) by \(lastWalk.caregiver) at \(lastWalk.occurredAt.formatted(date: .abbreviated, time: .shortened)).")
        } else {
            lines.append("No walks logged today.")
        }

        if let firstFollowUp = followUps.first {
            let more = followUps.count > 1 ? ", plus \(followUps.count - 1) more" : ""
            lines.append("Follow-up: \(firstFollowUp.title) needs review\(more).")
        } else {
            lines.append("No active follow-ups logged today.")
        }

        return lines.joined(separator: " ")
    }

    private func sortRoutines() {
        state.routines.sort { lhs, rhs in
            let left = routineSortMinutes(lhs.time)
            let right = routineSortMinutes(rhs.time)
            if left != right {
                return left < right
            }
            return lhs.label < rhs.label
        }
    }

    private func sortGoals() {
        state.goals.sort { lhs, rhs in
            let statusOrder: [CareGoalStatus: Int] = [.active: 0, .paused: 1, .done: 2]
            let left = statusOrder[lhs.status] ?? 9
            let right = statusOrder[rhs.status] ?? 9
            if left != right {
                return left < right
            }
            return lhs.title < rhs.title
        }
    }

    private func countsForCalendarDay(_ entries: [CareEntry]) -> CalendarDayCounts {
        func count(_ type: CareEntryType) -> Int {
            entries.filter { $0.type == type }.count
        }

        func minutes(_ type: CareEntryType) -> Int {
            entries.filter { $0.type == type }.reduce(0) { $0 + $1.durationMinutes }
        }

        return CalendarDayCounts(
            meals: count(.meal),
            treats: count(.treat),
            walks: count(.walk),
            walkMinutes: minutes(.walk),
            parkVisits: count(.park),
            training: count(.training),
            trainingMinutes: minutes(.training),
            social: count(.social),
            dogInteractions: entries.reduce(0) { $0 + $1.dogInteractions },
            vomit: count(.vomit),
            health: count(.health),
            vet: count(.vet),
            weight: count(.weight),
            medication: count(.medication),
            followUps: entries.filter { $0.requiresFollowUp }.count
        )
    }

    private func calendarDaySummary(_ counts: CalendarDayCounts) -> String {
        var parts: [String] = []
        if counts.meals > 0 { parts.append("\(counts.meals) meal\(counts.meals == 1 ? "" : "s")") }
        if counts.walks > 0 { parts.append("\(counts.walks) walk\(counts.walks == 1 ? "" : "s")") }
        if counts.training > 0 { parts.append("\(counts.training) training") }
        if counts.parkVisits + counts.social > 0 { parts.append("\(counts.parkVisits + counts.social) social") }
        if counts.vomit > 0 { parts.append("\(counts.vomit) vomit") }
        if counts.health + counts.vet + counts.medication + counts.weight > 0 { parts.append("\(counts.health + counts.vet + counts.medication + counts.weight) health") }
        return parts.isEmpty ? "No logs" : parts.joined(separator: " | ")
    }

    private func dateKey(for date: Date) -> String {
        let components = Calendar.current.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", components.year ?? 0, components.month ?? 0, components.day ?? 0)
    }

    private func monthLabel(for date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "LLLL yyyy"
        return formatter.string(from: date)
    }

    private func routineSortMinutes(_ value: String) -> Int {
        let text = value.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        let parts = text.split(separator: " ")
        guard parts.count == 2, ["AM", "PM"].contains(String(parts[1])) else {
            return Int.max
        }

        let timeParts = parts[0].split(separator: ":")
        guard let hourText = timeParts.first, let rawHour = Int(String(hourText)), rawHour >= 1, rawHour <= 12 else {
            return Int.max
        }

        let minute = timeParts.count > 1 ? Int(String(timeParts[1])) ?? 0 : 0
        var hour = rawHour == 12 ? 0 : rawHour
        if String(parts[1]) == "PM" {
            hour += 12
        }
        return hour * 60 + minute
    }

    private func storageURL() throws -> URL {
        let folder = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
        let appFolder = folder.appending(path: "WoofWatcher", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: appFolder, withIntermediateDirectories: true)
        return appFolder.appending(path: fileName)
    }
}

struct HealthWatch {
    var status: String
    var signals: [String]
}

struct MonthlySummary {
    var meals: Int
    var walks: Int
    var training: Int
    var vomit: Int
    var followUps: Int
}

struct CareCalendar {
    var monthLabel: String
    var weekdays: [String]
    var firstWeekday: Int
    var activeDays: Int
    var reviewDays: Int
    var vomitDays: Int
    var totalLogs: Int
    var days: [CalendarDaySummary]
}

struct CalendarDaySummary: Identifiable {
    var id: String { dateKey }
    var day: Int
    var dateKey: String
    var isToday: Bool
    var status: String
    var summary: String
    var counts: CalendarDayCounts
    var entries: [CareEntry]
}

struct CalendarDayCounts {
    var meals: Int
    var treats: Int
    var walks: Int
    var walkMinutes: Int
    var parkVisits: Int
    var training: Int
    var trainingMinutes: Int
    var social: Int
    var dogInteractions: Int
    var vomit: Int
    var health: Int
    var vet: Int
    var weight: Int
    var medication: Int
    var followUps: Int
}

struct GoalReview {
    var totalGoals: Int
    var activeGoals: Int
    var completedGoals: Int
    var highlights: [String]
}

struct CaregiverHandoff {
    var nextRoutine: CareRoutine?
    var lastMeal: CareEntry?
    var lastWalk: CareEntry?
    var followUps: [CareEntry]
    var caregiverLoad: [CaregiverLoad]
    var message: String
}

struct CaregiverLoad: Identifiable {
    var id: String { name }
    var name: String
    var role: String
    var todayLogs: Int
    var latestAction: String
}

extension JSONEncoder {
    static var woofWatcher: JSONEncoder {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        return encoder
    }
}

extension JSONDecoder {
    static var woofWatcher: JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }
}
