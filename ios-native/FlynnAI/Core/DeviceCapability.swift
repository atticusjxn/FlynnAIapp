import Foundation

/// Lightweight device-capability checks used to tailor the capture-setup
/// onboarding (Action Button vs Back Tap).
enum DeviceCapability {

    /// Hardware model identifier, e.g. "iPhone16,1". On the simulator this reflects
    /// the simulated device via the SIMULATOR_MODEL_IDENTIFIER env var.
    static var modelIdentifier: String {
        if let sim = ProcessInfo.processInfo.environment["SIMULATOR_MODEL_IDENTIFIER"] {
            return sim
        }
        var info = utsname()
        uname(&info)
        let machine = withUnsafeBytes(of: &info.machine) { raw -> String in
            let bytes = raw.bindMemory(to: CChar.self)
            return String(cString: bytes.baseAddress!)
        }
        return machine
    }

    /// True for iPhones that ship with the Action Button: iPhone 15 Pro / Pro Max
    /// (`iPhone16,1` / `iPhone16,2`) and every iPhone 16 and later (`iPhone17,*`
    /// onward — future-proofed by major-number comparison).
    static var hasActionButton: Bool {
        let id = modelIdentifier
        if id == "iPhone16,1" || id == "iPhone16,2" { return true }
        guard id.hasPrefix("iPhone") else { return false }
        let majorString = id.dropFirst("iPhone".count).prefix { $0 != "," }
        if let major = Int(majorString), major >= 17 { return true }
        return false
    }
}
