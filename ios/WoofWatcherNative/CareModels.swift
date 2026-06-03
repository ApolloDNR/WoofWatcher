import Foundation

enum CareEntryType: String, Codable, CaseIterable, Identifiable {
    case meal
    case treat
    case walk
    case park
    case training
    case social
    case vomit
    case health
    case vet
    case weight
    case medication
    case note

    var id: String { rawValue }
    var title: String {
        switch self {
        case .meal: return "Meal"
        case .treat: return "Treat"
        case .walk: return "Walk"
        case .park: return "Dog Park"
        case .training: return "Training"
        case .social: return "Social"
        case .vomit: return "Vomit"
        case .health: return "Health"
        case .vet: return "Vet"
        case .weight: return "Weight"
        case .medication: return "Medication"
        case .note: return "Note"
        }
    }
}

enum CareSeverity: String, Codable, CaseIterable, Identifiable {
    case normal
    case watch
    case urgent

    var id: String { rawValue }
}

struct CareState: Codable {
    var profile: PhoenixProfile
    var caregivers: [Caregiver]
    var routines: [CareRoutine]
    var records: [CareRecord]
    var entries: [CareEntry]

    static var seed: CareState {
        let now = Date()
        return CareState(
            profile: PhoenixProfile.seed,
            caregivers: [
                Caregiver(name: "Apollo", role: "Primary caregiver"),
                Caregiver(name: "Girlfriend", role: "Primary caregiver")
            ],
            routines: CareRoutine.seed,
            records: CareRecord.seed,
            entries: [
                CareEntry(type: .meal, title: "Breakfast", caregiver: "Apollo", amount: "1 cup", mood: "settled", note: "Ate after a calm start.", occurredAt: now.addingTimeInterval(-7 * 3600)),
                CareEntry(type: .walk, title: "Morning walk", caregiver: "Apollo", durationMinutes: 22, note: "Loose leash, sniffed calmly.", occurredAt: now.addingTimeInterval(-6 * 3600)),
                CareEntry(type: .training, title: "Place work", caregiver: "Girlfriend", durationMinutes: 10, mood: "engaged", note: "Held place while food was prepared.", occurredAt: now.addingTimeInterval(-5 * 3600)),
                CareEntry(type: .vomit, title: "Yellow bile", caregiver: "Apollo", severity: .watch, note: "Small amount before breakfast. Normal energy after.", occurredAt: now.addingTimeInterval(-4 * 3600))
            ]
        )
    }
}

struct PhoenixProfile: Codable {
    var name: String
    var breed: String
    var background: String
    var careFocus: String
    var currentWeight: Double
    var weightGoal: String
    var vetBoundary: String

    static let seed = PhoenixProfile(
        name: "Phoenix",
        breed: "German Shepherd / Belgian Shepherd mix",
        background: "Rescued after being underweight and food anxious.",
        careFocus: "Keep routines calm, document appetite patterns, and prevent long empty-stomach windows.",
        currentWeight: 56.2,
        weightGoal: "Slow, vet-guided weight gain and stable appetite",
        vetBoundary: "Pattern tracking only. Contact a veterinarian for diagnosis, treatment, worsening symptoms, or urgent red flags."
    )
}

struct Caregiver: Codable, Identifiable {
    var id = UUID()
    var name: String
    var role: String
}

struct CareRoutine: Codable, Identifiable {
    var id: String
    var label: String
    var type: CareEntryType
    var time: String
    var owner: String
    var note: String

    static let seed: [CareRoutine] = [
        CareRoutine(id: "routine_breakfast", label: "Breakfast", type: .meal, time: "7:30 AM", owner: "Whoever is up first", note: "Small calm meal; avoid pressure if Phoenix is anxious."),
        CareRoutine(id: "routine_morning_walk", label: "Morning walk", type: .walk, time: "8:15 AM", owner: "Apollo", note: "Decompress walk, sniffing encouraged."),
        CareRoutine(id: "routine_midday_check", label: "Midday check", type: .note, time: "12:30 PM", owner: "Either caregiver", note: "Water, mood, appetite, and anxiety check."),
        CareRoutine(id: "routine_dinner", label: "Dinner", type: .meal, time: "6:30 PM", owner: "Either caregiver", note: "Document amount and whether she needed company to eat."),
        CareRoutine(id: "routine_evening_walk", label: "Evening walk", type: .walk, time: "8:15 PM", owner: "Whoever is home", note: "Short settling walk before bedtime."),
        CareRoutine(id: "routine_bedtime_snack", label: "Bedtime snack", type: .treat, time: "10:00 PM", owner: "Either caregiver", note: "Small snack may help reduce empty-stomach bile mornings.")
    ]
}

struct RoutineDraft {
    var id: String = ""
    var label: String = ""
    var type: CareEntryType = .meal
    var time: String = ""
    var owner: String = "Either caregiver"
    var note: String = ""

    init() {}

    init(routine: CareRoutine) {
        id = routine.id
        label = routine.label
        type = routine.type
        time = routine.time
        owner = routine.owner
        note = routine.note
    }

    func routine() -> CareRoutine {
        let cleanLabel = label.trimmingCharacters(in: .whitespacesAndNewlines)
        let cleanTime = time.trimmingCharacters(in: .whitespacesAndNewlines)
        return CareRoutine(
            id: id.isEmpty ? "routine_\(type.rawValue)_\(UUID().uuidString.prefix(8))" : id,
            label: cleanLabel.isEmpty ? type.title : cleanLabel,
            type: type,
            time: cleanTime.isEmpty ? "Unscheduled" : cleanTime,
            owner: owner.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "Either caregiver" : owner,
            note: note.trimmingCharacters(in: .whitespacesAndNewlines)
        )
    }
}

struct CareRecord: Codable, Identifiable {
    var id = UUID()
    var type: String
    var title: String
    var due: String
    var note: String

    static let seed = [
        CareRecord(type: "vet", title: "Next vet discussion", due: "Next regular appointment", note: "Mention yellow bile vomiting, appetite anxiety, weight goal, and frequency changes."),
        CareRecord(type: "weight", title: "Weight goal", due: "Monthly", note: "Track weight gently; avoid aggressive feeding changes without vet guidance."),
        CareRecord(type: "vaccine", title: "Vaccine records", due: "Add dates", note: "Store rabies, DHPP, Bordetella, and clinic notes here.")
    ]
}

struct CareEntry: Codable, Identifiable {
    var id = UUID()
    var type: CareEntryType
    var title: String
    var caregiver: String
    var amount: String = ""
    var durationMinutes: Int = 0
    var dogInteractions: Int = 0
    var mood: String = ""
    var severity: CareSeverity = .normal
    var note: String = ""
    var occurredAt: Date = Date()

    var requiresFollowUp: Bool {
        type == .vomit || severity == .urgent
    }
}

struct CareEntryDraft {
    var type: CareEntryType = .meal
    var title: String = ""
    var caregiver: String = "Apollo"
    var amount: String = ""
    var durationMinutes: Int = 0
    var dogInteractions: Int = 0
    var mood: String = ""
    var severity: CareSeverity = .normal
    var note: String = ""
    var occurredAt: Date = Date()

    func entry() -> CareEntry {
        CareEntry(
            type: type,
            title: title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? type.title : title,
            caregiver: caregiver,
            amount: amount,
            durationMinutes: max(0, durationMinutes),
            dogInteractions: max(0, dogInteractions),
            mood: mood,
            severity: severity,
            note: note,
            occurredAt: occurredAt
        )
    }
}
