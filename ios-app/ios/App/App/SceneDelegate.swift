import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    /// Conversa do WhatsApp que um toque no widget pediu e que ainda não foi
    /// aberta (o app pode ter acabado de acordar).
    private var whatsappPendente: URL?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = SoraViewController()  // registra o plugin de compras
        window?.makeKeyAndVisible()

        // App fechado e aberto por um botão do widget: o link chega aqui.
        for atividade in connectionOptions.userActivities {
            if let url = atividade.webpageURL, let destino = AtalhoLancar.whatsapp(para: url) {
                whatsappPendente = destino
            }
        }

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func sceneDidBecomeActive(_ scene: UIScene) {
        abrirWhatsappPendente()
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        // Link de um botão do widget: vai direto pro WhatsApp e não chega ao site.
        if let url = userActivity.webpageURL, let destino = AtalhoLancar.whatsapp(para: url) {
            whatsappPendente = destino
            if scene.activationState == .foregroundActive {
                abrirWhatsappPendente()
            }
            return
        }
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }

    private func abrirWhatsappPendente() {
        guard let destino = whatsappPendente else { return }
        whatsappPendente = nil
        UIApplication.shared.open(destino)
    }
}

/// Os botões do widget "Lançar rápido" abrem https://www.forsora.com/lancar/<acao>.
/// Aqui esse link vira a conversa com a Sora no WhatsApp.
///
/// ⚠️ O número é uma CÓPIA de lib/sora-whatsapp.ts (fonte única do site). O
/// widget do Android tem outra (android-widgets/.../LancarWidget.java). Mudou
/// lá, muda nas duas.
enum AtalhoLancar {
    static let numeroSora = "5532985096225"

    static func whatsapp(para url: URL) -> URL? {
        guard let host = url.host?.lowercased(), host == "forsora.com" || host.hasSuffix(".forsora.com") else {
            return nil
        }
        let partes = url.path.split(separator: "/").map(String.init)
        guard partes.count == 2, partes[0] == "lancar" else { return nil }

        var endereco = URLComponents(string: "https://wa.me/\(numeroSora)")
        switch partes[1] {
        case "gasto":
            endereco?.queryItems = [URLQueryItem(name: "text", value: "gastei ")]
        case "receita":
            endereco?.queryItems = [URLQueryItem(name: "text", value: "recebi ")]
        case "audio", "foto":
            break
        default:
            return nil
        }
        return endereco?.url
    }
}
