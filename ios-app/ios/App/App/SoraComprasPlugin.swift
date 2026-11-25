import Foundation
import Capacitor
import StoreKit

// =============================================================================
// COMPRA DE ASSINATURA PELA APPLE (StoreKit 2) — a ponte entre o site e a Apple.
//
// O app é uma casca que abre www.forsora.com (ver ios-app/README.md). O site
// chama este plugin por `window.Capacitor.nativePromise('SoraCompras', ...)`
// (lib/apple-compras.ts) — sem pacote JS: o site não empacota o Capacitor.
//
// ⚠️ QUEM DECIDE SE A ASSINATURA VALE É O SERVIDOR, conferindo com a Apple
// (lib/apple-sync.ts). Este arquivo só abre a janela de compra da Apple e
// devolve o comprovante assinado (JWS) para o site mandar ao servidor.
//
// ⚠️ `appAccountToken` = id da conta Sora (UUID). Vai dentro do comprovante e
// dos avisos automáticos da Apple: é o que liga a compra à conta certa mesmo
// que o envio do site falhe logo depois do pagamento.
//
// ⚠️ A transação é FINALIZADA aqui, logo depois da compra. Na Apple, não
// finalizar não devolve o dinheiro (diferente da Google Play): só faria a
// compra reaparecer a cada abertura. A liberação do plano não depende disso —
// vem do servidor, pelo comprovante e pelos avisos da Apple.
// =============================================================================

@objc(SoraComprasPlugin)
public class SoraComprasPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SoraComprasPlugin"
    public let jsName = "SoraCompras"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "produtos", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "comprar", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "direitos", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restaurar", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "gerenciar", returnType: CAPPluginReturnPromise),
    ]

    private var ouvinte: Task<Void, Never>?

    // Renovações, compras aprovadas depois ("pendente", ex.: Compra por
    // Solicitação) e reembolsos chegam por aqui enquanto o app está aberto.
    // Só finaliza: o servidor fica sabendo pelos avisos da Apple e pela
    // restauração na próxima abertura (components/app/SincronizarApple.tsx).
    public override func load() {
        ouvinte = Task.detached(priority: .background) {
            for await resultado in Transaction.updates {
                if case .verified(let transacao) = resultado {
                    await transacao.finish()
                }
            }
        }
    }

    deinit {
        ouvinte?.cancel()
    }

    /// { ids: string[] } → { produtos: [{ id, preco, valor, moeda, periodo }] }
    @objc func produtos(_ call: CAPPluginCall) {
        let ids = (call.getArray("ids") ?? []).compactMap { $0 as? String }
        Task {
            do {
                let lista = try await Product.products(for: ids)
                let itens: [[String: Any]] = lista.map { p in
                    var item: [String: Any] = [
                        "id": p.id,
                        "preco": p.displayPrice,
                        "valor": NSDecimalNumber(decimal: p.price).doubleValue,
                        "moeda": p.priceFormatStyle.currencyCode,
                    ]
                    if let periodo = p.subscription?.subscriptionPeriod {
                        item["periodo"] = periodo.unit == .year ? "anual" : (periodo.unit == .month ? "mensal" : "outro")
                    }
                    return item
                }
                call.resolve(["produtos": itens])
            } catch {
                call.reject("Não foi possível carregar os planos da App Store.", "PRODUTOS", error)
            }
        }
    }

    /// { id, conta } → { status: sucesso | cancelada | pendente | nao_verificada, jws? }
    @objc func comprar(_ call: CAPPluginCall) {
        guard let id = call.getString("id"), !id.isEmpty else {
            call.reject("Plano não informado.", "SEM_PLANO")
            return
        }
        let conta = call.getString("conta").flatMap { UUID(uuidString: $0) }
        Task { @MainActor in
            do {
                guard let produto = try await Product.products(for: [id]).first else {
                    call.reject("Este plano não está disponível na App Store agora.", "INDISPONIVEL")
                    return
                }
                var opcoes: Set<Product.PurchaseOption> = []
                if let conta = conta {
                    opcoes.insert(.appAccountToken(conta))
                }
                let resultado = try await produto.purchase(options: opcoes)
                switch resultado {
                case .success(let verificacao):
                    switch verificacao {
                    case .verified(let transacao):
                        await transacao.finish()
                        call.resolve([
                            "status": "sucesso",
                            "jws": verificacao.jwsRepresentation,
                            "produto": transacao.productID,
                            "original": String(transacao.originalID),
                        ])
                    case .unverified(_, let erro):
                        call.resolve(["status": "nao_verificada", "erro": erro.localizedDescription])
                    }
                case .userCancelled:
                    call.resolve(["status": "cancelada"])
                case .pending:
                    call.resolve(["status": "pendente"])
                @unknown default:
                    call.resolve(["status": "desconhecido"])
                }
            } catch {
                call.reject("Não foi possível concluir a compra.", "COMPRA", error)
            }
        }
    }

    /// Assinaturas vigentes deste Apple ID, sem pedir senha. → { itens: [{ jws, produto, original }] }
    @objc func direitos(_ call: CAPPluginCall) {
        Task {
            call.resolve(["itens": await SoraComprasPlugin.lerDireitos()])
        }
    }

    /// "Restaurar compras": sincroniza com a App Store (pode pedir a senha do Apple ID).
    @objc func restaurar(_ call: CAPPluginCall) {
        Task {
            do {
                try await AppStore.sync()
            } catch {
                call.reject("Não foi possível falar com a App Store agora.", "RESTAURAR", error)
                return
            }
            call.resolve(["itens": await SoraComprasPlugin.lerDireitos()])
        }
    }

    /// Abre a tela de assinaturas da Apple (trocar de plano, cancelar).
    @objc func gerenciar(_ call: CAPPluginCall) {
        Task { @MainActor in
            guard let cena = self.bridge?.viewController?.view.window?.windowScene else {
                call.reject("Não foi possível abrir as assinaturas agora.", "SEM_CENA")
                return
            }
            do {
                try await AppStore.showManageSubscriptions(in: cena)
                call.resolve()
            } catch {
                call.reject("Não foi possível abrir as assinaturas agora.", "GERENCIAR", error)
            }
        }
    }

    private static func lerDireitos() async -> [[String: Any]] {
        var itens: [[String: Any]] = []
        for await resultado in Transaction.currentEntitlements {
            if case .verified(let transacao) = resultado {
                itens.append([
                    "jws": resultado.jwsRepresentation,
                    "produto": transacao.productID,
                    "original": String(transacao.originalID),
                ])
            }
        }
        return itens
    }
}
