import UIKit
import WebKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = SoraViewController()  // registra os plugins (compras e widgets)
        window?.makeKeyAndVisible()

        // App fechado e aberto por um link (botão ou toque de widget): guarda pra
        // agir assim que o app estiver ativo.
        for atividade in connectionOptions.userActivities {
            guard let url = atividade.webpageURL else { continue }
            if let destino = AtalhoLancar.whatsapp(para: url) {
                AtalhoLancar.pendente = destino
            } else if let tela = NavegarApp.destino(url) {
                NavegarApp.pendente = tela
            }
        }

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func sceneDidBecomeActive(_ scene: UIScene) {
        AtalhoLancar.abrirPendente()
        NavegarApp.abrirPendente(em: window)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        if let url = userActivity.webpageURL {
            // Link /lancar/<acao>: vai direto pro WhatsApp e não chega ao site.
            if let destino = AtalhoLancar.whatsapp(para: url) {
                AtalhoLancar.abrir(destino)
                return
            }
            // Toque num widget: abre a tela dele DENTRO do app.
            if let tela = NavegarApp.destino(url) {
                if scene.activationState == .foregroundActive {
                    NavegarApp.abrir(tela, em: window)
                } else {
                    NavegarApp.pendente = tela
                }
                return
            }
        }
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}

/// Toque num widget com números abre a tela dele no app (Previstos, Cartões,
/// Widgets). Sem isto o iPhone abria o app e a página não mudava: o link chega
/// ao app, mas ninguém mandava a tela navegar.
///
/// ⚠️ Lista FECHADA de caminhos: outros links do site seguem o caminho de antes.
enum NavegarApp {
    static var pendente: URL?
    private static let caminhos = ["/widgets", "/previstos", "/cartao-de-credito"]

    static func destino(_ url: URL) -> URL? {
        guard let host = url.host?.lowercased(), host == "forsora.com" || host.hasSuffix(".forsora.com") else {
            return nil
        }
        guard caminhos.contains(where: { url.path == $0 || url.path.hasPrefix($0 + "/") }) else { return nil }
        return url
    }

    static func abrir(_ url: URL, em janela: UIWindow?) {
        guard let web = (janela?.rootViewController as? CAPBridgeViewController)?.bridge?.webView else {
            pendente = url
            return
        }
        web.load(URLRequest(url: url))
    }

    static func abrirPendente(em janela: UIWindow?) {
        guard let url = pendente else { return }
        pendente = nil
        abrir(url, em: janela)
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
