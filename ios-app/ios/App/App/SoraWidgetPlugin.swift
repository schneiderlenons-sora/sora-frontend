import Foundation
import Capacitor
import UIKit
import WidgetKit

// =============================================================================
// CONECTAR OS WIDGETS — a ponte entre o site (aba Widgets) e o widget.
//
// O site pede ao servidor um CÓDIGO de uso único e chama este plugin por
// `window.Capacitor.nativePromise('SoraWidget', 'conectar', { codigo, api })`
// (lib/widgets.ts). Aqui o código vira a CHAVE do aparelho
// (POST /api/widget/token), que vai pro Keychain compartilhado (ChaveWidget) —
// de onde o widget lê. Depois os widgets são recarregados na hora.
//
// ⚠️ A chave nunca passa pelo site: o código é de uso único e vale 5 minutos;
// quem troca pela chave é o app.
// =============================================================================

@objc(SoraWidgetPlugin)
public class SoraWidgetPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SoraWidgetPlugin"
    public let jsName = "SoraWidget"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "conectar", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "desconectar", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "estado", returnType: CAPPluginReturnPromise),
    ]

    @objc func conectar(_ call: CAPPluginCall) {
        guard let codigo = call.getString("codigo"), !codigo.isEmpty else {
            call.reject("Código de conexão ausente.")
            return
        }
        // Só aceita o servidor da Sora (o site manda o endereço da API dele).
        var api = call.getString("api") ?? ChaveWidget.apiPadrao
        if !(api.hasPrefix("https://") && (api.hasSuffix(".onrender.com") || api.hasSuffix("forsora.com"))) {
            api = ChaveWidget.apiPadrao
        }
        guard let url = URL(string: "\(api)/api/widget/token") else {
            call.reject("Endereço inválido.")
            return
        }
        var pedido = URLRequest(url: url)
        pedido.httpMethod = "POST"
        pedido.timeoutInterval = 20
        pedido.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let corpo: [String: Any] = ["codigo": codigo, "plataforma": "ios", "aparelho": UIDevice.current.model]
        pedido.httpBody = try? JSONSerialization.data(withJSONObject: corpo)

        Task {
            do {
                let (dados, resposta) = try await URLSession.shared.data(for: pedido)
                let status = (resposta as? HTTPURLResponse)?.statusCode ?? 0
                let json = (try? JSONSerialization.jsonObject(with: dados)) as? [String: Any]
                guard status == 200, let chave = json?["chave"] as? String, !chave.isEmpty else {
                    let motivo = (json?["erro"] as? String) == "codigo_expirado"
                        ? "O código venceu. Toque em conectar de novo."
                        : "Não consegui conectar os widgets agora. Tente de novo."
                    call.reject(motivo)
                    return
                }
                guard ChaveWidget.salvar(chave, conta: "chave") else {
                    call.reject("Não consegui guardar a conexão neste iPhone.")
                    return
                }
                ChaveWidget.salvar(api, conta: "api")
                WidgetCenter.shared.reloadAllTimelines()
                call.resolve(["ok": true])
            } catch {
                call.reject("Sem conexão com a internet. Tente de novo.")
            }
        }
    }

    @objc func desconectar(_ call: CAPPluginCall) {
        ChaveWidget.apagar(conta: "chave")
        WidgetCenter.shared.reloadAllTimelines()
        call.resolve(["ok": true])
    }

    @objc func estado(_ call: CAPPluginCall) {
        call.resolve(["conectado": ChaveWidget.chave != nil])
    }
}
