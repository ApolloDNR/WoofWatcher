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
