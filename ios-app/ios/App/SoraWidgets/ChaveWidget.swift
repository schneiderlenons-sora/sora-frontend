import Foundation
import Security

/// A chave do widget no Keychain COMPARTILHADO entre o app e o widget.
///
/// ⚠️ ESTE ARQUIVO ENTRA NOS DOIS ALVOS (app e widget). O app grava (plugin
/// SoraWidget, depois de trocar o código de conexão pela chave) e o widget lê.
///
/// Keychain e não App Group: o grupo de acesso do Keychain com o prefixo do
/// time já é permitido pelos perfis de assinatura (`V4P649QY95.*`), sem mexer
/// no portal da Apple — e a chave fica cifrada, não num arquivo.
///
/// `AfterFirstUnlock`: o widget atualiza com o iPhone bloqueado; com
/// `WhenUnlocked` ele não conseguiria ler a chave.
enum ChaveWidget {
    /// Mesmo valor em `keychain-access-groups` dos dois .entitlements.
    static let grupo = "V4P649QY95.com.forsora.app.compartilhado"
    static let servico = "com.forsora.app.widget"
    static let apiPadrao = "https://sora-backend-ohio.onrender.com"

    private static func consulta(_ conta: String) -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: servico,
            kSecAttrAccount as String: conta,
            kSecAttrAccessGroup as String: grupo,
        ]
    }

    @discardableResult
    static func salvar(_ valor: String, conta: String) -> Bool {
        let base = consulta(conta)
        SecItemDelete(base as CFDictionary)
        var novo = base
        novo[kSecValueData as String] = Data(valor.utf8)
        novo[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        return SecItemAdd(novo as CFDictionary, nil) == errSecSuccess
    }

    static func ler(conta: String) -> String? {
        var q = consulta(conta)
        q[kSecReturnData as String] = true
        q[kSecMatchLimit as String] = kSecMatchLimitOne
        var resultado: AnyObject?
        guard SecItemCopyMatching(q as CFDictionary, &resultado) == errSecSuccess,
              let dados = resultado as? Data else { return nil }
        return String(data: dados, encoding: .utf8)
    }

    static func apagar(conta: String) {
        SecItemDelete(consulta(conta) as CFDictionary)
    }

    // Atalhos
    static var chave: String? { ler(conta: "chave") }
    static var api: String { ler(conta: "api") ?? apiPadrao }
}
