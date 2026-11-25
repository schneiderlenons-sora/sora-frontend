import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = SoraViewController()  // registra o plugin de compras
        window?.makeKeyAndVisible()

        // App fechado e aberto por um link /lancar/<acao>: guarda pra abrir o
        // WhatsApp assim que o app estiver ativo.
        for atividade in connectionOptions.userActivities {
            if let url = atividade.webpageURL, let destino = AtalhoLancar.whatsapp(para: url) {
                AtalhoLancar.pendente = destino
            }
        }

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func sceneDidBecomeActive(_ scene: UIScene) {
        AtalhoLancar.abrirPendente()
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        // Link /lancar/<acao>: vai direto pro WhatsApp e não chega ao site.
        if let url = userActivity.webpageURL, let destino = AtalhoLancar.whatsapp(para: url) {
            AtalhoLancar.abrir(destino)
            return
        }
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}

/// Os botões do widget "Lançar rápido" (AbrirLancamentoIntent) e os links
/// https://www.forsora.com/lancar/<acao> viram a conversa com a Sora no WhatsApp.
///
/// ⚠️ O número é uma CÓPIA de lib/sora-whatsapp.ts (fonte única do site). O
/// widget do Android tem outra (android-widgets/.../LancarWidget.java). Mudou
/// lá, muda nas duas.
enum AtalhoLancar {
    static let numeroSora = "5532985096225"

    /// Conversa pedida antes de o app ficar ativo (ele pode ter acabado de abrir).
    static var pendente: URL?

    static func whatsapp(acao: String) -> URL? {
        var endereco = URLComponents(string: "https://wa.me/\(numeroSora)")
        switch acao {
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

    static func whatsapp(para url: URL) -> URL? {
        guard let host = url.host?.lowercased(), host == "forsora.com" || host.hasSuffix(".forsora.com") else {
            return nil
        }
        let partes = url.path.split(separator: "/").map(String.init)
        guard partes.count == 2, partes[0] == "lancar" else { return nil }
        return whatsapp(acao: partes[1])
    }

    /// Abre agora se o app já está na frente; senão, ao ficar ativo
    /// (`sceneDidBecomeActive`). Abrir outro app antes disso o iPhone ignora.
    static func abrir(_ destino: URL) {
        if UIApplication.shared.applicationState == .active {
            UIApplication.shared.open(destino)
        } else {
            pendente = destino
        }
    }

    static func abrirPendente() {
        guard let destino = pendente else { return }
        pendente = nil
        UIApplication.shared.open(destino)
    }
}
