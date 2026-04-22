import Foundation
import os

enum FlynnLog {
    static let app = Logger(subsystem: "com.flynnai.app.native", category: "app")
    static let auth = Logger(subsystem: "com.flynnai.app.native", category: "auth")
    static let network = Logger(subsystem: "com.flynnai.app.native", category: "network")
    static let nav = Logger(subsystem: "com.flynnai.app.native", category: "nav")
}
